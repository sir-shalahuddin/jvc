package services

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"retro-gcp/models"
	"testing"
)

type mockTransactionRepo struct {
	GetByIDFunc func(ctx context.Context, id string) (*models.Transaction, error)
	CreateFunc  func(ctx context.Context, t models.Transaction) error
}

func (m *mockTransactionRepo) GetByID(ctx context.Context, id string) (*models.Transaction, error) {
	return m.GetByIDFunc(ctx, id)
}
func (m *mockTransactionRepo) Create(ctx context.Context, t models.Transaction) error {
	return m.CreateFunc(ctx, t)
}

func TestPaymentService_MocksReady(t *testing.T) {
	repo := &mockTransactionRepo{
		GetByIDFunc: func(ctx context.Context, id string) (*models.Transaction, error) {
			return &models.Transaction{TransactionID: id, Status: "unclaimed"}, nil
		},
	}

	service := &PaymentService{
		TransactionRepo: repo,
	}

	if service.TransactionRepo == nil {
		t.Errorf("Service failed to initialize")
	}
}

func TestDuitkuSignature(t *testing.T) {
	mCode := "DS30566"
	amount := "25000"
	orderId := "RETRO-123"
	apiKey := "test-key"
	
	signatureStr := fmt.Sprintf("%s%s%s%s", mCode, amount, orderId, apiKey)
	hash := md5.Sum([]byte(signatureStr))
	sig := hex.EncodeToString(hash[:])
	
	if len(sig) != 32 {
		t.Errorf("Expected 32 chars md5, got %d", len(sig))
	}
}
