package repositories

import (
	"context"
	"retro-gcp/db"
	"retro-gcp/models"
)

type TransactionRepository struct{}

func (r *TransactionRepository) Create(ctx context.Context, t models.Transaction) error {
	_, err := db.Client.Collection("transactions").Doc(t.TransactionID).Set(ctx, t)
	return err
}

func (r *TransactionRepository) GetByID(ctx context.Context, id string) (*models.Transaction, error) {
	doc, err := db.Client.Collection("transactions").Doc(id).Get(ctx)
	if err != nil {
		return nil, err
	}
	var t models.Transaction
	doc.DataTo(&t)
	return &t, nil
}
