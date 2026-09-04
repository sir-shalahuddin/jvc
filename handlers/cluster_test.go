package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClusterHandlers(t *testing.T) {
	sessionID := "test-cluster-session"
	answerID := "test-cluster-answer-1"

	// 1. ClusterAnswer - Method Not Allowed
	t.Run("ClusterAnswer_MethodNotAllowed", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/answer/cluster", nil)
		w := httptest.NewRecorder()
		ClusterAnswerHandler(w, req)
		if w.Code != http.StatusMethodNotAllowed {
			t.Fatalf("expected 405, got %d", w.Code)
		}
	})

	// 2. ClusterAnswer - Invalid JSON
	t.Run("ClusterAnswer_InvalidJSON", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/answer/cluster", bytes.NewReader([]byte("{invalid-json")))
		w := httptest.NewRecorder()
		ClusterAnswerHandler(w, req)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", w.Code)
		}
	})

	// 3. ClusterAnswer - Missing fields
	t.Run("ClusterAnswer_MissingFields", func(t *testing.T) {
		body, _ := json.Marshal(ClusterAnswerRequest{
			SessionID: "",
			AnswerID:  answerID,
		})
		req := httptest.NewRequest(http.MethodPost, "/api/answer/cluster", bytes.NewReader(body))
		w := httptest.NewRecorder()
		ClusterAnswerHandler(w, req)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", w.Code)
		}
	})

	// 4. ClusterAnswer - Forbidden for Non-Moderator
	t.Run("ClusterAnswer_ForbiddenForNonModerator", func(t *testing.T) {
		body, _ := json.Marshal(ClusterAnswerRequest{
			SessionID:  sessionID,
			AnswerID:   answerID,
			ClusterTag: "CI/CD",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/answer/cluster", bytes.NewReader(body))
		req.AddCookie(createTestAuthCookie("participant@example.com"))
		w := httptest.NewRecorder()
		ClusterAnswerHandler(w, req)
		if w.Code != http.StatusForbidden {
			t.Fatalf("expected 403, got %d", w.Code)
		}
	})

	// 5. ClusterAnswer - Success (Moderator trims hash prefix)
	t.Run("ClusterAnswer_SuccessTrimsHash", func(t *testing.T) {
		body, _ := json.Marshal(ClusterAnswerRequest{
			SessionID:  sessionID,
			AnswerID:   answerID,
			ClusterTag: "  #Team Communication  ",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/answer/cluster", bytes.NewReader(body))
		req.AddCookie(createTestAuthCookie("moderator@example.com"))
		w := httptest.NewRecorder()
		ClusterAnswerHandler(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		if resp["cluster_tag"] != "Team Communication" {
			t.Errorf("expected cluster_tag 'Team Communication', got '%v'", resp["cluster_tag"])
		}
		if resp["status"] != "success" {
			t.Errorf("expected status success, got '%v'", resp["status"])
		}
	})

	// 6. ClusterAnswer - Clear Tag
	t.Run("ClusterAnswer_ClearTag", func(t *testing.T) {
		body, _ := json.Marshal(ClusterAnswerRequest{
			SessionID:  sessionID,
			AnswerID:   answerID,
			ClusterTag: "",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/answer/cluster", bytes.NewReader(body))
		req.AddCookie(createTestAuthCookie("moderator@example.com"))
		w := httptest.NewRecorder()
		ClusterAnswerHandler(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		if resp["cluster_tag"] != "" {
			t.Errorf("expected empty cluster_tag, got '%v'", resp["cluster_tag"])
		}
	})

	// 7. GetClusters - Method Not Allowed
	t.Run("GetClusters_MethodNotAllowed", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/session/clusters", nil)
		w := httptest.NewRecorder()
		GetClustersHandler(w, req)
		if w.Code != http.StatusMethodNotAllowed {
			t.Fatalf("expected 405, got %d", w.Code)
		}
	})

	// 8. GetClusters - Missing Session ID
	t.Run("GetClusters_MissingSessionID", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/session/clusters", nil)
		w := httptest.NewRecorder()
		GetClustersHandler(w, req)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", w.Code)
		}
	})

	// 9. GetClusters - Success
	t.Run("GetClusters_Success", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/session/clusters?session_id="+sessionID, nil)
		w := httptest.NewRecorder()
		GetClustersHandler(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
	})
}
