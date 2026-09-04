package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestTimerHandler_GetAndActions(t *testing.T) {
	sessionID := "test-session-timer-123"

	// 1. Get initial timer state
	req, _ := http.NewRequest("GET", "/api/session/timer?session_id="+sessionID, nil)
	rr := httptest.NewRecorder()
	GetTimerHandler(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Fatalf("expected status 200, got %d", status)
	}

	var state SessionTimerState
	json.Unmarshal(rr.Body.Bytes(), &state)
	if state.Running {
		t.Errorf("expected timer not running initially")
	}

	// 2. Unauthenticated timer action must be forbidden (403)
	startPayload := []byte(`{"session_id":"` + sessionID + `","action":"start","seconds":180}`)
	req, _ = http.NewRequest("POST", "/api/session/timer/action", bytes.NewBuffer(startPayload))
	rr = httptest.NewRecorder()
	TimerActionHandler(rr, req)
	if status := rr.Code; status != http.StatusForbidden {
		t.Fatalf("expected status 403 for unauthenticated timer action, got %d", status)
	}

	// 3. Authenticated moderator starts timer for 180 seconds (3 minutes)
	req, _ = http.NewRequest("POST", "/api/session/timer/action", bytes.NewBuffer(startPayload))
	req.AddCookie(createTestAuthCookie("moderator@example.com"))
	rr = httptest.NewRecorder()
	TimerActionHandler(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Fatalf("expected status 200, got %d", status)
	}

	json.Unmarshal(rr.Body.Bytes(), &state)
	if !state.Running || state.RemainingSeconds != 180 {
		t.Errorf("expected timer running with 180s, got running=%v, rem=%d", state.Running, state.RemainingSeconds)
	}

	// 4. Authenticated moderator resets timer
	resetPayload := []byte(`{"session_id":"` + sessionID + `","action":"reset","seconds":300}`)
	req, _ = http.NewRequest("POST", "/api/session/timer/action", bytes.NewBuffer(resetPayload))
	req.AddCookie(createTestAuthCookie("moderator@example.com"))
	rr = httptest.NewRecorder()
	TimerActionHandler(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Fatalf("expected status 200, got %d", status)
	}

	json.Unmarshal(rr.Body.Bytes(), &state)
	if state.Running || state.RemainingSeconds != 300 {
		t.Errorf("expected timer stopped with 300s, got running=%v, rem=%d", state.Running, state.RemainingSeconds)
	}
}
