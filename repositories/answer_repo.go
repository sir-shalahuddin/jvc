package repositories

import (
	"context"
	"errors"
	"retro-gcp/db"
	"retro-gcp/models"
	"sync"
	"time"

	"cloud.google.com/go/firestore"
	"golang.org/x/sync/singleflight"
	"google.golang.org/api/iterator"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

var (
	ErrAlreadyVoted       = errors.New("already voted on this card")
	ErrVoteQuotaExceeded  = errors.New("vote quota exceeded for this session")
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

func (r *AnswerRepository) updateClusterInCache(sessionID string, answerID string, clusterTag string, parentID string) {
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
			entry.answers[i].ClusterTag = clusterTag
			entry.answers[i].ParentID = parentID
			entry.updatedAt = time.Now()
			break
		}
	}
}

func (r *AnswerRepository) updateVotesInCache(sessionID string, answerID string) int {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.cache == nil {
		return 0
	}
	entry, ok := r.cache[sessionID]
	if !ok || time.Since(entry.updatedAt) > 5*time.Minute {
		return 0
	}
	for i, ans := range entry.answers {
		if ans.ID == answerID {
			entry.answers[i].Votes++
			entry.updatedAt = time.Now()
			return entry.answers[i].Votes
		}
	}
	return 0
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

func (r *AnswerRepository) UpdateCluster(ctx context.Context, sessionID string, answerID string, clusterTag string, parentID string) error {
	_, err := db.Client.Collection("sessions").Doc(sessionID).Collection("answers").Doc(answerID).Update(ctx, []firestore.Update{
		{Path: "cluster_tag", Value: clusterTag},
		{Path: "parent_id", Value: parentID},
	})
	if err == nil {
		r.updateClusterInCache(sessionID, answerID, clusterTag, parentID)
	}
	return err
}

func (r *AnswerRepository) IncrementVotes(ctx context.Context, sessionID string, answerID string) (int, error) {
	_, err := db.Client.Collection("sessions").Doc(sessionID).Collection("answers").Doc(answerID).Update(ctx, []firestore.Update{
		{Path: "votes", Value: firestore.Increment(1)},
	})
	newVotes := r.updateVotesInCache(sessionID, answerID)
	return newVotes, err
}

func (r *AnswerRepository) GetVoterRecord(ctx context.Context, sessionID string, voterID string) (*models.VoterRecord, error) {
	doc, err := db.Client.Collection("sessions").Doc(sessionID).Collection("voters").Doc(voterID).Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return &models.VoterRecord{
				VoterID:      voterID,
				TotalVotes:   0,
				VotedAnswers: []string{},
				UpdatedAt:    time.Now(),
			}, nil
		}
		return nil, err
	}

	var rec models.VoterRecord
	if err := doc.DataTo(&rec); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *AnswerRepository) CastVote(ctx context.Context, sessionID string, answerID string, voterID string, maxVotes int) (int, int, error) {
	voterRef := db.Client.Collection("sessions").Doc(sessionID).Collection("voters").Doc(voterID)
	answerRef := db.Client.Collection("sessions").Doc(sessionID).Collection("answers").Doc(answerID)

	var finalAnswerVotes int
	var remainingVotes int

	err := db.Client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		// 1. Check voter document
		voterDoc, err := tx.Get(voterRef)
		var voterRec models.VoterRecord
		if err != nil {
			if status.Code(err) == codes.NotFound {
				voterRec = models.VoterRecord{
					VoterID:      voterID,
					TotalVotes:   0,
					VotedAnswers: []string{},
				}
			} else {
				return err
			}
		} else {
			if err := voterDoc.DataTo(&voterRec); err != nil {
				return err
			}
		}

		// 2. Validate: already voted on this answer?
		for _, ansID := range voterRec.VotedAnswers {
			if ansID == answerID {
				return ErrAlreadyVoted
			}
		}

		// 3. Validate: quota exceeded?
		if maxVotes > 0 && voterRec.TotalVotes >= maxVotes {
			return ErrVoteQuotaExceeded
		}

		// 4. Read answer document to get current votes
		ansDoc, err := tx.Get(answerRef)
		if err != nil {
			return err
		}
		var ans models.Answer
		if err := ansDoc.DataTo(&ans); err != nil {
			return err
		}

		finalAnswerVotes = ans.Votes + 1
		voterRec.TotalVotes++
		voterRec.VotedAnswers = append(voterRec.VotedAnswers, answerID)
		voterRec.UpdatedAt = time.Now()
		remainingVotes = maxVotes - voterRec.TotalVotes
		if remainingVotes < 0 {
			remainingVotes = 0
		}

		// 5. Update answer votes
		if err := tx.Update(answerRef, []firestore.Update{
			{Path: "votes", Value: firestore.Increment(1)},
		}); err != nil {
			return err
		}

		// 6. Save voter record
		return tx.Set(voterRef, voterRec)
	})

	if err != nil {
		return 0, 0, err
	}

	r.updateVotesInCache(sessionID, answerID)
	return finalAnswerVotes, remainingVotes, nil
}
