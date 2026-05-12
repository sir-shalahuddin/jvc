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
	IsOwner    bool      `json:"is_owner" firestore:"-"` // UI only
}

type Question struct {
	ID               string    `json:"id" firestore:"id"`
	SessionID        string    `json:"session_id" firestore:"session_id"`
	Text             string    `json:"text" firestore:"text"`
	Type             string    `json:"type" firestore:"type"`
	GifURL           string    `json:"gif_url" firestore:"gif_url"`
	TimeLimitSeconds int       `json:"time_limit_seconds" firestore:"time_limit_seconds"`
	CreatedAt        time.Time `json:"created_at" firestore:"created_at"`
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

type Product struct {
	ID          string `json:"id" firestore:"id"`
	Name        string `json:"name" firestore:"name"`
	Description string `json:"description" firestore:"description"`
	Price       int    `json:"price" firestore:"price"`
	Quantity    int    `json:"quantity" firestore:"quantity"` // Session units granted
}

