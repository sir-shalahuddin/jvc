package handlers

import (
	"os"
	"retro-gcp/config"
	"retro-gcp/services"
	"testing"
)

func TestMain(m *testing.M) {
	// Setup
	config.AppConfig.AdminEmail = "sirajshalahuddin@gmail.com"
	config.AppConfig.JWTSecret = "test-secret"
	os.Setenv("TRAKTEER_WEBHOOK_SECRET", "test-webhook-secret")
	
	// Initialize minimal service mocks with mock repos
	sessRepo := &mockSessionRepo{}
	userRepo := &mockUserRepo{}
	tranRepo := &mockTransactionRepo{}
	
	SessionServ = &services.SessionService{
		SessionRepo:  sessRepo,
		UserRepo:     userRepo,
		QuestionRepo: &mockQuestionRepo{},
	}
	PaymentServ = &services.PaymentService{
		TransactionRepo: tranRepo,
		UserRepo:        userRepo,
	}
	AnswerRepo = &mockAnswerRepo{}
	
	code := m.Run()
	
	// Teardown
	os.Exit(code)
}
