package repositories

import (
	"context"
	"retro-gcp/db"
	"retro-gcp/models"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"
)

type SessionRepository struct{}

func (r *SessionRepository) Create(ctx context.Context, session models.Session) error {
	_, err := db.Client.Collection("sessions").Doc(session.ID).Set(ctx, session)
	return err
}

func (r *SessionRepository) GetByID(ctx context.Context, id string) (*models.Session, error) {
	doc, err := db.Client.Collection("sessions").Doc(id).Get(ctx)
	if err != nil {
		return nil, err
	}
	var s models.Session
	doc.DataTo(&s)
	return &s, nil
}

func (r *SessionRepository) GetAll(ctx context.Context) ([]models.Session, error) {
	iter := db.Client.Collection("sessions").OrderBy("created_at", firestore.Desc).Documents(ctx)
	var sessions []models.Session
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var s models.Session
		doc.DataTo(&s)
		sessions = append(sessions, s)
	}
	return sessions, nil
}

func (r *SessionRepository) GetByOwner(ctx context.Context, email string) ([]models.Session, error) {
	iter := db.Client.Collection("sessions").Where("owner_email", "==", email).Documents(ctx)
	var sessions []models.Session
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var s models.Session
		doc.DataTo(&s)
		sessions = append(sessions, s)
	}
	return sessions, nil
}

func (r *SessionRepository) UpdateName(ctx context.Context, id string, name string) error {
	_, err := db.Client.Collection("sessions").Doc(id).Update(ctx, []firestore.Update{
		{Path: "name", Value: name},
	})
	return err
}

func (r *SessionRepository) Delete(ctx context.Context, id string) error {
	_, err := db.Client.Collection("sessions").Doc(id).Delete(ctx)
	return err
}
