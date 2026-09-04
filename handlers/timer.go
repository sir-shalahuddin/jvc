package handlers

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"
)

type SessionTimerState struct {
	SessionID        string `json:"session_id"`
	Running          bool   `json:"running"`
	RemainingSeconds int    `json:"remaining_seconds"`
	EndTimeUnixMs    int64  `json:"end_time_unix_ms"`
	PresetMinutes    int    `json:"preset_minutes"`
}

var (
	timerMu     sync.RWMutex
	timerStates = make(map[string]*SessionTimerState)
)

func getOrCreateTimer(sessionID string) *SessionTimerState {
	timerMu.Lock()
	defer timerMu.Unlock()

	st, exists := timerStates[sessionID]
	if !exists {
		st = &SessionTimerState{
			SessionID:        sessionID,
			Running:          false,
			RemainingSeconds: 300, // Default 5 minutes
			PresetMinutes:    5,
			EndTimeUnixMs:    0,
		}
		timerStates[sessionID] = st
	}
	return st
}

func GetTimerHandler(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("session_id")
	if sessionID == "" {
		http.Error(w, "session_id required", http.StatusBadRequest)
		return
	}

	st := getOrCreateTimer(sessionID)

	timerMu.Lock()
	nowMs := time.Now().UnixMilli()
	if st.Running && st.EndTimeUnixMs > 0 {
		rem := int((st.EndTimeUnixMs - nowMs) / 1000)
		if rem <= 0 {
			st.Running = false
			st.RemainingSeconds = 0
			st.EndTimeUnixMs = 0
		} else {
			st.RemainingSeconds = rem
		}
	}
	// Copy state for safe response
	resp := *st
	timerMu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func TimerActionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		SessionID string `json:"session_id"`
		Action    string `json:"action"` // "start", "pause", "reset", "preset"
		Seconds   int    `json:"seconds"`
		Minutes   int    `json:"minutes"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	if req.SessionID == "" {
		http.Error(w, "session_id required", http.StatusBadRequest)
		return
	}

	// Verify Ownership / Moderator Access
	email := GetUserFromRequest(r)
	if SessionServ != nil && SessionServ.SessionRepo != nil {
		session, err := SessionServ.SessionRepo.GetByID(r.Context(), req.SessionID)
		if err != nil || session == nil || session.OwnerEmail == "" || session.OwnerEmail != email {
			http.Error(w, "Forbidden: Only moderator can control the timer", http.StatusForbidden)
			return
		}
	}

	st := getOrCreateTimer(req.SessionID)

	timerMu.Lock()
	nowMs := time.Now().UnixMilli()

	switch req.Action {
	case "start":
		secs := req.Seconds
		if secs <= 0 {
			secs = st.RemainingSeconds
		}
		if secs <= 0 {
			secs = 300
		}
		st.Running = true
		st.RemainingSeconds = secs
		st.EndTimeUnixMs = nowMs + int64(secs*1000)

	case "pause":
		if st.Running && st.EndTimeUnixMs > 0 {
			st.RemainingSeconds = int((st.EndTimeUnixMs - nowMs) / 1000)
			if st.RemainingSeconds < 0 {
				st.RemainingSeconds = 0
			}
			st.Running = false
			st.EndTimeUnixMs = 0
		}

	case "reset":
		st.Running = false
		st.EndTimeUnixMs = 0
		if req.Seconds > 0 {
			st.RemainingSeconds = req.Seconds
		} else if st.PresetMinutes > 0 {
			st.RemainingSeconds = st.PresetMinutes * 60
		} else {
			st.RemainingSeconds = 300
		}

	case "preset":
		st.Running = false
		st.EndTimeUnixMs = 0
		mins := req.Minutes
		if mins <= 0 {
			mins = 5
		}
		st.PresetMinutes = mins
		st.RemainingSeconds = mins * 60
	}

	resp := *st
	timerMu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
