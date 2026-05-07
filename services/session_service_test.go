package services

import (
	"context"
	"retro-gcp/models"
	"testing"
)

// --- Mocks ---

type mockSessionRepo struct {
	GetByIDFunc func(ctx context.Context, id string) (*models.Session, error)
	CreateFunc  func(ctx context.Context, s models.Session) error
}
func (m *mockSessionRepo) GetByID(ctx context.Context, id string) (*models.Session, error) { return m.GetByIDFunc(ctx, id) }
func (m *mockSessionRepo) Create(ctx context.Context, s models.Session) error { return m.CreateFunc(ctx, s) }
func (m *mockSessionRepo) GetAll(ctx context.Context) ([]models.Session, error) { return nil, nil }
func (m *mockSessionRepo) GetByOwner(ctx context.Context, e string) ([]models.Session, error) { return nil, nil }
func (m *mockSessionRepo) UpdateName(ctx context.Context, id string, name string) error { return nil }
func (m *mockSessionRepo) Delete(ctx context.Context, id string) error { return nil }

type mockQuestionRepo struct{}
func (m *mockQuestionRepo) Create(ctx context.Context, sid string, q models.Question) error { return nil }

type mockUserRepo struct{}
func (m *mockUserRepo) GetByEmail(ctx context.Context, e string) (*models.User, error) { return nil, nil }
func (m *mockUserRepo) UpdateQuota(ctx context.Context, e string, i int) error { return nil }

// --- Tests ---

func TestGetSessionWithOwnership(t *testing.T) {
	mockRepo := &mockSessionRepo{
		GetByIDFunc: func(ctx context.Context, id string) (*models.Session, error) {
			return &models.Session{ID: id, OwnerEmail: "owner@test.com"}, nil
		},
	}
	
	service := &SessionService{
		SessionRepo: mockRepo,
	}

	ctx := context.Background()

	t.Run("User is owner", func(t *testing.T) {
		sess, err := service.GetSessionWithOwnership(ctx, "123", "owner@test.com")
		if err != nil { t.Errorf("Unexpected error: %v", err) }
		if !sess.IsOwner { t.Errorf("Expected IsOwner to be true") }
	})

	t.Run("User is not owner", func(t *testing.T) {
		sess, err := service.GetSessionWithOwnership(ctx, "123", "guest@test.com")
		if err != nil { t.Errorf("Unexpected error: %v", err) }
		if sess.IsOwner { t.Errorf("Expected IsOwner to be false") }
	})
}
