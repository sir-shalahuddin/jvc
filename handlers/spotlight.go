package handlers

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"
)

type SessionSpotlightState struct {
	SessionID   string `json:"session_id"`
	Active      bool   `json:"active"`
	QuestionID  string `json:"question_id"`
	AnswerID    string `json:"answer_id"`
	UpdatedAtMs int64  `json:"updated_at_ms"`
}

type SpotlightActionRequest struct {
	SessionID  string `json:"session_id"`
	Action     string `json:"action"` // "focus" or "clear"
	QuestionID string `json:"question_id"`
	AnswerID   string `json:"answer_id"`
}

var (
	spotlightMu     sync.RWMutex
	spotlightStates = make(map[string]*SessionSpotlightState)
)

func getOrCreateSpotlight(sessionID string) *SessionSpotlightState {
	spotlightMu.Lock()
	defer spotlightMu.Unlock()

	st, exists := spotlightStates[sessionID]
	if !exists {
		st = &SessionSpotlightState{
			SessionID:   sessionID,
			Active:      false,
			QuestionID:  "",
			AnswerID:    "",
			UpdatedAtMs: time.Now().UnixMilli(),
		}
		spotlightStates[sessionID] = st
	}
	return st
}

func GetSpotlightHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	sessionID := r.URL.Query().Get("session_id")
	if sessionID == "" {
		http.Error(w, "session_id required", http.StatusBadRequest)
		return
	}

	st := getOrCreateSpotlight(sessionID)

	spotlightMu.RLock()
	resp := *st
	spotlightMu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func SpotlightActionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req SpotlightActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.SessionID == "" {
		http.Error(w, "session_id required", http.StatusBadRequest)
		return
	}

	// Verify moderator/owner authorization
	email := GetUserFromRequest(r)
	session, err := SessionServ.SessionRepo.GetByID(r.Context(), req.SessionID)
	if err != nil || session == nil || session.OwnerEmail != email {
		http.Error(w, "Unauthorized: only session moderator can control spotlight", http.StatusForbidden)
		return
	}

	st := getOrCreateSpotlight(req.SessionID)

	spotlightMu.Lock()
	switch req.Action {
	case "focus":
		st.Active = true
		st.QuestionID = req.QuestionID
		st.AnswerID = req.AnswerID
		st.UpdatedAtMs = time.Now().UnixMilli()
	case "clear":
		st.Active = false
		st.QuestionID = ""
		st.AnswerID = ""
		st.UpdatedAtMs = time.Now().UnixMilli()
	default:
		spotlightMu.Unlock()
		http.Error(w, "Invalid action: must be focus or clear", http.StatusBadRequest)
		return
	}
	resp := *st
	spotlightMu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
