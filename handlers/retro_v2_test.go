package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"retro-gcp/models"
	"strings"
	"testing"
	"time"
)

const ownerEmail = "moderator@example.com"

// useSessions swaps the session repo for one serving the given sessions.
func useSessions(t *testing.T, sessions ...*models.Session) *mockSessionRepo {
	t.Helper()
	m := &mockSessionRepo{sessions: map[string]*models.Session{}}
	for _, s := range sessions {
		m.sessions[s.ID] = s
	}
	old := SessionServ.SessionRepo
	SessionServ.SessionRepo = m
	t.Cleanup(func() { SessionServ.SessionRepo = old })
	return m
}

type recAnswerRepo struct {
	mockAnswerRepo
	answers []models.Answer
	created []models.Answer
	forgot  []string
}

func (m *recAnswerRepo) GetBySession(ctx context.Context, sid string) ([]models.Answer, error) {
	return append([]models.Answer(nil), m.answers...), nil
}
func (m *recAnswerRepo) Create(ctx context.Context, sid string, a models.Answer) error {
	m.created = append(m.created, a)
	return nil
}
func (m *recAnswerRepo) ForgetSession(sid string) { m.forgot = append(m.forgot, sid) }

func useAnswers(t *testing.T, answers ...models.Answer) *recAnswerRepo {
	t.Helper()
	m := &recAnswerRepo{answers: answers}
	old := AnswerRepo
	AnswerRepo = m
	t.Cleanup(func() { AnswerRepo = old })
	return m
}

type fakeQuestionRepo struct {
	mockQuestionRepo
	qs []models.Question
}

func (m *fakeQuestionRepo) GetBySession(ctx context.Context, sid string) ([]models.Question, error) {
	return append([]models.Question(nil), m.qs...), nil
}

func useQuestions(t *testing.T, qs ...models.Question) {
	t.Helper()
	old := SessionServ.QuestionRepo
	SessionServ.QuestionRepo = &fakeQuestionRepo{qs: qs}
	t.Cleanup(func() { SessionServ.QuestionRepo = old })
}

func useActionItems(t *testing.T) *mockActionItemRepo {
	t.Helper()
	m := &mockActionItemRepo{}
	old := ActionItemRepo
	ActionItemRepo = m
	t.Cleanup(func() { ActionItemRepo = old })
	return m
}

func postJSON(h http.HandlerFunc, path string, body interface{}, email string) *httptest.ResponseRecorder {
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(b))
	if email != "" {
		req.AddCookie(createTestAuthCookie(email))
	}
	w := httptest.NewRecorder()
	h(w, req)
	return w
}

func get(h http.HandlerFunc, url, email string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, url, nil)
	if email != "" {
		req.AddCookie(createTestAuthCookie(email))
	}
	w := httptest.NewRecorder()
	h(w, req)
	return w
}

func TestSetPhaseHandler(t *testing.T) {
	repo := useSessions(t, &models.Session{ID: "s1", OwnerEmail: ownerEmail, Phase: models.PhaseWrite})

	t.Run("owner can move forward and back", func(t *testing.T) {
		for _, p := range models.AllPhases {
			w := postJSON(SetPhaseHandler, "/api/session/phase", SetPhaseRequest{SessionID: "s1", Phase: p}, ownerEmail)
			if w.Code != http.StatusOK {
				t.Fatalf("phase %s: expected 200, got %d: %s", p, w.Code, w.Body.String())
			}
			if repo.phaseUpdates["s1"] != p {
				t.Fatalf("phase %s not persisted, got %q", p, repo.phaseUpdates["s1"])
			}
		}
	})
	t.Run("non-owner forbidden", func(t *testing.T) {
		repo.phaseUpdates = nil
		w := postJSON(SetPhaseHandler, "/api/session/phase", SetPhaseRequest{SessionID: "s1", Phase: "vote"}, "other@example.com")
		if w.Code != http.StatusForbidden || len(repo.phaseUpdates) != 0 {
			t.Fatalf("expected 403 and no update, got %d %v", w.Code, repo.phaseUpdates)
		}
	})
	t.Run("anonymous unauthorized", func(t *testing.T) {
		w := postJSON(SetPhaseHandler, "/api/session/phase", SetPhaseRequest{SessionID: "s1", Phase: "vote"}, "")
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d", w.Code)
		}
	})
	t.Run("invalid phase", func(t *testing.T) {
		repo.phaseUpdates = nil
		w := postJSON(SetPhaseHandler, "/api/session/phase", SetPhaseRequest{SessionID: "s1", Phase: "party"}, ownerEmail)
		if w.Code != http.StatusBadRequest || len(repo.phaseUpdates) != 0 {
			t.Fatalf("expected 400 and no update, got %d", w.Code)
		}
	})
}

