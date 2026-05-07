package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGetQuestionsHandler_NoID(t *testing.T) {
	req, _ := http.NewRequest("GET", "/api/session/questions", nil)
	rr := httptest.NewRecorder()
	
	GetQuestionsHandler(rr, req)

	if status := rr.Code; status != http.StatusBadRequest {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusBadRequest)
	}
}
