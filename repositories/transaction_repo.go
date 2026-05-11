package repositories

import (
	"context"
	"retro-gcp/db"
	"retro-gcp/models"
	"google.golang.org/api/iterator"
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

func (r *TransactionRepository) GetAll(ctx context.Context) ([]models.Transaction, error) {
	iter := db.Client.Collection("transactions").Documents(ctx)
	var transactions []models.Transaction
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		var t models.Transaction
		doc.DataTo(&t)
		transactions = append(transactions, t)
	}
	return transactions, nil
}
