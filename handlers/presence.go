package handlers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	PresenceTimeout = 15 * time.Second
)

type ParticipantPresence struct {
	ID       string    `json:"id"`
	Name     string    `json:"name"`
	Role     string    `json:"role"` // "moderator" or "participant"
	LastSeen time.Time `json:"last_seen"`
}

type SessionPresenceState struct {
	SessionID    string
	Participants map[string]*ParticipantPresence
	mu           sync.RWMutex
}

var (
	presenceMu     sync.RWMutex
	presenceStates = make(map[string]*SessionPresenceState)
)

func getOrCreatePresenceState(sessionID string) *SessionPresenceState {
	presenceMu.Lock()
	defer presenceMu.Unlock()

	st, exists := presenceStates[sessionID]
	if !exists {
		st = &SessionPresenceState{
			SessionID:    sessionID,
			Participants: make(map[string]*ParticipantPresence),
		}
		presenceStates[sessionID] = st
	}
	return st
}

func (s *SessionPresenceState) UpdateParticipant(id, name, role string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if id == "" {
		return
	}
	if name == "" {
		name = "Anonymous Guest"
	}
	if role == "" {
		role = "participant"
	}

	p, exists := s.Participants[id]
	if exists {
		p.Name = name
		p.Role = role
		p.LastSeen = time.Now()
	} else {
		s.Participants[id] = &ParticipantPresence{
			ID:       id,
			Name:     name,
			Role:     role,
			LastSeen: time.Now(),
		}
	}
}

func (s *SessionPresenceState) RemoveParticipant(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.Participants, id)
}

func (s *SessionPresenceState) GetActive(now time.Time) []ParticipantPresence {
	s.mu.Lock()
	defer s.mu.Unlock()

	var active []ParticipantPresence
	for id, p := range s.Participants {
		if now.Sub(p.LastSeen) > PresenceTimeout {
			delete(s.Participants, id)
		} else {
			active = append(active, *p)
		}
	}

	// Sort: moderators first, then by name
	sort.Slice(active, func(i, j int) bool {
		if active[i].Role != active[j].Role {
			return active[i].Role == "moderator"
		}
		return active[i].Name < active[j].Name
	})

	return active
}

func getTopicCounts(ctx context.Context, sessionID string) map[string]int {
	counts := make(map[string]int)
	if AnswerRepo != nil && sessionID != "" {
		answers, err := AnswerRepo.GetBySession(ctx, sessionID)
		if err == nil {
			for _, a := range answers {
				counts[a.QuestionID]++
			}
		}
	}
	return counts
}

type PresenceRequest struct {
	SessionID string `json:"session_id"`
	ClientID  string `json:"client_id"`
	Name      string `json:"name"`
	Role      string `json:"role"`
}

type PresenceResponse struct {
	SessionID    string                `json:"session_id"`
	Count        int                   `json:"count"`
	Participants []ParticipantPresence `json:"participants"`
	TopicCounts  map[string]int        `json:"topic_counts"`
}

func PresenceHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	sessionID := r.URL.Query().Get("session_id")
	var clientID, name, role string

	if r.Method == http.MethodPost {
		var req PresenceRequest
		bodyBytes, _ := io.ReadAll(r.Body)
		if len(bodyBytes) > 0 {
			if err := json.Unmarshal(bodyBytes, &req); err == nil {
				if req.SessionID != "" {
					sessionID = req.SessionID
				}
				clientID = req.ClientID
				name = req.Name
				role = req.Role
			}
		}
	}

	if sessionID == "" {
		http.Error(w, "session_id required", http.StatusBadRequest)
		return
	}

	st := getOrCreatePresenceState(sessionID)

	if r.Method == http.MethodPost && clientID != "" {
		st.UpdateParticipant(clientID, name, role)
	}

	active := st.GetActive(time.Now())
	topicCounts := getTopicCounts(r.Context(), sessionID)

	resp := PresenceResponse{
		SessionID:    sessionID,
		Count:        len(active),
		Participants: active,
		TopicCounts:  topicCounts,
	}

	json.NewEncoder(w).Encode(resp)
}

func PresenceLeaveHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req PresenceRequest
	bodyBytes, _ := io.ReadAll(r.Body)
	if len(bodyBytes) > 0 {
		_ = json.Unmarshal(bodyBytes, &req)
	}

	// Also support query params (useful for sendBeacon or GET fallback)
	if req.SessionID == "" {
		req.SessionID = r.URL.Query().Get("session_id")
	}
	if req.ClientID == "" {
		req.ClientID = r.URL.Query().Get("client_id")
	}

	// Also support form data if sent via sendBeacon urlencoded
	if req.SessionID == "" && strings.Contains(string(bodyBytes), "session_id=") {
		values, err := url.ParseQuery(string(bodyBytes))
		if err == nil {
			req.SessionID = values.Get("session_id")
			req.ClientID = values.Get("client_id")
		}
	}

	if req.SessionID != "" && req.ClientID != "" {
		st := getOrCreatePresenceState(req.SessionID)
		st.RemoveParticipant(req.ClientID)
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"ok"}`))
}
