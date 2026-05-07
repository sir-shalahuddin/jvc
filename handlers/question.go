package handlers

import (
	"encoding/json"
	"net/http"
	"retro-gcp/dto"
	"retro-gcp/models"
	"time"

	"github.com/google/uuid"
)

func GetQuestionsHandler(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("session_id")
	if sessionID == "" {
		http.Error(w, "session_id required", http.StatusBadRequest)
		return
	}

	questions, err := SessionServ.QuestionRepo.GetBySession(r.Context(), sessionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(questions)
}

func AddQuestionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req dto.AddQuestionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	qID := uuid.New().String()
	q := models.Question{
		ID:        qID,
		SessionID: req.SessionID,
		Text:      req.Text,
		Type:      "custom",
		GifURL:    req.GifURL,
		CreatedAt: time.Now(),
	}

	if err := SessionServ.QuestionRepo.Create(r.Context(), req.SessionID, q); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"id": qID, "status": "success"})
}

func UpdateQuestionHandler(w http.ResponseWriter, r *http.Request) {
	var req dto.UpdateQuestionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	if err := SessionServ.QuestionRepo.Update(r.Context(), req.SessionID, req.ID, req.Text, req.GifURL); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func DeleteQuestionHandler(w http.ResponseWriter, r *http.Request) {
	var req dto.DeleteQuestionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	if err := SessionServ.QuestionRepo.Delete(r.Context(), req.SessionID, req.ID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}
