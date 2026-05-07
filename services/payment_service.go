package services

import (
	"context"
	"fmt"
	"retro-gcp/db"
	"retro-gcp/models"
	"time"

	"cloud.google.com/go/firestore"
)

type ITransactionRepository interface {
	Create(ctx context.Context, t models.Transaction) error
	GetByID(ctx context.Context, id string) (*models.Transaction, error)
}

// Note: IUserRepository is already defined in session_service.go, 
// so we can use it if they are in the same package.

type PaymentService struct {
	TransactionRepo ITransactionRepository
	UserRepo        IUserRepository
}

func (s *PaymentService) ClaimTopup(ctx context.Context, email string, transactionID string) error {
	// In a real TDD with Firestore Transaction, it's hard to mock without abstracting the transaction logic.
	// For this exercise, we'll keep the firestore.Transaction call but use the interface where possible.
	
	return db.Client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		txRef := db.Client.Collection("transactions").Doc(transactionID)
		doc, err := tx.Get(txRef)
		if err != nil {
			return err
		}
		var transaction models.Transaction
		doc.DataTo(&transaction)

		if transaction.Status == "claimed" {
			return fmt.Errorf("already claimed")
		}

		userRef := db.Client.Collection("users").Doc(email)
		
		err = tx.Update(txRef, []firestore.Update{
			{Path: "status", Value: "claimed"},
			{Path: "claimed_by", Value: email},
			{Path: "claimed_at", Value: time.Now()},
		})
		if err != nil {
			return err
		}

		return tx.Update(userRef, []firestore.Update{
			{Path: "session_quota", Value: firestore.Increment(transaction.Quantity)},
		})
	})
}