func hiddenFixture() []models.Answer {
	now := time.Now()
	return []models.Answer{
		{ID: "a-alice", QuestionID: "q1", Text: "alice card", AuthorID: computeEffectiveVoterID("", "fp-alice"), AuthorName: "Alice", CreatedAt: now},
		{ID: "a-bob", QuestionID: "q1", Text: "bob secret", GifURL: "http://gif", AuthorID: computeEffectiveVoterID("", "fp-bob"), AuthorName: "Bob", SentimentEmotion: "Joy", CreatedAt: now.Add(time.Second)},
		{ID: "a-old", QuestionID: "q2", Text: "legacy secret", CreatedAt: now.Add(2 * time.Second)},
	}
}

func decodeAnswers(t *testing.T, w *httptest.ResponseRecorder) []map[string]interface{} {
	t.Helper()
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var out []map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatalf("bad json: %v", err)
	}
	return out
}

func TestWritePhaseHidesOtherPeoplesCards(t *testing.T) {
	sess := &models.Session{ID: "s1", OwnerEmail: ownerEmail, Phase: models.PhaseWrite}
	useSessions(t, sess)
	useAnswers(t, hiddenFixture()...)

	url := "/api/session/answers?session_id=s1&device_fingerprint=fp-alice"
	out := decodeAnswers(t, get(GetAnswersHandler, url, ""))
	if len(out) != 3 {
		t.Fatalf("expected 3 entries, got %d", len(out))
	}
	if out[0]["text"] != "alice card" || out[0]["hidden"] != nil {
		t.Errorf("own card should be full: %v", out[0])
	}
	for _, i := range []int{1, 2} {
		if out[i]["hidden"] != true || len(out[i]) != 3 || out[i]["id"] == nil || out[i]["question_id"] == nil {
			t.Errorf("other card should be exactly {id,question_id,hidden}: %v", out[i])
		}
	}

	t.Run("owner gets no exception", func(t *testing.T) {
		out := decodeAnswers(t, get(GetAnswersHandler, "/api/session/answers?session_id=s1&device_fingerprint=fp-owner", ownerEmail))
		for _, a := range out {
			if a["hidden"] != true {
				t.Errorf("owner should see hidden cards: %v", a)
			}
		}
	})
	t.Run("question filter still hides", func(t *testing.T) {
		out := decodeAnswers(t, get(GetAnswersHandler, url+"&question_id=q2", ""))
		if len(out) != 1 || out[0]["hidden"] != true {
			t.Errorf("unexpected %v", out)
		}
	})
	t.Run("everything visible after group", func(t *testing.T) {
		sess.Phase = models.PhaseGroup
		out := decodeAnswers(t, get(GetAnswersHandler, url, ""))
		for _, a := range out {
			if a["hidden"] != nil || a["text"] == nil {
				t.Errorf("card should be visible in group: %v", a)
			}
		}
	})
	t.Run("missing phase behaves as discuss", func(t *testing.T) {
		sess.Phase = ""
		out := decodeAnswers(t, get(GetAnswersHandler, url, ""))
		if out[1]["text"] != "bob secret" {
			t.Errorf("old sessions must show everything: %v", out[1])
		}
	})
}

func TestSubmitStoresAuthorID(t *testing.T) {
	useSessions(t, &models.Session{ID: "s1", OwnerEmail: ownerEmail, Phase: models.PhaseWrite})
	repo := useAnswers(t)

	w := postJSON(SubmitAnswerHandler, "/api/answer/submit", map[string]string{
		"session_id": "s1", "question_id": "q1", "text": "hello", "device_fingerprint": "fp-alice",
	}, "")
	if w.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d: %s", w.Code, w.Body.String())
	}
	if len(repo.created) != 1 || repo.created[0].AuthorID != computeEffectiveVoterID("", "fp-alice") {
		t.Fatalf("author_id not stored from client fingerprint: %+v", repo.created)
	}
	// Same identity must be recognised by the read path.
	repo.answers = repo.created
	out := decodeAnswers(t, get(GetAnswersHandler, "/api/session/answers?session_id=s1&device_fingerprint=fp-alice", ""))
	if out[0]["text"] != "hello" {
		t.Errorf("author should see own card: %v", out[0])
	}
}

