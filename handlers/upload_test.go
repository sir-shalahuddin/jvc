package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestUploadHandler_MethodNotAllowed(t *testing.T) {
	req, _ := http.NewRequest("GET", "/api/upload", nil)
	rr := httptest.NewRecorder()
	
	UploadHandler(rr, req)

	if status := rr.Code; status != http.StatusMethodNotAllowed {
		t.Errorf("expected status 405, got %v", status)
	}
}
