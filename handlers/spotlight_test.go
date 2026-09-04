package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSpotlightHandlers(t *testing.T) {
	sessionID := "test-spotlight-session"

	// 1. GetSpotlight - Method Not Allowed
	t.Run("GetSpotlight_MethodNotAllowed", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/session/spotlight", nil)
		w := httptest.NewRecorder()
		GetSpotlightHandler(w, req)
		if w.Code != http.StatusMethodNotAllowed {
			t.Fatalf("expected 405, got %d", w.Code)
		}
	})

	// 2. GetSpotlight - Missing session_id
	t.Run("GetSpotlight_MissingSessionID", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/session/spotlight", nil)
		w := httptest.NewRecorder()
		GetSpotlightHandler(w, req)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", w.Code)
		}
	})

	// 3. GetSpotlight - Success (Initial inactive state)
	t.Run("GetSpotlight_InitialState", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/session/spotlight?session_id="+sessionID, nil)
		w := httptest.NewRecorder()
		GetSpotlightHandler(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}

		var st SessionSpotlightState
		if err := json.Unmarshal(w.Body.Bytes(), &st); err != nil {
			t.Fatalf("failed to decode spotlight state: %v", err)
		}
		if st.Active {
			t.Errorf("expected inactive initially, got active")
		}
		if st.SessionID != sessionID {
			t.Errorf("expected session_id %s, got %s", sessionID, st.SessionID)
		}
	})

	// 4. SpotlightAction - Method Not Allowed
	t.Run("SpotlightAction_MethodNotAllowed", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/session/spotlight/action", nil)
		w := httptest.NewRecorder()
		SpotlightActionHandler(w, req)
		if w.Code != http.StatusMethodNotAllowed {
			t.Fatalf("expected 405, got %d", w.Code)
		}
	})

	// 5. SpotlightAction - Invalid JSON
	t.Run("SpotlightAction_InvalidJSON", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/session/spotlight/action", bytes.NewReader([]byte("{invalid-json")))
		w := httptest.NewRecorder()
		SpotlightActionHandler(w, req)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", w.Code)
		}
	})

	// 6. SpotlightAction - Missing session_id
	t.Run("SpotlightAction_MissingSessionID", func(t *testing.T) {
		body, _ := json.Marshal(SpotlightActionRequest{
			SessionID: "",
			Action:    "focus",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/session/spotlight/action", bytes.NewReader(body))
		w := httptest.NewRecorder()
		SpotlightActionHandler(w, req)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", w.Code)
		}
	})

	// 7. SpotlightAction - Forbidden for unauthenticated/participant
	t.Run("SpotlightAction_ForbiddenForParticipant", func(t *testing.T) {
		body, _ := json.Marshal(SpotlightActionRequest{
			SessionID:  sessionID,
			Action:     "focus",
			QuestionID: "q-1",
			AnswerID:   "a-1",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/session/spotlight/action", bytes.NewReader(body))
		req.AddCookie(createTestAuthCookie("participant@example.com"))
		w := httptest.NewRecorder()
		SpotlightActionHandler(w, req)
		if w.Code != http.StatusForbidden {
			t.Fatalf("expected 403, got %d", w.Code)
		}
	})

	// 8. SpotlightAction - Invalid Action
	t.Run("SpotlightAction_InvalidAction", func(t *testing.T) {
		body, _ := json.Marshal(SpotlightActionRequest{
			SessionID: sessionID,
			Action:    "explode",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/session/spotlight/action", bytes.NewReader(body))
		req.AddCookie(createTestAuthCookie("moderator@example.com"))
		w := httptest.NewRecorder()
		SpotlightActionHandler(w, req)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", w.Code)
		}
	})

	// 9. SpotlightAction - Focus Success
	t.Run("SpotlightAction_FocusSuccess", func(t *testing.T) {
		body, _ := json.Marshal(SpotlightActionRequest{
			SessionID:  sessionID,
			Action:     "focus",
			QuestionID: "q-focus-1",
			AnswerID:   "a-focus-1",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/session/spotlight/action", bytes.NewReader(body))
		req.AddCookie(createTestAuthCookie("moderator@example.com"))
		w := httptest.NewRecorder()
		SpotlightActionHandler(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}

		var st SessionSpotlightState
		json.Unmarshal(w.Body.Bytes(), &st)
		if !st.Active || st.QuestionID != "q-focus-1" || st.AnswerID != "a-focus-1" {
			t.Fatalf("unexpected state after focus: %+v", st)
		}

		// Verify Get reflects this immediately
		getReq := httptest.NewRequest(http.MethodGet, "/api/session/spotlight?session_id="+sessionID, nil)
		getW := httptest.NewRecorder()
		GetSpotlightHandler(getW, getReq)
		var getSt SessionSpotlightState
		json.Unmarshal(getW.Body.Bytes(), &getSt)
		if !getSt.Active || getSt.AnswerID != "a-focus-1" {
			t.Fatalf("GetSpotlight did not reflect active state: %+v", getSt)
		}
	})

	// 10. SpotlightAction - Clear Success
	t.Run("SpotlightAction_ClearSuccess", func(t *testing.T) {
		body, _ := json.Marshal(SpotlightActionRequest{
			SessionID: sessionID,
			Action:    "clear",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/session/spotlight/action", bytes.NewReader(body))
		req.AddCookie(createTestAuthCookie("moderator@example.com"))
		w := httptest.NewRecorder()
		SpotlightActionHandler(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}

		var st SessionSpotlightState
		json.Unmarshal(w.Body.Bytes(), &st)
		if st.Active || st.AnswerID != "" || st.QuestionID != "" {
			t.Fatalf("unexpected state after clear: %+v", st)
		}
	})
}
