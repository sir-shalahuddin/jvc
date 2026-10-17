package models

import "time"

type User struct {
	Email        string    `json:"email" firestore:"email"`
	SessionQuota int       `json:"session_quota" firestore:"session_quota"`
	CreatedAt    time.Time `json:"created_at" firestore:"created_at"`
}

type Session struct {
	ID         string    `json:"id" firestore:"id"`
	Name       string    `json:"name" firestore:"name"`
	OwnerEmail string    `json:"owner_email" firestore:"owner_email"`
	CreatedAt  time.Time `json:"created_at" firestore:"created_at"`
	Status     string    `json:"status" firestore:"status"`
	Phase      string    `json:"phase" firestore:"phase"` // empty in old data means "discuss"
	IsOwner    bool      `json:"is_owner" firestore:"-"`  // UI only
}

type Question struct {
	ID               string    `json:"id" firestore:"id"`
	SessionID        string    `json:"session_id" firestore:"session_id"`
	Text             string    `json:"text" firestore:"text"`
	Type             string    `json:"type" firestore:"type"`
	GifURL           string    `json:"gif_url" firestore:"gif_url"`
	TimeLimitSeconds int       `json:"time_limit_seconds" firestore:"time_limit_seconds"`
	CreatedAt        time.Time `json:"created_at" firestore:"created_at"`
	AnswerCount      int       `json:"answer_count" firestore:"-"`
}

type Answer struct {
	ID               string    `json:"id" firestore:"id"`
	QuestionID       string    `json:"question_id" firestore:"question_id"`
	SessionID        string    `json:"session_id" firestore:"session_id"`
	Text             string    `json:"text" firestore:"text"`
	GifURL           string    `json:"gif_url" firestore:"gif_url"`
	SentimentEmotion string    `json:"sentiment_emotion" firestore:"sentiment_emotion"`
	SentimentColor   string    `json:"sentiment_color" firestore:"sentiment_color"`
	SentimentEmoji   string    `json:"sentiment_emoji" firestore:"sentiment_emoji"`
	AuthorName       string    `json:"author_name" firestore:"author_name"`
	AuthorID         string    `json:"author_id,omitempty" firestore:"author_id"`
	Votes            int       `json:"votes" firestore:"votes"`
	ClusterTag       string    `json:"cluster_tag,omitempty" firestore:"cluster_tag,omitempty"`
	ParentID         string    `json:"parent_id,omitempty" firestore:"parent_id,omitempty"`
	CreatedAt        time.Time `json:"created_at" firestore:"created_at"`
}

type Transaction struct {
	TransactionID string    `json:"transaction_id" firestore:"transaction_id"`
	SupporterName string    `json:"supporter_name" firestore:"supporter_name"`
	Quantity      int       `json:"quantity" firestore:"quantity"`
	Price         int       `json:"price" firestore:"price"`
	Status        string    `json:"status" firestore:"status"`
	ClaimedBy     string    `json:"claimed_by" firestore:"claimed_by"`
	CreatedAt     time.Time `json:"created_at" firestore:"created_at"`
	ClaimedAt     time.Time `json:"claimed_at" firestore:"claimed_at"`
}

type VoterRecord struct {
	VoterID      string    `json:"voter_id" firestore:"voter_id"`
	TotalVotes   int       `json:"total_votes" firestore:"total_votes"`
	VotedAnswers []string  `json:"voted_answers" firestore:"voted_answers"`
	UpdatedAt    time.Time `json:"updated_at" firestore:"updated_at"`
}

type ActionItem struct {
	ID        string    `json:"id" firestore:"id"`
	SessionID string    `json:"session_id" firestore:"session_id"`
	AnswerID  string    `json:"answer_id,omitempty" firestore:"answer_id,omitempty"`
	Text      string    `json:"text" firestore:"text"`
	Assignee  string    `json:"assignee" firestore:"assignee"`
	DueDate   string    `json:"due_date" firestore:"due_date"`
	Completed bool      `json:"completed" firestore:"completed"`
	CreatedAt time.Time `json:"created_at" firestore:"created_at"`
}

// Session phases. Old sessions without a phase behave as PhaseDiscuss, and the
// legacy phases group/vote/act (pre three-phase model) are treated as discuss.
const (
	PhaseWrite   = "write"
	PhaseDiscuss = "discuss"
	PhaseDone    = "done"
)

// AllPhases lists the valid phases in board order.
var AllPhases = []string{PhaseWrite, PhaseDiscuss, PhaseDone}

// IsValidPhase reports whether p is one of AllPhases.
func IsValidPhase(p string) bool {
	for _, v := range AllPhases {
		if v == p {
			return true
		}
	}
	return false
}

// EffectivePhase returns the session's phase normalised to the current model.
func (s *Session) EffectivePhase() string {
	if s == nil {
		return PhaseDiscuss
	}
	return NormalizePhase(s.Phase)
}

// NormalizePhase maps a stored phase to the current model: legacy group, vote
// and act (and a missing value) become discuss.
func NormalizePhase(p string) string {
	switch p {
	case PhaseWrite, PhaseDone, PhaseDiscuss:
		return p
	}
	return PhaseDiscuss
}
