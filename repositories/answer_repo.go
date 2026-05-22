package repositories

import (
	"context"
	"retro-gcp/db"
	"retro-gcp/models"
	"sync"
	"time"

	"cloud.google.com/go/firestore"
	"golang.org/x/sync/singleflight"
	"google.golang.org/api/iterator"
)

type cacheEntry struct {
	answers   []models.Answer
	updatedAt time.Time
}

type AnswerRepository struct {
	mu    sync.RWMutex
	cache map[string]*cacheEntry
	sf    singleflight.Group
}

func (r *AnswerRepository) getCacheEntry(sessionID string) ([]models.Answer, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.cache == nil {
		return nil, false
	}
	entry, ok := r.cache[sessionID]
	if !ok {
		return nil, false
	}
	if time.Since(entry.updatedAt) > 5*time.Minute {
		return nil, false
	}
	answersCopy := make([]models.Answer, len(entry.answers))
	copy(answersCopy, entry.answers)
	return answersCopy, true
}

func (r *AnswerRepository) setCacheEntry(sessionID string, answers []models.Answer) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.cache == nil {
		r.cache = make(map[string]*cacheEntry)
	}
	answersCopy := make([]models.Answer, len(answers))
	copy(answersCopy, answers)
	r.cache[sessionID] = &cacheEntry{
		answers:   answersCopy,
		updatedAt: time.Now(),
	}
}

func (r *AnswerRepository) appendToCache(sessionID string, a models.Answer) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.cache == nil {
		return
	}
	entry, ok := r.cache[sessionID]
	if !ok || time.Since(entry.updatedAt) > 5*time.Minute {
		return
	}
	entry.answers = append(entry.answers, a)
	entry.updatedAt = time.Now()
}

func (r *AnswerRepository) updateSentimentInCache(sessionID string, answerID string, emotion, color, emoji string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.cache == nil {
		return
	}
	entry, ok := r.cache[sessionID]
	if !ok || time.Since(entry.updatedAt) > 5*time.Minute {
		return
	}
	for i, ans := range entry.answers {
		if ans.ID == answerID {
			entry.answers[i].SentimentEmotion = emotion
			entry.answers[i].SentimentColor = color
			entry.answers[i].SentimentEmoji = emoji
			entry.updatedAt = time.Now()
			break
		}
	}
}

func (r *AnswerRepository) Create(ctx context.Context, sessionID string, a models.Answer) error {
	_, err := db.Client.Collection("sessions").Doc(sessionID).Collection("answers").Doc(a.ID).Set(ctx, a)
	if err == nil {
		r.appendToCache(sessionID, a)
	}
	return err
}

func (r *AnswerRepository) GetBySession(ctx context.Context, sessionID string) ([]models.Answer, error) {
	if answers, ok := r.getCacheEntry(sessionID); ok {
		return answers, nil
	}

	val, err, _ := r.sf.Do(sessionID, func() (interface{}, error) {
		if answers, ok := r.getCacheEntry(sessionID); ok {
			return answers, nil
		}

		iter := db.Client.Collection("sessions").Doc(sessionID).Collection("answers").Documents(ctx)
		var answers []models.Answer
		for {
			doc, err := iter.Next()
			if err == iterator.Done {
				break
			}
			if err != nil {
				return nil, err
			}
			var a models.Answer
			doc.DataTo(&a)
			answers = append(answers, a)
		}

		r.setCacheEntry(sessionID, answers)
		return answers, nil
	})

	if err != nil {
		return nil, err
	}

	answers := val.([]models.Answer)
	answersCopy := make([]models.Answer, len(answers))
	copy(answersCopy, answers)
	return answersCopy, nil
}

func (r *AnswerRepository) UpdateSentiment(ctx context.Context, sessionID string, answerID string, emotion, color, emoji string) error {
	_, err := db.Client.Collection("sessions").Doc(sessionID).Collection("answers").Doc(answerID).Update(ctx, []firestore.Update{
		{Path: "sentiment_emotion", Value: emotion},
		{Path: "sentiment_color", Value: color},
		{Path: "sentiment_emoji", Value: emoji},
	})
	if err == nil {
		r.updateSentimentInCache(sessionID, answerID, emotion, color, emoji)
	}
	return err
}
