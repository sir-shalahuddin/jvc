package repositories

import (
	"context"
	"retro-gcp/db"
	"retro-gcp/models"

	"cloud.google.com/go/firestore"
)

type UserRepository struct{}

func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	doc, err := db.Client.Collection("users").Doc(email).Get(ctx)
	if err != nil {
		return nil, err
	}
	var user models.User
	doc.DataTo(&user)
	return &user, nil
}

func (r *UserRepository) CreateOrUpdate(ctx context.Context, user models.User) error {
	_, err := db.Client.Collection("users").Doc(user.Email).Set(ctx, user)
	return err
}

func (r *UserRepository) UpdateQuota(ctx context.Context, email string, inc int) error {
	_, err := db.Client.Collection("users").Doc(email).Update(ctx, []firestore.Update{
		{Path: "session_quota", Value: firestore.Increment(inc)},
	})
	return err
}
