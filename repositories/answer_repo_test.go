package repositories

import (
	"context"
	"retro-gcp/models"
	"testing"
	"time"
)

func TestAnswerRepository_CacheHit(t *testing.T) {
	repo := &AnswerRepository{}
	sessionID := "test-session-123"

	// 1. Manually set a cache entry
	expectedAnswers := []models.Answer{
		{
			ID:         "ans-1",
			SessionID:  sessionID,
			QuestionID: "q-1",
			Text:       "Hello world",
			CreatedAt:  time.Now(),
		},
	}
	repo.setCacheEntry(sessionID, expectedAnswers)

	// 2. Query the repo. Since it exists in the cache and is not expired,
	// it should return the cached answers directly without panicking or querying firestore.
	ctx := context.Background()
	answers, err := repo.GetBySession(ctx, sessionID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(answers) != 1 {
		t.Fatalf("expected 1 answer, got %d", len(answers))
	}

	if answers[0].ID != "ans-1" {
		t.Errorf("expected answer ID ans-1, got %s", answers[0].ID)
	}
}

func TestAnswerRepository_CacheExpiry(t *testing.T) {
	repo := &AnswerRepository{}
	sessionID := "test-session-456"

	// 1. Set an expired cache entry (updatedAt is more than 5 minutes ago)
	repo.mu.Lock()
	if repo.cache == nil {
		repo.cache = make(map[string]*cacheEntry)
	}
	repo.cache[sessionID] = &cacheEntry{
		answers: []models.Answer{
			{ID: "ans-old"},
		},
		updatedAt: time.Now().Add(-6 * time.Minute),
	}
	repo.mu.Unlock()

	// 2. Query the cache helper. It should return false due to expiration.
	_, ok := repo.getCacheEntry(sessionID)
	if ok {
		t.Error("expected cache miss due to expiration, but got cache hit")
	}
}

func TestAnswerRepository_AppendToCache(t *testing.T) {
	repo := &AnswerRepository{}
	sessionID := "test-session-789"

	// 1. Initialize cache with one answer
	answers := []models.Answer{{ID: "ans-1"}}
	repo.setCacheEntry(sessionID, answers)

	// 2. Append a new answer
	newAns := models.Answer{ID: "ans-2"}
	repo.appendToCache(sessionID, newAns)

	// 3. Verify they both exist in the cache
	cached, ok := repo.getCacheEntry(sessionID)
	if !ok {
		t.Fatal("expected cache hit")
	}

	if len(cached) != 2 {
		t.Fatalf("expected 2 answers in cache, got %d", len(cached))
	}
	if cached[1].ID != "ans-2" {
		t.Errorf("expected second answer to be ans-2, got %s", cached[1].ID)
	}
}

func TestAnswerRepository_UpdateSentimentInCache(t *testing.T) {
	repo := &AnswerRepository{}
	sessionID := "test-session-sentiment"

	// 1. Initialize cache
	answers := []models.Answer{
		{ID: "ans-1", SentimentEmotion: "Analyzing..."},
	}
	repo.setCacheEntry(sessionID, answers)

	// 2. Update sentiment in cache
	repo.updateSentimentInCache(sessionID, "ans-1", "Joy", "#00FF00", "😊")

	// 3. Retrieve and verify
	cached, ok := repo.getCacheEntry(sessionID)
	if !ok {
		t.Fatal("expected cache hit")
	}

	if cached[0].SentimentEmotion != "Joy" || cached[0].SentimentColor != "#00FF00" || cached[0].SentimentEmoji != "😊" {
		t.Errorf("sentiment not updated correctly in cache: %+v", cached[0])
	}
}