func TestPhaseGuards(t *testing.T) {
	sess := &models.Session{ID: "s1", OwnerEmail: ownerEmail}
	useSessions(t, sess)
	useAnswers(t)

	submit := func() *httptest.ResponseRecorder {
		return postJSON(SubmitAnswerHandler, "/api/answer/submit", map[string]string{"session_id": "s1", "question_id": "q1", "text": "x", "device_fingerprint": "fp"}, "")
	}
	vote := func() *httptest.ResponseRecorder {
		return postJSON(VoteAnswerHandler, "/api/answer/vote", map[string]string{"session_id": "s1", "answer_id": "a1", "device_fingerprint": "fp"}, "")
	}
	cluster := func() *httptest.ResponseRecorder {
		return postJSON(ClusterAnswerHandler, "/api/answer/cluster", ClusterAnswerRequest{SessionID: "s1", AnswerID: "a1", ClusterTag: "x"}, ownerEmail)
	}
	spot := func() *httptest.ResponseRecorder {
		return postJSON(SpotlightActionHandler, "/api/session/spotlight/action", SpotlightActionRequest{SessionID: "s1", Action: "focus", AnswerID: "a1"}, ownerEmail)
	}

	allowed := map[string]map[string]bool{
		models.PhaseWrite:   {"submit": true},
		models.PhaseGroup:   {"cluster": true},
		models.PhaseVote:    {"vote": true},
		models.PhaseDiscuss: {"submit": true, "vote": true, "cluster": true, "spotlight": true},
		models.PhaseAct:     {},
		models.PhaseDone:    {},
		"":                  {"submit": true, "vote": true, "cluster": true, "spotlight": true}, // old data = discuss
	}
	for phase, ok := range allowed {
		sess.Phase = phase
		for name, call := range map[string]func() *httptest.ResponseRecorder{"submit": submit, "vote": vote, "cluster": cluster, "spotlight": spot} {
			w := call()
			if ok[name] {
				if w.Code == http.StatusConflict {
					t.Errorf("phase %q: %s should be allowed, got 409", phase, name)
				}
				continue
			}
			if w.Code != http.StatusConflict {
				t.Errorf("phase %q: %s should be 409, got %d", phase, name, w.Code)
				continue
			}
			var body map[string]interface{}
			if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil || body["error"] == nil {
				t.Errorf("phase %q: %s 409 must carry a JSON error, got %q", phase, name, w.Body.String())
			}
		}
	}

	t.Run("clearing spotlight is always allowed", func(t *testing.T) {
		sess.Phase = models.PhaseWrite
		w := postJSON(SpotlightActionHandler, "/api/session/spotlight/action", SpotlightActionRequest{SessionID: "s1", Action: "clear"}, ownerEmail)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
	})
}

