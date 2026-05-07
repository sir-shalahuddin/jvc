package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHistoryAPIHandler_Unauthorized(t *testing.T) {
	req, _ := http.NewRequest("GET", "/api/history", nil)
	rr := httptest.NewRecorder()
	
	HistoryAPIHandler(rr, req)

	if status := rr.Code; status != http.StatusUnauthorized {
		t.Errorf("expected status 401, got %v", status)
	}
}
