package repositories

import (
	"context"
	"retro-gcp/db"
	"retro-gcp/models"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"
)

type AnswerRepository struct{}

func (r *AnswerRepository) Create(ctx context.Context, sessionID string, a models.Answer) error {
	_, err := db.Client.Collection("sessions").Doc(sessionID).Collection("answers").Doc(a.ID).Set(ctx, a)
	return err
}

func (r *AnswerRepository) GetBySession(ctx context.Context, sessionID string) ([]models.Answer, error) {
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
	return answers, nil
}

func (r *AnswerRepository) UpdateSentiment(ctx context.Context, sessionID string, answerID string, emotion, color, emoji string) error {
	_, err := db.Client.Collection("sessions").Doc(sessionID).Collection("answers").Doc(answerID).Update(ctx, []firestore.Update{
		{Path: "sentiment_emotion", Value: emotion},
		{Path: "sentiment_color", Value: color},
		{Path: "sentiment_emoji", Value: emoji},
	})
	return err
}
