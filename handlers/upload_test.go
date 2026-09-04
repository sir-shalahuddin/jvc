package handlers

import (
	"bytes"
	"mime/multipart"
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

func TestUploadHandler_Unauthorized(t *testing.T) {
	req, _ := http.NewRequest("POST", "/api/upload", nil)
	rr := httptest.NewRecorder()
	
	UploadHandler(rr, req)

	if status := rr.Code; status != http.StatusUnauthorized {
		t.Errorf("expected status 401 Unauthorized for unauthenticated upload, got %v", status)
	}
}

func TestUploadHandler_DisallowedFileType(t *testing.T) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, _ := writer.CreateFormFile("image", "malicious.html")
	part.Write([]byte("<script>alert('xss')</script>"))
	writer.Close()

	req, _ := http.NewRequest("POST", "/api/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.AddCookie(createTestAuthCookie("user@example.com"))
	rr := httptest.NewRecorder()

	UploadHandler(rr, req)

	if status := rr.Code; status != http.StatusBadRequest {
		t.Errorf("expected status 400 Bad Request for disallowed file type, got %v", status)
	}
}
