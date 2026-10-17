package handlers

import (
	"errors"
	"context"
	"net/http"
	"retro-gcp/models"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func createTestAuthCookie(email string) *http.Cookie {
	jwtToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"email": email,
		"exp":   time.Now().Add(24 * time.Hour).Unix(),
	})
	tokenString, _ := jwtToken.SignedString(jwtSecret)
	return &http.Cookie{
		Name:     "token",
		Value:    tokenString,
		Path:     "/",
		HttpOnly: true,
	}
}

// mockSessionRepo defaults to a single owner (moderator@example.com) for any id with
// no phase (= discuss). Set `sessions` to serve specific sessions (unknown ids return an error).
type mockSessionRepo struct {
	sessions       map[string]*models.Session
	all            []models.Session
	byOwner        map[string][]models.Session
	phaseUpdates   map[string]string
	deletedRelated []string
}

func (m *mockSessionRepo) Create(ctx context.Context, s models.Session) error { return nil }
func (m *mockSessionRepo) GetByID(ctx context.Context, id string) (*models.Session, error) {
	if m.sessions != nil {
		s, ok := m.sessions[id]
		if !ok {
			return nil, errors.New("not found")
		}
		cp := *s
		return &cp, nil
	}
	return &models.Session{ID: id, OwnerEmail: "moderator@example.com"}, nil
}
func (m *mockSessionRepo) GetAll(ctx context.Context) ([]models.Session, error) { return m.all, nil }
func (m *mockSessionRepo) GetByOwner(ctx context.Context, e string) ([]models.Session, error) {
	return m.byOwner[e], nil
}
func (m *mockSessionRepo) UpdateName(ctx context.Context, id string, n string) error { return nil }
func (m *mockSessionRepo) Delete(ctx context.Context, id string) error               { return nil }
func (m *mockSessionRepo) UpdatePhase(ctx context.Context, id string, phase string) error {
	if m.phaseUpdates == nil {
		m.phaseUpdates = map[string]string{}
	}
	m.phaseUpdates[id] = phase
	if s, ok := m.sessions[id]; ok {
		s.Phase = phase
	}
	return nil
}
func (m *mockSessionRepo) DeleteWithRelated(ctx context.Context, id string) error {
	m.deletedRelated = append(m.deletedRelated, id)
	return nil
}

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
func (m *mockAnswerRepo) IncrementVotes(ctx context.Context, sid string, aid string) (int, error) { return 1, nil }
func (m *mockAnswerRepo) GetVoterRecord(ctx context.Context, sid string, vid string) (*models.VoterRecord, error) {
	return &models.VoterRecord{VoterID: vid, TotalVotes: 0, VotedAnswers: []string{}}, nil
}
func (m *mockAnswerRepo) CastVote(ctx context.Context, sid string, aid string, vid string, maxV int) (int, int, error) {
	return 1, maxV - 1, nil
}
func (m *mockAnswerRepo) UpdateCluster(ctx context.Context, sid string, aid string, tag string, pid string) error {
	return nil
}


type mockActionItemRepo struct {
	items map[string][]models.ActionItem
}
func (m *mockActionItemRepo) Create(ctx context.Context, sid string, item models.ActionItem) error {
	if m.items == nil { m.items = make(map[string][]models.ActionItem) }
	m.items[sid] = append(m.items[sid], item)
	return nil
}
func (m *mockActionItemRepo) GetBySession(ctx context.Context, sid string) ([]models.ActionItem, error) {
	if m.items == nil { return []models.ActionItem{}, nil }
	return m.items[sid], nil
}
func (m *mockActionItemRepo) Toggle(ctx context.Context, sid string, itemID string, completed bool) error {
	if m.items != nil {
		for i := range m.items[sid] {
			if m.items[sid][i].ID == itemID {
				m.items[sid][i].Completed = completed
				break
			}
		}
	}
	return nil
}
func (m *mockActionItemRepo) Delete(ctx context.Context, sid string, itemID string) error {
	if m.items != nil {
		var res []models.ActionItem
		for _, it := range m.items[sid] {
			if it.ID != itemID {
				res = append(res, it)
			}
		}
		m.items[sid] = res
	}
	return nil
}

