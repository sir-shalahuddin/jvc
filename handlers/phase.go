package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"retro-gcp/models"
)

type SetPhaseRequest struct {
	SessionID string `json:"session_id"`
	Phase     string `json:"phase"`
}

// SetPhaseHandler lets the session owner move the session to any valid phase
// (forward or back).
func SetPhaseHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	email := requireLoggedIn(w, r)
	if email == "" {
		return
	}

	var req SetPhaseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.SessionID == "" {
		writeJSONError(w, http.StatusBadRequest, "session_id required")
		return
	}
	if !models.IsValidPhase(req.Phase) {
		writeJSONError(w, http.StatusBadRequest, "Invalid phase: must be one of write, discuss, done")
		return
	}
	if !requireSessionOwner(w, r, email, req.SessionID) {
		return
	}

	if err := SessionServ.SessionRepo.UpdatePhase(r.Context(), req.SessionID, req.Phase); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "Failed to update phase")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":     "success",
		"session_id": req.SessionID,
		"phase":      req.Phase,
	})
}

// sessionPhase loads the session and returns its effective phase.
func sessionPhase(ctx context.Context, sessionID string) (*models.Session, string, error) {
	session, err := SessionServ.SessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return nil, "", err
	}
	return session, session.EffectivePhase(), nil
}

// requirePhase writes 404 (unknown session) or 409 (wrong phase) and returns
// false unless the session's phase is one of allowed.
func requirePhase(w http.ResponseWriter, r *http.Request, sessionID string, allowed ...string) bool {
	_, phase, err := sessionPhase(r.Context(), sessionID)
	if err != nil {
		writeJSONError(w, http.StatusNotFound, "Session not found")
		return false
	}
	for _, a := range allowed {
		if a == phase {
			return true
		}
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusConflict)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"error":   "Not allowed in the current phase",
		"phase":   phase,
		"allowed": allowed,
	})
	return false
}

// HiddenAnswer is what other people's cards look like while the session is in
// the write phase: no text, gif, author or sentiment.
type HiddenAnswer struct {
	ID         string `json:"id"`
	QuestionID string `json:"question_id"`
	Hidden     bool   `json:"hidden"`
}

// applyAnswerVisibility implements the write-phase hiding rule. Outside write
// every card is returned in full. In write only the requester's own cards
// (author_id == voterID) are full; everything else, including old answers
// without author_id and cards of the owner, is hidden.
func applyAnswerVisibility(answers []models.Answer, phase, voterID string) []interface{} {
	out := make([]interface{}, 0, len(answers))
	for _, a := range answers {
		if phase == models.PhaseWrite && (a.AuthorID == "" || a.AuthorID != voterID) {
			out = append(out, HiddenAnswer{ID: a.ID, QuestionID: a.QuestionID, Hidden: true})
			continue
		}
		out = append(out, a)
	}
	return out
}

// requestVoterID resolves the effective voter id of the caller. The client
// identifies itself with the same device fingerprint it sends when voting
// (body device_fingerprint/voter_id, X-Device-Fingerprint header, or query
// device_fingerprint/voter_id); without one the signed guest cookie is used.
func requestVoterID(w http.ResponseWriter, r *http.Request, bodyFP string) (voterID, guestUUID, guestName string) {
	fp := extractDeviceFingerprint(r, bodyFP)
	if fp == "" {
		fp = r.URL.Query().Get("voter_id")
	}
	guestUUID, guestName = getOrCreateSignedGuestToken(w, r, fp)
	return computeEffectiveVoterID(guestUUID, fp), guestUUID, guestName
}
