package handlers

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCreatePaymentHandler_Unauthorized(t *testing.T) {
	req, _ := http.NewRequest("POST", "/api/payment/create", bytes.NewBuffer([]byte(`{"product_id": "starter"}`)))
	rr := httptest.NewRecorder()
	
	CreatePaymentHandler(rr, req)

	if status := rr.Code; status != http.StatusUnauthorized {
		t.Errorf("expected status 401, got %v", status)
	}
}

func TestPaymentCallbackHandler_InvalidBody(t *testing.T) {
	req, _ := http.NewRequest("POST", "/api/payment/callback", bytes.NewBuffer([]byte(`invalid-json`)))
	rr := httptest.NewRecorder()
	
	PaymentCallbackHandler(rr, req)

	// Should return 400 for invalid body
	if status := rr.Code; status != http.StatusBadRequest {
		t.Errorf("expected status 400, got %v", status)
	}
}

func TestPaymentCallbackHandler_InvalidSignature(t *testing.T) {
	// Duitku callback usually comes as Form data or JSON
	// Here we test with JSON but wrong signature
	jsonBody := `{"merchantCode":"DS30566","amount":"25000","merchantOrderId":"RETRO-123","signature":"wrong"}`
	req, _ := http.NewRequest("POST", "/api/payment/callback", bytes.NewBuffer([]byte(jsonBody)))
	rr := httptest.NewRecorder()
	
	PaymentCallbackHandler(rr, req)

	// Should return 400 due to invalid signature in ProcessDuitkuCallback
	if status := rr.Code; status != http.StatusBadRequest {
		t.Errorf("expected status 400, got %v", status)
	}
}
