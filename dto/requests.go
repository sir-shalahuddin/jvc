package dto

type CreateSessionRequest struct {
	Name string `json:"name"`
}

type UpdateSessionRequest struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type AddQuestionRequest struct {
	SessionID string `json:"session_id"`
	Text      string `json:"text"`
	GifURL    string `json:"gif_url"`
}

type UpdateQuestionRequest struct {
	ID        string `json:"id"`
	SessionID string `json:"session_id"`
	Text      string `json:"text"`
	GifURL    string `json:"gif_url"`
}

type DeleteQuestionRequest struct {
	ID        string `json:"id"`
	SessionID string `json:"session_id"`
}

type SubmitAnswerRequest struct {
	SessionID  string `json:"session_id"`
	QuestionID string `json:"question_id"`
	Text       string `json:"text"`
	GifURL     string `json:"gif_url"`
	AuthorName string `json:"author_name"`
	// DeviceFingerprint / VoterID identify the client; the same value the vote and voter-status calls use.
	DeviceFingerprint string `json:"device_fingerprint"`
	VoterID           string `json:"voter_id"`
}
