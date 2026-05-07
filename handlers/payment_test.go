package handlers

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestTrakteerWebhookHandler_Unauthorized(t *testing.T) {
	req, _ := http.NewRequest("POST", "/api/webhook/trakteer", bytes.NewBuffer([]byte(`{}`)))
	rr := httptest.NewRecorder()
	
	TrakteerWebhookHandler(rr, req)

	// Since we check for X-Webhook-Token, it should return 401 if not provided
	if status := rr.Code; status != http.StatusUnauthorized {
		t.Errorf("expected status 401, got %v", status)
	}
}

func TestClaimTopupHandler_Unauthorized(t *testing.T) {
	req, _ := http.NewRequest("POST", "/api/topup/claim", bytes.NewBuffer([]byte(`{}`)))
	rr := httptest.NewRecorder()
	
	ClaimTopupHandler(rr, req)

	if status := rr.Code; status != http.StatusUnauthorized {
		t.Errorf("expected status 401, got %v", status)
	}
}
