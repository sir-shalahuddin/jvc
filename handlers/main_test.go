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
	
	// Initialize minimal service mocks with mock repos
	sessRepo := &mockSessionRepo{}
	userRepo := &mockUserRepo{}
	
	SessionServ = &services.SessionService{
		SessionRepo:  sessRepo,
		UserRepo:     userRepo,
		QuestionRepo: &mockQuestionRepo{},
	}
	AnswerRepo = &mockAnswerRepo{}
	ActionItemRepo = &mockActionItemRepo{}
	
	code := m.Run()
	
	// Teardown
	os.Exit(code)
}
