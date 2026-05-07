package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAdminAPIHandler_Forbidden(t *testing.T) {
	req, _ := http.NewRequest("GET", "/api/admin/sessions", nil)
	rr := httptest.NewRecorder()
	
	// Admin email is hardcoded or from config. 
	// Since we don't have a token, it will be forbidden or unauthorized.
	AdminAPIHandler(rr, req)

	if status := rr.Code; status != http.StatusForbidden {
		t.Errorf("expected status 403, got %v", status)
	}
}
