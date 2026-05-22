package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"retro-gcp/dto"
	"retro-gcp/models"
	"sort"
	"strconv"
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

	// 1. Sort by CreatedAt ascending for consistent ordering
	sort.Slice(answers, func(i, j int) bool {
		return answers[i].CreatedAt.Before(answers[j].CreatedAt)
	})

	// 2. Filter by question_id if specified
	qID := r.URL.Query().Get("question_id")
	if qID != "" {
		var filtered []models.Answer
		for _, ans := range answers {
			if ans.QuestionID == qID {
				filtered = append(filtered, ans)
			}
		}
		answers = filtered
	}

	// 3. Handle Pagination (Limit / Offset)
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	var limit, offset int
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}
	if offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
	}

	if offset > 0 {
		if offset >= len(answers) {
			answers = []models.Answer{}
		} else {
			answers = answers[offset:]
		}
	}

	if limit > 0 && limit < len(answers) {
		answers = answers[:limit]
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(answers)
}