func TestPreviousActionsHandler(t *testing.T) {
	now := time.Now()
	repo := useSessions(t,
		&models.Session{ID: "cur", Name: "Now", OwnerEmail: ownerEmail, CreatedAt: now},
		&models.Session{ID: "old1", Name: "Old one", OwnerEmail: ownerEmail, CreatedAt: now.Add(-48 * time.Hour)},
		&models.Session{ID: "old2", Name: "Latest previous", OwnerEmail: ownerEmail, CreatedAt: now.Add(-24 * time.Hour)},
		&models.Session{ID: "next", Name: "Later", OwnerEmail: ownerEmail, CreatedAt: now.Add(24 * time.Hour)},
		&models.Session{ID: "other", Name: "Other owner", OwnerEmail: "x@example.com", CreatedAt: now.Add(-time.Hour)},
	)
	repo.byOwner = map[string][]models.Session{ownerEmail: {
		*repo.sessions["cur"], *repo.sessions["old1"], *repo.sessions["old2"], *repo.sessions["next"],
	}}
	items := useActionItems(t)
	items.items = map[string][]models.ActionItem{
		"old2": {{ID: "i1", SessionID: "old2", Text: "open", Assignee: "Ani", DueDate: "Fri"}, {ID: "i2", SessionID: "old2", Text: "done", Completed: true}},
		"old1": {{ID: "i3", SessionID: "old1", Text: "older open"}},
	}

	w := get(PreviousActionsHandler, "/api/session/previous-actions?session_id=cur", "")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for anyone with the id, got %d", w.Code)
	}
	var resp struct {
		Session *struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"session"`
		Items []models.ActionItem `json:"items"`
	}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Session == nil || resp.Session.ID != "old2" || resp.Session.Name != "Latest previous" {
		t.Fatalf("wrong previous session: %+v", resp.Session)
	}
	if len(resp.Items) != 1 || resp.Items[0].ID != "i1" {
		t.Fatalf("expected only the open item of the latest previous session, got %+v", resp.Items)
	}

	t.Run("no previous session", func(t *testing.T) {
		w := get(PreviousActionsHandler, "/api/session/previous-actions?session_id=old1", "")
		var r map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &r)
		if r["session"] != nil || len(r["items"].([]interface{})) != 0 {
			t.Fatalf("expected empty result, got %v", r)
		}
	})
	t.Run("unknown session", func(t *testing.T) {
		if w := get(PreviousActionsHandler, "/api/session/previous-actions?session_id=nope", ""); w.Code != http.StatusNotFound {
			t.Fatalf("expected 404, got %d", w.Code)
		}
	})
	t.Run("owner can tick via existing toggle with the old session id", func(t *testing.T) {
		w := postJSON(ToggleActionItemHandler, "/api/action-items/toggle", ToggleActionItemRequest{SessionID: "old2", ID: "i1", Completed: true}, ownerEmail)
		if w.Code != http.StatusOK || !items.items["old2"][0].Completed {
			t.Fatalf("toggle failed: %d", w.Code)
		}
		w = postJSON(ToggleActionItemHandler, "/api/action-items/toggle", ToggleActionItemRequest{SessionID: "old2", ID: "i1", Completed: false}, "stranger@example.com")
		if w.Code != http.StatusForbidden {
			t.Fatalf("participant must not toggle, got %d", w.Code)
		}
	})
}

func TestSessionSummaryHandler(t *testing.T) {
	evil := "<script>alert(1)</script>"
	useSessions(t,
		&models.Session{ID: "s1", Name: evil, OwnerEmail: ownerEmail, Phase: models.PhaseDone, CreatedAt: time.Date(2026, 10, 17, 9, 0, 0, 0, time.UTC)},
		&models.Session{ID: "w1", Name: "Writing", OwnerEmail: ownerEmail, Phase: models.PhaseWrite},
	)
	useQuestions(t, models.Question{ID: "q1", Text: "What went <b>well</b>?"})
	now := time.Now()
	useAnswers(t,
		models.Answer{ID: "a1", QuestionID: "q1", Text: "low votes", Votes: 1, CreatedAt: now},
		models.Answer{ID: "a2", QuestionID: "q1", Text: "top &lt;img src=x onerror=alert(2)&gt;", Votes: 7, ClusterTag: "CI/CD", CreatedAt: now.Add(time.Second)},
	)
	items := useActionItems(t)
	items.items = map[string][]models.ActionItem{"s1": {{ID: "i1", Text: "Fix <i>pipeline</i>", Assignee: "Budi", DueDate: "2026-11-01", Completed: true}}}

	w := get(SessionSummaryHandler, "/session/summary?id=s1", "")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	body := w.Body.String()
	if strings.Contains(body, "<script>alert(1)") || strings.Contains(body, "<img src=x") || strings.Contains(body, "<i>pipeline") {
		t.Errorf("unescaped user content in summary:\n%s", body)
	}
	for _, want := range []string{
		`<meta name="robots" content="noindex">`, "&lt;script&gt;alert(1)&lt;/script&gt;", "17 Oktober 2026",
		"CI/CD", "7 suara", "Budi", "2026-11-01", "Selesai", "Plus Jakarta Sans",
	} {
		if !strings.Contains(body, want) {
			t.Errorf("summary missing %q", want)
		}
	}
	if !strings.Contains(body, "top ") || strings.Index(body, "top ") > strings.Index(body, "low votes") {
		t.Errorf("cards must be sorted by votes desc")
	}
	if ct := w.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/html") {
		t.Errorf("content type %q", ct)
	}
	if strings.Contains(body, "gradient") {
		t.Errorf("no gradients allowed")
	}

	t.Run("404 for unknown id", func(t *testing.T) {
		w := get(SessionSummaryHandler, "/session/summary?id=missing", "")
		if w.Code != http.StatusNotFound || !strings.Contains(w.Header().Get("Content-Type"), "text/html") || !strings.Contains(w.Body.String(), "noindex") {
			t.Fatalf("expected HTML 404, got %d %q", w.Code, w.Header().Get("Content-Type"))
		}
		if w := get(SessionSummaryHandler, "/session/summary", ""); w.Code != http.StatusNotFound {
			t.Fatalf("expected 404 without id, got %d", w.Code)
		}
	})
	t.Run("no card text leaks during write", func(t *testing.T) {
		w := get(SessionSummaryHandler, "/session/summary?id=w1", "")
		if w.Code != http.StatusConflict || strings.Contains(w.Body.String(), "low votes") {
			t.Fatalf("expected 409 without cards, got %d", w.Code)
		}
	})
}

func TestStateHandler(t *testing.T) {
	sess := &models.Session{ID: "s1", Name: "Retro", OwnerEmail: ownerEmail, Phase: models.PhaseWrite}
	useSessions(t, sess)
	useQuestions(t, models.Question{ID: "q1", Text: "One"}, models.Question{ID: "q2", Text: "Two"})
	useAnswers(t, hiddenFixture()...)

	w := get(StateHandler, "/api/session/state?session_id=s1&voter_id=fp-alice&client_id=c1&name=Alice", ownerEmail)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var st map[string]json.RawMessage
	if err := json.Unmarshal(w.Body.Bytes(), &st); err != nil {
		t.Fatal(err)
	}
	for _, k := range []string{"session", "questions", "answers", "voter_status", "vote_budget", "timer", "spotlight", "presence", "clusters"} {
		if _, ok := st[k]; !ok {
			t.Errorf("state missing key %q", k)
		}
	}
	var session models.Session
	json.Unmarshal(st["session"], &session)
	if session.Phase != models.PhaseWrite || !session.IsOwner {
		t.Errorf("session: %+v", session)
	}
	if string(st["vote_budget"]) != fmt.Sprint(MaxVotesPerParticipant) {
		t.Errorf("vote_budget %s", st["vote_budget"])
	}
	var answers []map[string]interface{}
	json.Unmarshal(st["answers"], &answers)
	if len(answers) != 3 || answers[0]["text"] != "alice card" || answers[1]["hidden"] != true || answers[1]["text"] != nil {
		t.Errorf("answers not hidden correctly: %v", answers)
	}
	var qs []models.Question
	json.Unmarshal(st["questions"], &qs)
	if len(qs) != 2 || qs[0].AnswerCount != 2 || qs[1].AnswerCount != 1 {
		t.Errorf("questions/answer counts: %+v", qs)
	}
	var presence PresenceResponse
	json.Unmarshal(st["presence"], &presence)
	if presence.Count != 1 || presence.Participants[0].Role != "moderator" {
		t.Errorf("presence heartbeat: %+v", presence)
	}
	var voter map[string]interface{}
	json.Unmarshal(st["voter_status"], &voter)
	if voter["remaining_votes"] != float64(MaxVotesPerParticipant) || voter["max_votes"] != float64(MaxVotesPerParticipant) {
		t.Errorf("voter_status: %v", voter)
	}

	t.Run("question filter", func(t *testing.T) {
		w := get(StateHandler, "/api/session/state?session_id=s1&voter_id=fp-alice&question_id=q2", "")
		var st struct{ Answers []map[string]interface{} }
		json.Unmarshal(w.Body.Bytes(), &st)
		if len(st.Answers) != 1 || st.Answers[0]["question_id"] != "q2" {
			t.Errorf("filter: %v", st.Answers)
		}
	})
	t.Run("phase group shows all and clusters", func(t *testing.T) {
		sess.Phase = models.PhaseGroup
		useAnswers(t, models.Answer{ID: "c1", QuestionID: "q1", Text: "t", ClusterTag: "Infra"}, models.Answer{ID: "c2", QuestionID: "q1", Text: "u", ClusterTag: "Infra"})
		w := get(StateHandler, "/api/session/state?session_id=s1&voter_id=zzz", "")
		var st struct {
			Answers  []map[string]interface{}
			Clusters []ClusterTagCount
			Session  models.Session
		}
		json.Unmarshal(w.Body.Bytes(), &st)
		if st.Answers[0]["text"] != "t" || len(st.Clusters) != 1 || st.Clusters[0].Count != 2 || st.Session.IsOwner {
			t.Errorf("state: %+v", st)
		}
	})
	t.Run("old session reports discuss", func(t *testing.T) {
		sess.Phase = ""
		w := get(StateHandler, "/api/session/state?session_id=s1", "")
		var st struct{ Session models.Session }
		json.Unmarshal(w.Body.Bytes(), &st)
		if st.Session.Phase != models.PhaseDiscuss {
			t.Errorf("phase %q", st.Session.Phase)
		}
	})
	t.Run("errors", func(t *testing.T) {
		if w := get(StateHandler, "/api/session/state", ""); w.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", w.Code)
		}
		if w := get(StateHandler, "/api/session/state?session_id=nope", ""); w.Code != http.StatusNotFound {
			t.Errorf("expected 404, got %d", w.Code)
		}
	})
}

func TestAdminPaginationAndSearch(t *testing.T) {
	repo := useSessions(t)
	for i := 0; i < 57; i++ {
		owner := "a@example.com"
		name := fmt.Sprintf("Sprint %d", i)
		if i%10 == 0 {
			owner = "zoe@example.com"
		}
		if i == 33 {
			name = "Quarterly Review"
		}
		repo.all = append(repo.all, models.Session{ID: fmt.Sprint(i), Name: name, OwnerEmail: owner})
	}
	admin := "sirajshalahuddin@gmail.com"
	list := func(query string) (sessions []models.Session, total, page, size int, code int) {
		w := get(AdminAPIHandler, "/api/admin/sessions"+query, admin)
		var r struct {
			Sessions []models.Session `json:"sessions"`
			Total    int              `json:"total"`
			Page     int              `json:"page"`
			PageSize int              `json:"page_size"`
		}
		json.Unmarshal(w.Body.Bytes(), &r)
		return r.Sessions, r.Total, r.Page, r.PageSize, w.Code
	}

	s, total, page, size, code := list("")
	if code != 200 || total != 57 || len(s) != adminDefaultPageSize || page != 1 || size != adminDefaultPageSize {
		t.Fatalf("defaults: code=%d total=%d len=%d page=%d size=%d", code, total, len(s), page, size)
	}
	if s[0].Phase != models.PhaseDiscuss {
		t.Errorf("admin list should report effective phase, got %q", s[0].Phase)
	}
	s, total, _, size, _ = list("?page=2&page_size=50")
	if total != 57 || len(s) != 7 || size != 50 || s[0].ID != "50" {
		t.Fatalf("page 2: total=%d len=%d size=%d", total, len(s), size)
	}
	if _, _, _, size, _ = list("?page_size=500"); size != adminMaxPageSize {
		t.Errorf("page_size must cap at %d, got %d", adminMaxPageSize, size)
	}
	if s, total, _, _, _ = list("?page=99"); len(s) != 0 || total != 57 {
		t.Errorf("past the end: len=%d total=%d", len(s), total)
	}
	// Search covers all sessions (not only the first page), by name and by owner.
	if s, total, _, _, _ = list("?q=quarterly"); total != 1 || s[0].ID != "33" {
		t.Errorf("name search: total=%d %v", total, s)
	}
	if s, total, _, _, _ = list("?q=ZOE"); total != 6 || len(s) != 6 {
		t.Errorf("owner search: total=%d len=%d", total, len(s))
	}
	if s, total, _, _, _ = list("?q=nomatch"); total != 0 || len(s) != 0 {
		t.Errorf("no match: total=%d", total)
	}
	if w := get(AdminAPIHandler, "/api/admin/sessions", "someone@example.com"); w.Code != http.StatusForbidden {
		t.Errorf("non-admin must be 403, got %d", w.Code)
	}
}

func TestAdminDeleteCascades(t *testing.T) {
	repo := useSessions(t)
	answers := useAnswers(t)
	useActionItems(t)

	timerMu.Lock()
	timerStates["del-1"] = &SessionTimerState{SessionID: "del-1"}
	timerMu.Unlock()

	del := func(url, email string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodDelete, url, nil)
		if email != "" {
			req.AddCookie(createTestAuthCookie(email))
		}
		w := httptest.NewRecorder()
		AdminAPIHandler(w, req)
		return w
	}

	if w := del("/api/admin/sessions?id=del-1", "someone@example.com"); w.Code != http.StatusForbidden || len(repo.deletedRelated) != 0 {
		t.Fatalf("non-admin must not delete: %d", w.Code)
	}
	if w := del("/api/admin/sessions", "sirajshalahuddin@gmail.com"); w.Code != http.StatusBadRequest {
		t.Fatalf("missing id must be 400, got %d", w.Code)
	}
	if w := del("/api/admin/sessions?id=del-1", "sirajshalahuddin@gmail.com"); w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if len(repo.deletedRelated) != 1 || repo.deletedRelated[0] != "del-1" {
		t.Fatalf("cascade delete not invoked: %v", repo.deletedRelated)
	}
	if len(answers.forgot) != 1 || answers.forgot[0] != "del-1" {
		t.Errorf("answer cache not dropped: %v", answers.forgot)
	}
	timerMu.RLock()
	_, stillThere := timerStates["del-1"]
	timerMu.RUnlock()
	if stillThere {
		t.Errorf("in-memory timer state must be dropped")
	}
}

func TestAdminHealth(t *testing.T) {
	old := firestorePing
	defer func() { firestorePing = old }()

	firestorePing = func(ctx context.Context) error { return nil }
	h := adminHealth(context.Background())
	if h["status"] != "ok" || h["firestore_ok"] != true {
		t.Errorf("healthy: %v", h)
	}
	firestorePing = func(ctx context.Context) error { return fmt.Errorf("down") }
	h = adminHealth(context.Background())
	if h["status"] != "degraded" || h["firestore_ok"] != false {
		t.Errorf("degraded: %v", h)
	}
}

func TestSafeNextAndLoginRedirect(t *testing.T) {
	cases := map[string]string{
		"/session/?id=abc":        "/session/?id=abc",
		"/dashboard":              "/dashboard",
		"/session/summary?id=1":   "/session/summary?id=1",
		"//evil.com":              "",
		"https://evil.com":        "",
		"/\\evil.com":             "",
		"evil.com":                "",
		"":                        "",
		"/ok\r\nSet-Cookie: x=1":  "",
		"javascript:alert(1)":     "",
	}
	for in, want := range cases {
		if got := safeNextPath(in); got != want {
			t.Errorf("safeNextPath(%q) = %q, want %q", in, got, want)
		}
	}

	redirect := func(cookie *http.Cookie) string {
		req := httptest.NewRequest(http.MethodGet, "/auth/google/callback", nil)
		if cookie != nil {
			req.AddCookie(cookie)
		}
		return loginRedirectTarget(httptest.NewRecorder(), req)
	}
	if got := redirect(nil); got != "/dashboard" {
		t.Errorf("default must be /dashboard, got %q", got)
	}
	if got := redirect(&http.Cookie{Name: loginNextCookie, Value: "%2Fsession%2F%3Fid%3Dabc"}); got != "/session/?id=abc" {
		t.Errorf("safe next: got %q", got)
	}
	if got := redirect(&http.Cookie{Name: loginNextCookie, Value: "%2F%2Fevil.com"}); got != "/dashboard" {
		t.Errorf("unsafe next must fall back, got %q", got)
	}

	// The login handler stores only safe next values.
	InitAuth()
	login := func(next string) []*http.Cookie {
		req := httptest.NewRequest(http.MethodGet, "/auth/google/login?next="+next, nil)
		w := httptest.NewRecorder()
		GoogleLoginHandler(w, req)
		return w.Result().Cookies()
	}
	has := func(cs []*http.Cookie) bool {
		for _, c := range cs {
			if c.Name == loginNextCookie {
				return true
			}
		}
		return false
	}
	if !has(login("%2Fsession%2F%3Fid%3Dabc")) {
		t.Errorf("safe next should be remembered")
	}
	if has(login("https%3A%2F%2Fevil.com")) || has(login("%2F%2Fevil.com")) {
		t.Errorf("unsafe next must not be remembered")
	}
}
