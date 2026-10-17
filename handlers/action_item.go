package handlers

import (
	"encoding/json"
	"net/http"
	"retro-gcp/models"
	"retro-gcp/repositories"
	"strings"
	"time"

	"github.com/google/uuid"
)

var ActionItemRepo repositories.IActionItemRepository

type AddActionItemRequest struct {
	SessionID string `json:"session_id"`
	AnswerID  string `json:"answer_id,omitempty"`
	Text      string `json:"text"`
	Assignee  string `json:"assignee"`
	DueDate   string `json:"due_date"`
}

type ToggleActionItemRequest struct {
	SessionID string `json:"session_id"`
	ID        string `json:"id"`
	Completed bool   `json:"completed"`
}

type DeleteActionItemRequest struct {
	SessionID string `json:"session_id"`
	ID        string `json:"id"`
}

// writeJSONError writes a JSON error body: {"error": msg}.
func writeJSONError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// requireLoggedIn returns the logged-in email, or writes 401 and returns "".
func requireLoggedIn(w http.ResponseWriter, r *http.Request) string {
	email := GetUserFromRequest(r)
	if email == "" {
		writeJSONError(w, http.StatusUnauthorized, "Unauthorized")
	}
	return email
}

// requireSessionOwner checks that email owns the session; otherwise writes 403.
func requireSessionOwner(w http.ResponseWriter, r *http.Request, email, sessionID string) bool {
	session, err := SessionServ.SessionRepo.GetByID(r.Context(), sessionID)
	if err != nil || session == nil || session.OwnerEmail != email {
		writeJSONError(w, http.StatusForbidden, "Forbidden: only the session owner can do this")
		return false
	}
	return true
}

// actionItemInSession reports whether item id belongs to the session.
func actionItemInSession(r *http.Request, sessionID, id string) (bool, error) {
	items, err := ActionItemRepo.GetBySession(r.Context(), sessionID)
	if err != nil {
		return false, err
	}
	for _, it := range items {
		if it.ID == id && it.SessionID == sessionID {
			return true, nil
		}
	}
	return false, nil
}

func GetActionItemsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	sessionID := r.URL.Query().Get("session_id")
	if sessionID == "" {
		http.Error(w, "session_id required", http.StatusBadRequest)
		return
	}

	items, err := ActionItemRepo.GetBySession(r.Context(), sessionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

func AddActionItemHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	email := requireLoggedIn(w, r)
	if email == "" {
		return
	}

	var req AddActionItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.SessionID) == "" || strings.TrimSpace(req.Text) == "" {
		http.Error(w, "session_id and text are required", http.StatusBadRequest)
		return
	}

	if !requireSessionOwner(w, r, email, req.SessionID) {
		return
	}

	assignee := strings.TrimSpace(req.Assignee)
	if assignee == "" {
		assignee = "Unassigned"
	}

	dueDate := strings.TrimSpace(req.DueDate)
	if dueDate == "" {
		dueDate = "Next Sprint"
	}

	item := models.ActionItem{
		ID:        uuid.New().String(),
		SessionID: req.SessionID,
		AnswerID:  req.AnswerID,
		Text:      strings.TrimSpace(req.Text),
		Assignee:  assignee,
		DueDate:   dueDate,
		Completed: false,
		CreatedAt: time.Now(),
	}

	if err := ActionItemRepo.Create(r.Context(), req.SessionID, item); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(item)
}

func ToggleActionItemHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	email := requireLoggedIn(w, r)
	if email == "" {
		return
	}

	var req ToggleActionItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.SessionID == "" || req.ID == "" {
		http.Error(w, "session_id and id are required", http.StatusBadRequest)
		return
	}

	if !requireSessionOwner(w, r, email, req.SessionID) {
		return
	}

	found, err := actionItemInSession(r, req.SessionID, req.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if !found {
		http.Error(w, "Action item not found in this session", http.StatusNotFound)
		return
	}

	if err := ActionItemRepo.Toggle(r.Context(), req.SessionID, req.ID, req.Completed); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "success",
		"id":        req.ID,
		"completed": req.Completed,
	})
}

func DeleteActionItemHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	email := requireLoggedIn(w, r)
	if email == "" {
		return
	}

	var req DeleteActionItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.SessionID == "" || req.ID == "" {
		http.Error(w, "session_id and id are required", http.StatusBadRequest)
		return
	}

	if !requireSessionOwner(w, r, email, req.SessionID) {
		return
	}

	found, err := actionItemInSession(r, req.SessionID, req.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if !found {
		http.Error(w, "Action item not found in this session", http.StatusNotFound)
		return
	}

	if err := ActionItemRepo.Delete(r.Context(), req.SessionID, req.ID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"id":     req.ID,
	})
}
