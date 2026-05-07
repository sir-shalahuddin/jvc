package handlers

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGetAnswersHandler_NoID(t *testing.T) {
	req, _ := http.NewRequest("GET", "/api/session/answers", nil)
	rr := httptest.NewRecorder()
	
	// Actually I should just call the handler directly
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
