package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"retro-gcp/models"
	"testing"
	"time"
)

func TestGetAnswersHandler_NoID(t *testing.T) {
	req, _ := http.NewRequest("GET", "/api/session/answers", nil)
	rr := httptest.NewRecorder()
	
	GetAnswersHandler(rr, req)

	if status := rr.Code; status != http.StatusBadRequest {
		t.Errorf("expected status 400, got %v", status)
	}
}

func TestSubmitAnswerHandler_BadPayload(t *testing.T) {
	req, _ := http.NewRequest("POST", "/api/answer/submit", bytes.NewBuffer([]byte(`{invalid-json}`)))
	rr := httptest.NewRecorder()
	
	SubmitAnswerHandler(rr, req)

	if status := rr.Code; status != http.StatusBadRequest {
		t.Errorf("expected status 400, got %v", status)
	}
}

type configurableMockAnswerRepo struct {
	mockAnswerRepo
	answers []models.Answer
	err     error
}

func (m *configurableMockAnswerRepo) GetBySession(ctx context.Context, sid string) ([]models.Answer, error) {
	return m.answers, m.err
}

func TestGetAnswersHandler_SuccessAndPagination(t *testing.T) {
	// 1. Setup test data with unsorted timestamps and different question IDs
	now := time.Now()
	testAnswers := []models.Answer{
		{ID: "ans-2", QuestionID: "q-1", CreatedAt: now.Add(1 * time.Second), Text: "Second Answer"},
		{ID: "ans-1", QuestionID: "q-1", CreatedAt: now, Text: "First Answer"},
		{ID: "ans-3", QuestionID: "q-2", CreatedAt: now.Add(2 * time.Second), Text: "Other Question Answer"},
	}

	// 2. Backup and mock AnswerRepo
	oldRepo := AnswerRepo
	defer func() { AnswerRepo = oldRepo }()
	
	AnswerRepo = &configurableMockAnswerRepo{
		answers: testAnswers,
	}

	// Test Case A: Get all answers, sorted by CreatedAt ascending
	{
		req, _ := http.NewRequest("GET", "/api/session/answers?session_id=session-1", nil)
		rr := httptest.NewRecorder()
		GetAnswersHandler(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d", rr.Code)
		}

		var resp []models.Answer
		json.Unmarshal(rr.Body.Bytes(), &resp)

		if len(resp) != 3 {
			t.Fatalf("expected 3 answers, got %d", len(resp))
		}
		// Verification: ans-1 (now) -> ans-2 (now+1s) -> ans-3 (now+2s)
		if resp[0].ID != "ans-1" || resp[1].ID != "ans-2" || resp[2].ID != "ans-3" {
			t.Errorf("expected sorting [ans-1, ans-2, ans-3], got [%s, %s, %s]", resp[0].ID, resp[1].ID, resp[2].ID)
		}
	}

	// Test Case B: Filter by question_id = q-1
	{
		req, _ := http.NewRequest("GET", "/api/session/answers?session_id=session-1&question_id=q-1", nil)
		rr := httptest.NewRecorder()
		GetAnswersHandler(rr, req)

		var resp []models.Answer
		json.Unmarshal(rr.Body.Bytes(), &resp)

		if len(resp) != 2 {
			t.Fatalf("expected 2 answers, got %d", len(resp))
		}
		if resp[0].ID != "ans-1" || resp[1].ID != "ans-2" {
			t.Errorf("expected [ans-1, ans-2], got [%s, %s]", resp[0].ID, resp[1].ID)
		}
	}

	// Test Case C: Filter by question_id = q-1 and limit = 1 (should return first sorted answer)
	{
		req, _ := http.NewRequest("GET", "/api/session/answers?session_id=session-1&question_id=q-1&limit=1", nil)
		rr := httptest.NewRecorder()
		GetAnswersHandler(rr, req)

		var resp []models.Answer
		json.Unmarshal(rr.Body.Bytes(), &resp)

		if len(resp) != 1 {
			t.Fatalf("expected 1 answer, got %d", len(resp))
		}
		if resp[0].ID != "ans-1" {
			t.Errorf("expected ans-1, got %s", resp[0].ID)
		}
	}

	// Test Case D: Filter by question_id = q-1, limit = 1, offset = 1 (should return second sorted answer)
	{
		req, _ := http.NewRequest("GET", "/api/session/answers?session_id=session-1&question_id=q-1&limit=1&offset=1", nil)
		rr := httptest.NewRecorder()
		GetAnswersHandler(rr, req)

		var resp []models.Answer
		json.Unmarshal(rr.Body.Bytes(), &resp)

		if len(resp) != 1 {
			t.Fatalf("expected 1 answer, got %d", len(resp))
		}
		if resp[0].ID != "ans-2" {
			t.Errorf("expected ans-2, got %s", resp[0].ID)
		}
	}
}
