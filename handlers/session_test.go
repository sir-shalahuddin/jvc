package handlers

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"retro-gcp/models"
	"testing"
)

type mockSessionService struct {
	CreateSessionFunc func(ctx context.Context, email string, name string) (*models.Session, error)
}

// We need to implement the same interface or use the service struct with mocks.
// For simplicity, let's just mock the HTTP call logic.

func TestCreateSessionHandler_Unauthorized(t *testing.T) {
	req, _ := http.NewRequest("POST", "/api/session/create", bytes.NewBuffer([]byte(`{"name":"Test"}`)))
	rr := httptest.NewRecorder()
	
	CreateSessionHandler(rr, req)

	if status := rr.Code; status != http.StatusUnauthorized {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusUnauthorized)
	}
}
