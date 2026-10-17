package handlers

import (
	"encoding/json"
	"net/http"
	"retro-gcp/models"
	"sort"
	"time"
)

// StateHandler returns everything a board client needs in one response, so the
// frontend can poll a single endpoint. It reuses the same helpers as the
// individual endpoints. Query: session_id (required), question_id (optional),
// voter_id / device_fingerprint (the client's voting identity), and optionally
// client_id + name to refresh presence.
func StateHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	sessionID := r.URL.Query().Get("session_id")
	if sessionID == "" {
		writeJSONError(w, http.StatusBadRequest, "session_id required")
		return
	}
	ctx := r.Context()

	session, err := SessionServ.GetSessionWithOwnership(ctx, sessionID, GetUserFromRequest(r))
	if err != nil {
		writeJSONError(w, http.StatusNotFound, "Session not found")
		return
	}
	phase := session.EffectivePhase()

	voterID, guestUUID, rawGuestName := requestVoterID(w, r, "")

	questions, err := SessionServ.QuestionRepo.GetBySession(ctx, sessionID)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "Failed to load questions")
		return
	}
	if questions == nil {
		questions = []models.Question{}
	}

	allAnswers, err := AnswerRepo.GetBySession(ctx, sessionID)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "Failed to load answers")
		return
	}
	counts := make(map[string]int)
	for _, a := range allAnswers {
		counts[a.QuestionID]++
	}
	for i := range questions {
		questions[i].AnswerCount = counts[questions[i].ID]
	}

	qID := r.URL.Query().Get("question_id")
	shown := make([]models.Answer, 0, len(allAnswers))
	for _, a := range allAnswers {
		if qID == "" || a.QuestionID == qID {
			shown = append(shown, a)
		}
	}
	sort.Slice(shown, func(i, j int) bool { return shown[i].CreatedAt.Before(shown[j].CreatedAt) })

	guestName := resolveUniqueGuestNameForSession(ctx, sessionID, guestUUID, rawGuestName)
	voter, err := voterStatusPayload(ctx, sessionID, voterID, guestUUID, guestName)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "Failed to load voter status")
		return
	}

	// Optional presence heartbeat so clients only need this one request.
	if clientID := r.URL.Query().Get("client_id"); clientID != "" {
		role := "participant"
		if session.IsOwner {
			role = "moderator"
		}
		getOrCreatePresenceState(sessionID).UpdateParticipant(clientID, r.URL.Query().Get("name"), role)
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"session":        session,
		"questions":      questions,
		"answers":        applyAnswerVisibility(shown, phase, voterID),
		"voter_status":   voter,
		"vote_budget":    MaxVotesPerParticipant,
		"timer":          snapshotTimer(sessionID),
		"spotlight":      snapshotSpotlight(sessionID),
		"presence":       snapshotPresence(ctx, sessionID),
		"clusters":       computeClusters(allAnswers, phase),
		"server_time_ms": time.Now().UnixMilli(),
	})
}

// PreviousActionsHandler returns the open action items of the same owner's
// most recent earlier session ("Janji sesi lalu"). Readable by anyone who has
// the session id; ticking goes through the owner-only toggle endpoint.
func PreviousActionsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	sessionID := r.URL.Query().Get("session_id")
	if sessionID == "" {
		writeJSONError(w, http.StatusBadRequest, "session_id required")
		return
	}
	ctx := r.Context()

	current, err := SessionServ.SessionRepo.GetByID(ctx, sessionID)
	if err != nil || current == nil {
		writeJSONError(w, http.StatusNotFound, "Session not found")
		return
	}

	resp := map[string]interface{}{"session": nil, "items": []models.ActionItem{}}
	w.Header().Set("Content-Type", "application/json")

	if current.OwnerEmail == "" {
		json.NewEncoder(w).Encode(resp)
		return
	}
	owned, err := SessionServ.SessionRepo.GetByOwner(ctx, current.OwnerEmail)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "Failed to load sessions")
		return
	}

	// Most recent session created before this one.
	var prev *models.Session
	for i := range owned {
		s := &owned[i]
		if s.ID == sessionID {
			continue
		}
		if !current.CreatedAt.IsZero() && !s.CreatedAt.Before(current.CreatedAt) {
			continue
		}
		if prev == nil || s.CreatedAt.After(prev.CreatedAt) {
			prev = s
		}
	}
	if prev == nil {
		json.NewEncoder(w).Encode(resp)
		return
	}

	items, err := ActionItemRepo.GetBySession(ctx, prev.ID)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "Failed to load action items")
		return
	}
	open := []models.ActionItem{}
	for _, it := range items {
		if !it.Completed {
			open = append(open, it)
		}
	}
	resp["session"] = map[string]interface{}{
		"id":         prev.ID,
		"name":       prev.Name,
		"created_at": prev.CreatedAt,
	}
	resp["items"] = open
	json.NewEncoder(w).Encode(resp)
}
