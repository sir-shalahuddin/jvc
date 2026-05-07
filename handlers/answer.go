package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"retro-gcp/dto"
	"retro-gcp/models"
	"time"

	"github.com/google/uuid"
	"github.com/microcosm-cc/bluemonday"
)

type IAnswerRepository interface {
	Create(ctx context.Context, sessionID string, a models.Answer) error
	GetBySession(ctx context.Context, sessionID string) ([]models.Answer, error)
	UpdateSentiment(ctx context.Context, sessionID string, answerID string, emotion, color, emoji string) error
}

var AnswerRepo IAnswerRepository

func SubmitAnswerHandler(w http.ResponseWriter, r *http.Request) {
	var req dto.SubmitAnswerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	p := bluemonday.UGCPolicy()
	sanitizedText := p.Sanitize(req.Text)

	ansID := uuid.New().String()
	ans := models.Answer{
		ID:               ansID,
		QuestionID:       req.QuestionID,
		SessionID:        req.SessionID,
		Text:             sanitizedText,
		GifURL:           req.GifURL,
		AuthorName:       req.AuthorName,
		SentimentEmotion: "Analyzing...",
		SentimentColor:   "#9CA3AF",
		SentimentEmoji:   "⏳",
		CreatedAt:        time.Now(),
	}

	if err := AnswerRepo.Create(r.Context(), req.SessionID, ans); err != nil {
		log.Printf("Repo Error: %v", err)
		http.Error(w, "Error saving answer", http.StatusInternalServerError)
		return
	}

	QueueSentimentAnalysis(ansID, req.SessionID, sanitizedText)

	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]interface{}{"id": ansID, "status": "success"})
}

func GetAnswersHandler(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("session_id")
	if sessionID == "" {
		http.Error(w, "session_id required", http.StatusBadRequest)
		return
	}

	answers, err := AnswerRepo.GetBySession(r.Context(), sessionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(answers)
}
