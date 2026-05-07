package repositories

import (
	"context"
	"retro-gcp/db"
	"retro-gcp/models"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"
)

type QuestionRepository struct{}

func (r *QuestionRepository) Create(ctx context.Context, sessionID string, q models.Question) error {
	_, err := db.Client.Collection("sessions").Doc(sessionID).Collection("questions").Doc(q.ID).Set(ctx, q)
	return err
}

func (r *QuestionRepository) GetBySession(ctx context.Context, sessionID string) ([]models.Question, error) {
	iter := db.Client.Collection("sessions").Doc(sessionID).Collection("questions").OrderBy("created_at", firestore.Asc).Documents(ctx)
	var questions []models.Question
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var q models.Question
		doc.DataTo(&q)
		questions = append(questions, q)
	}
	return questions, nil
}

func (r *QuestionRepository) Update(ctx context.Context, sessionID string, qID string, text string, gifURL string) error {
	_, err := db.Client.Collection("sessions").Doc(sessionID).Collection("questions").Doc(qID).Update(ctx, []firestore.Update{
		{Path: "text", Value: text},
		{Path: "gif_url", Value: gifURL},
	})
	return err
}

func (r *QuestionRepository) Delete(ctx context.Context, sessionID string, qID string) error {
	_, err := db.Client.Collection("sessions").Doc(sessionID).Collection("questions").Doc(qID).Delete(ctx)
	return err
}
