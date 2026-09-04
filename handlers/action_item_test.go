package handlers

import (
	"bytes"
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
		w := httptest.NewRecorder()
		DeleteActionItemHandler(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
	})
}
