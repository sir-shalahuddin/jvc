package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"retro-gcp/config"
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

func TestSessionShareLinkHandler_MissingID(t *testing.T) {
	req, _ := http.NewRequest("GET", "/api/session/share-link", nil)
	rr := httptest.NewRecorder()

	SessionShareLinkHandler(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request, got %d", rr.Code)
	}
}

func TestSessionShareLinkHandler_SuccessWithMockShortener(t *testing.T) {
	// Create a mock Hanya.Click server
	mockHanyaClick := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/shorten" && r.Method == http.MethodPost {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			w.Write([]byte(`{"short_url":"https://hanya.click/retro123","short_key":"retro123","status":"created"}`))
			return
		}
		http.NotFound(w, r)
	}))
	defer mockHanyaClick.Close()

	// Configure AppConfig to point to mock server
	oldURL := config.AppConfig.ShortenLinkURL
	config.AppConfig.ShortenLinkURL = mockHanyaClick.URL
	defer func() { config.AppConfig.ShortenLinkURL = oldURL }()

	// Clear cache for this test ID
	testSessionID := "test-session-mock-abc"
	shortLinkCache.Delete(testSessionID)

	req, _ := http.NewRequest("GET", "/api/session/share-link?id="+testSessionID, nil)
	req.Host = "retro.example.com"
	rr := httptest.NewRecorder()

	SessionShareLinkHandler(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rr.Code)
	}

	var res ShareLinkResponse
	if err := json.NewDecoder(rr.Body).Decode(&res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if !res.IsShortened {
		t.Errorf("expected is_shortened to be true, got false")
	}
	if res.ShortURL != "https://hanya.click/retro123" {
		t.Errorf("expected short_url 'https://hanya.click/retro123', got %s", res.ShortURL)
	}

	// Test cache hit on second call
	rr2 := httptest.NewRecorder()
	SessionShareLinkHandler(rr2, req)
	var res2 ShareLinkResponse
	json.NewDecoder(rr2.Body).Decode(&res2)
	if res2.ShortURL != "https://hanya.click/retro123" || !res2.IsShortened {
		t.Errorf("cache hit failed: got %+v", res2)
	}
}

func TestSessionShareLinkHandler_FallbackWhenShortenerFails(t *testing.T) {
	// Point to an invalid unreachable address
	oldURL := config.AppConfig.ShortenLinkURL
	config.AppConfig.ShortenLinkURL = "http://127.0.0.1:54321/offline"
	defer func() { config.AppConfig.ShortenLinkURL = oldURL }()

	testSessionID := "test-session-fallback-xyz"
	shortLinkCache.Delete(testSessionID)

	req, _ := http.NewRequest("GET", "/api/session/share-link?id="+testSessionID, nil)
	req.Host = "retro.example.com"
	rr := httptest.NewRecorder()

	SessionShareLinkHandler(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK with fallback, got %d", rr.Code)
	}

	var res ShareLinkResponse
	if err := json.NewDecoder(rr.Body).Decode(&res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if res.IsShortened {
		t.Errorf("expected is_shortened to be false on fallback, got true")
	}
	expectedURL := "https://retro.example.com/session/?id=" + testSessionID
	if res.ShortURL != expectedURL {
		t.Errorf("expected fallback short_url %s, got %s", expectedURL, res.ShortURL)
	}
}
