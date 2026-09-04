package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"retro-gcp/models"
	"testing"
)

func TestPresenceHandler_NoSessionID(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/session/presence", nil)
	rr := httptest.NewRecorder()

	PresenceHandler(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}
}

func TestPresenceHandler_HeartbeatAndLeave(t *testing.T) {
	sid := "test-presence-session-1"

	// 1. Participant A joins
	pA := PresenceRequest{
		SessionID: sid,
		ClientID:  "client-1",
		Name:      "Clever Fox",
		Role:      "participant",
	}
	body, _ := json.Marshal(pA)
	req := httptest.NewRequest("POST", "/api/session/presence", bytes.NewReader(body))
	rr := httptest.NewRecorder()

	PresenceHandler(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var resp PresenceResponse
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp.Count != 1 {
		t.Errorf("expected count 1, got %d", resp.Count)
	}
	if len(resp.Participants) != 1 || resp.Participants[0].Name != "Clever Fox" {
		t.Errorf("unexpected participants: %+v", resp.Participants)
	}

	// 2. Moderator joins
	pMod := PresenceRequest{
		SessionID: sid,
		ClientID:  "client-mod",
		Name:      "Scrum Master",
		Role:      "moderator",
	}
	bodyMod, _ := json.Marshal(pMod)
	reqMod := httptest.NewRequest("POST", "/api/session/presence", bytes.NewReader(bodyMod))
	rrMod := httptest.NewRecorder()

	PresenceHandler(rrMod, reqMod)
	var respMod PresenceResponse
	json.NewDecoder(rrMod.Body).Decode(&respMod)

	if respMod.Count != 2 {
		t.Errorf("expected count 2, got %d", respMod.Count)
	}
	// Moderator should be sorted first
	if respMod.Participants[0].Role != "moderator" {
		t.Errorf("expected moderator first, got %+v", respMod.Participants[0])
	}

	// 3. Participant A leaves via PresenceLeaveHandler
	leaveReq := PresenceRequest{
		SessionID: sid,
		ClientID:  "client-1",
	}
	bodyLeave, _ := json.Marshal(leaveReq)
	reqLeave := httptest.NewRequest("POST", "/api/session/presence/leave", bytes.NewReader(bodyLeave))
	rrLeave := httptest.NewRecorder()

	PresenceLeaveHandler(rrLeave, reqLeave)
	if rrLeave.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rrLeave.Code)
	}

	// 4. Query presence via GET
	reqGet := httptest.NewRequest("GET", "/api/session/presence?session_id="+sid, nil)
	rrGet := httptest.NewRecorder()
	PresenceHandler(rrGet, reqGet)

	var respGet PresenceResponse
	json.NewDecoder(rrGet.Body).Decode(&respGet)
	if respGet.Count != 1 {
		t.Errorf("expected count 1 after leave, got %d", respGet.Count)
	}
	if respGet.Participants[0].ClientID() != "client-mod" && respGet.Participants[0].ID != "client-mod" {
		t.Errorf("expected only moderator to remain, got %+v", respGet.Participants)
	}
}

func (p ParticipantPresence) ClientID() string {
	return p.ID
}

type presenceMockAnswerRepo struct {
	mockAnswerRepo
	answers []models.Answer
}

func (m *presenceMockAnswerRepo) GetBySession(ctx context.Context, sid string) ([]models.Answer, error) {
	return m.answers, nil
}

func TestPresenceHandler_TopicCounts(t *testing.T) {
	sid := "test-topic-counts-session"
	oldRepo := AnswerRepo
	defer func() { AnswerRepo = oldRepo }()

	AnswerRepo = &presenceMockAnswerRepo{
		answers: []models.Answer{
			{ID: "a1", SessionID: sid, QuestionID: "q1"},
			{ID: "a2", SessionID: sid, QuestionID: "q1"},
			{ID: "a3", SessionID: sid, QuestionID: "q2"},
		},
	}

	req := httptest.NewRequest("GET", "/api/session/presence?session_id="+sid, nil)
	rr := httptest.NewRecorder()
	PresenceHandler(rr, req)

	var resp PresenceResponse
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp.TopicCounts["q1"] != 2 {
		t.Errorf("expected q1 count 2, got %d", resp.TopicCounts["q1"])
	}
	if resp.TopicCounts["q2"] != 1 {
		t.Errorf("expected q2 count 1, got %d", resp.TopicCounts["q2"])
	}
	if resp.TopicCounts["q3"] != 0 {
		t.Errorf("expected q3 count 0, got %d", resp.TopicCounts["q3"])
	}
}
