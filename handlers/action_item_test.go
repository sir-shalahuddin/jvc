package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"retro-gcp/models"
	"testing"
)

func TestActionItemsHandlers(t *testing.T) {
	sessionID := "test-action-session"

	// 1. GetActionItems - missing session_id
	t.Run("GetActionItems_MissingSessionID", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/action-items/get", nil)
		w := httptest.NewRecorder()
		GetActionItemsHandler(w, req)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", w.Code)
		}
	})

	// 2. AddActionItem - invalid method
	t.Run("AddActionItem_MethodNotAllowed", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/action-items/add", nil)
		w := httptest.NewRecorder()
		AddActionItemHandler(w, req)
		if w.Code != http.StatusMethodNotAllowed {
			t.Fatalf("expected 405, got %d", w.Code)
		}
	})

	// 3. AddActionItem - empty payload
	t.Run("AddActionItem_EmptyText", func(t *testing.T) {
		body, _ := json.Marshal(AddActionItemRequest{
			SessionID: sessionID,
			Text:      "",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/action-items/add", bytes.NewReader(body))
		req.AddCookie(createTestAuthCookie("moderator@example.com"))
		w := httptest.NewRecorder()
		AddActionItemHandler(w, req)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", w.Code)
		}
	})

	var createdItemID string

	// 4. AddActionItem - Success
	t.Run("AddActionItem_Success", func(t *testing.T) {
		body, _ := json.Marshal(AddActionItemRequest{
			SessionID: sessionID,
			Text:      "Refactor CI/CD pipeline",
			Assignee:  "DevOps Team",
			DueDate:   "Next Sprint",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/action-items/add", bytes.NewReader(body))
		req.AddCookie(createTestAuthCookie("moderator@example.com"))
		w := httptest.NewRecorder()
		AddActionItemHandler(w, req)

		if w.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d", w.Code)
		}

		var item models.ActionItem
		if err := json.NewDecoder(w.Body).Decode(&item); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if item.Text != "Refactor CI/CD pipeline" || item.Assignee != "DevOps Team" {
			t.Fatalf("unexpected item data: %+v", item)
		}
		if item.Completed {
			t.Fatalf("expected completed to be false")
		}
		createdItemID = item.ID
	})

	// 5. GetActionItems - Success
	t.Run("GetActionItems_Success", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/action-items/get?session_id="+sessionID, nil)
		w := httptest.NewRecorder()
		GetActionItemsHandler(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}

		var items []models.ActionItem
		if err := json.NewDecoder(w.Body).Decode(&items); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if len(items) == 0 {
			t.Fatalf("expected at least 1 action item")
		}
	})

	// 6. ToggleActionItem - Success
	t.Run("ToggleActionItem_Success", func(t *testing.T) {
		body, _ := json.Marshal(ToggleActionItemRequest{
			SessionID: sessionID,
			ID:        createdItemID,
			Completed: true,
		})
		req := httptest.NewRequest(http.MethodPost, "/api/action-items/toggle", bytes.NewReader(body))
		req.AddCookie(createTestAuthCookie("moderator@example.com"))
		w := httptest.NewRecorder()
		ToggleActionItemHandler(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
	})

	// 7. DeleteActionItem - Success
	t.Run("DeleteActionItem_Success", func(t *testing.T) {
		body, _ := json.Marshal(DeleteActionItemRequest{
			SessionID: sessionID,
			ID:        createdItemID,
		})
		req := httptest.NewRequest(http.MethodPost, "/api/action-items/delete", bytes.NewReader(body))
		req.AddCookie(createTestAuthCookie("moderator@example.com"))
		w := httptest.NewRecorder()
		DeleteActionItemHandler(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
	})
}

func postAI(h http.HandlerFunc, path string, payload interface{}, email string) *httptest.ResponseRecorder {
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(body))
	if email != "" {
		req.AddCookie(createTestAuthCookie(email))
	}
	w := httptest.NewRecorder()
	h(w, req)
	return w
}

func TestActionItemAuthorization(t *testing.T) {
	const owner = "moderator@example.com"
	const other = "participant@example.com"

	mk := func(sid string) string {
		w := postAI(AddActionItemHandler, "/api/action-items/add", AddActionItemRequest{SessionID: sid, Text: "x"}, owner)
		if w.Code != http.StatusCreated {
			t.Fatalf("setup add failed: %d", w.Code)
		}
		var it models.ActionItem
		json.NewDecoder(w.Body).Decode(&it)
		return it.ID
	}

	t.Run("Add", func(t *testing.T) {
		p := AddActionItemRequest{SessionID: "auth-s1", Text: "x"}
		if c := postAI(AddActionItemHandler, "/api/action-items/add", p, "").Code; c != http.StatusUnauthorized {
			t.Errorf("unauth: expected 401, got %d", c)
		}
		if c := postAI(AddActionItemHandler, "/api/action-items/add", p, other).Code; c != http.StatusForbidden {
			t.Errorf("non-owner: expected 403, got %d", c)
		}
		w := postAI(AddActionItemHandler, "/api/action-items/add", p, owner)
		if w.Code != http.StatusCreated {
			t.Errorf("owner: expected 201, got %d", w.Code)
		}
	})

	t.Run("Toggle", func(t *testing.T) {
		id := mk("auth-s2")
		p := ToggleActionItemRequest{SessionID: "auth-s2", ID: id, Completed: true}
		if c := postAI(ToggleActionItemHandler, "/api/action-items/toggle", p, "").Code; c != http.StatusUnauthorized {
			t.Errorf("unauth: expected 401, got %d", c)
		}
		w := postAI(ToggleActionItemHandler, "/api/action-items/toggle", p, other)
		if w.Code != http.StatusForbidden {
			t.Errorf("non-owner: expected 403, got %d", w.Code)
		}
		var e map[string]string
		json.Unmarshal(w.Body.Bytes(), &e)
		if e["error"] == "" {
			t.Errorf("expected JSON error body, got %q", w.Body.String())
		}
		if c := postAI(ToggleActionItemHandler, "/api/action-items/toggle", p, owner).Code; c != http.StatusOK {
			t.Errorf("owner: expected 200, got %d", c)
		}
	})

	t.Run("Delete", func(t *testing.T) {
		id := mk("auth-s3")
		p := DeleteActionItemRequest{SessionID: "auth-s3", ID: id}
		if c := postAI(DeleteActionItemHandler, "/api/action-items/delete", p, "").Code; c != http.StatusUnauthorized {
			t.Errorf("unauth: expected 401, got %d", c)
		}
		if c := postAI(DeleteActionItemHandler, "/api/action-items/delete", p, other).Code; c != http.StatusForbidden {
			t.Errorf("non-owner: expected 403, got %d", c)
		}
		if c := postAI(DeleteActionItemHandler, "/api/action-items/delete", p, owner).Code; c != http.StatusOK {
			t.Errorf("owner: expected 200, got %d", c)
		}
	})

	t.Run("CrossSessionRejected", func(t *testing.T) {
		id := mk("auth-sA")
		tp := ToggleActionItemRequest{SessionID: "auth-sB", ID: id, Completed: true}
		if c := postAI(ToggleActionItemHandler, "/api/action-items/toggle", tp, owner).Code; c != http.StatusNotFound {
			t.Errorf("toggle cross-session: expected 404, got %d", c)
		}
		dp := DeleteActionItemRequest{SessionID: "auth-sB", ID: id}
		if c := postAI(DeleteActionItemHandler, "/api/action-items/delete", dp, owner).Code; c != http.StatusNotFound {
			t.Errorf("delete cross-session: expected 404, got %d", c)
		}
		items, _ := ActionItemRepo.GetBySession(context.Background(), "auth-sA")
		if len(items) != 1 || items[0].Completed {
			t.Errorf("item in original session was modified: %+v", items)
		}
	})
}
