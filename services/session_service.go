package services

import (
	"context"
	"fmt"
	"retro-gcp/db"
	"retro-gcp/models"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/google/uuid"
)

type ISessionRepository interface {
	Create(ctx context.Context, session models.Session) error
	GetByID(ctx context.Context, id string) (*models.Session, error)
	GetAll(ctx context.Context) ([]models.Session, error)
	GetByOwner(ctx context.Context, email string) ([]models.Session, error)
	UpdateName(ctx context.Context, id string, name string) error
	Delete(ctx context.Context, id string) error
}

type IUserRepository interface {
	GetByEmail(ctx context.Context, email string) (*models.User, error)
	UpdateQuota(ctx context.Context, email string, inc int) error
}

type IQuestionRepository interface {
	Create(ctx context.Context, sessionID string, q models.Question) error
	GetBySession(ctx context.Context, sessionID string) ([]models.Question, error)
	Update(ctx context.Context, sessionID string, qID string, text string, gifURL string) error
	Delete(ctx context.Context, sessionID string, qID string) error
}

type SessionService struct {
	SessionRepo  ISessionRepository
	UserRepo     IUserRepository
	QuestionRepo IQuestionRepository
}

func (s *SessionService) CreateSession(ctx context.Context, email string, name string) (*models.Session, error) {
	// In a real TDD, we would use the UserRepo.UpdateQuota but we have the firestore transaction here.
	// For testing purposes, we might need to abstract the transaction as well, 
	// but let's stick to repo abstraction first.

	userRef := db.Client.Collection("users").Doc(email)
	err := db.Client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		doc, err := tx.Get(userRef)
		if err != nil { return err }
		var user models.User
		doc.DataTo(&user)
		if user.SessionQuota <= 0 { return fmt.Errorf("quota exceeded") }
		return tx.Update(userRef, []firestore.Update{{Path: "session_quota", Value: firestore.Increment(-1)}})
	})

	if err != nil { return nil, err }

	sessionID := uuid.New().String()
	session := models.Session{
		ID:         sessionID,
		Name:       name,
		OwnerEmail: email,
		CreatedAt:  time.Now(),
		Status:     "active",
	}

	if err := s.SessionRepo.Create(ctx, session); err != nil { return nil, err }

	defaultQs := []string{"What went well?", "What didn't go well?", "What should be improved?", "Word of gratitude"}
	for _, qText := range defaultQs {
		s.QuestionRepo.Create(ctx, sessionID, models.Question{
			ID:        uuid.New().String(),
			SessionID: sessionID,
			Text:      qText,
			Type:      "default",
			CreatedAt: time.Now(),
		})
	}
	return &session, nil
}

func (s *SessionService) GetSessionWithOwnership(ctx context.Context, sessionID string, userEmail string) (*models.Session, error) {
	session, err := s.SessionRepo.GetByID(ctx, sessionID)
	if err != nil { return nil, err }
	session.IsOwner = (userEmail != "" && userEmail == session.OwnerEmail)
	return session, nil
}
