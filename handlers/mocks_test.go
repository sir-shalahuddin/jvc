package handlers

import (
	"context"
	"retro-gcp/models"
)

type mockSessionRepo struct{}
func (m *mockSessionRepo) Create(ctx context.Context, s models.Session) error { return nil }
func (m *mockSessionRepo) GetByID(ctx context.Context, id string) (*models.Session, error) { return &models.Session{ID: id}, nil }
func (m *mockSessionRepo) GetAll(ctx context.Context) ([]models.Session, error) { return nil, nil }
func (m *mockSessionRepo) GetByOwner(ctx context.Context, e string) ([]models.Session, error) { return nil, nil }
func (m *mockSessionRepo) UpdateName(ctx context.Context, id string, n string) error { return nil }
func (m *mockSessionRepo) Delete(ctx context.Context, id string) error { return nil }

type mockUserRepo struct{}
func (m *mockUserRepo) GetByEmail(ctx context.Context, e string) (*models.User, error) { return &models.User{Email: e}, nil }
func (m *mockUserRepo) UpdateQuota(ctx context.Context, e string, i int) error { return nil }

type mockQuestionRepo struct{}
func (m *mockQuestionRepo) Create(ctx context.Context, sid string, q models.Question) error { return nil }
func (m *mockQuestionRepo) GetBySession(ctx context.Context, sid string) ([]models.Question, error) { return nil, nil }
func (m *mockQuestionRepo) Update(ctx context.Context, sid string, qid string, t string, g string) error { return nil }
func (m *mockQuestionRepo) Delete(ctx context.Context, sid string, qid string) error { return nil }

type mockAnswerRepo struct{}
func (m *mockAnswerRepo) Create(ctx context.Context, sid string, a models.Answer) error { return nil }
func (m *mockAnswerRepo) GetBySession(ctx context.Context, sid string) ([]models.Answer, error) { return nil, nil }
func (m *mockAnswerRepo) UpdateSentiment(ctx context.Context, sid string, aid string, e, c, em string) error { return nil }

type mockTransactionRepo struct{}
func (m *mockTransactionRepo) Create(ctx context.Context, t models.Transaction) error { return nil }
func (m *mockTransactionRepo) GetByID(ctx context.Context, id string) (*models.Transaction, error) { return nil, nil }
