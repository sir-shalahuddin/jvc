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
}

type ClaimTopupRequest struct {
	TransactionID string `json:"transaction_id"`
}

type TrakteerWebhookRequest struct {
	TransactionID string `json:"transaction_id"`
	SupporterName string `json:"supporter_name"`
	Quantity      int    `json:"quantity"`
	Price         int    `json:"price"`
}
