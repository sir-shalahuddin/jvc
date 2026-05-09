package main

import (
	"log"
	"net/http"
	"retro-gcp/config"
	"retro-gcp/db"
	"retro-gcp/handlers"
	"retro-gcp/repositories"
	"retro-gcp/services"
	"time"

	"github.com/joho/godotenv"
)

func main() {
	// Load .env file for local development
	godotenv.Load()

	// Initialize Repositories
	userRepo := &repositories.UserRepository{}
	sessRepo := &repositories.SessionRepository{}
	quesRepo := &repositories.QuestionRepository{}
	ansRepo := &repositories.AnswerRepository{}
	tranRepo := &repositories.TransactionRepository{}

	// Initialize Services
	handlers.SessionServ = &services.SessionService{
		SessionRepo:  sessRepo,
		UserRepo:     userRepo,
		QuestionRepo: quesRepo,
	}
	handlers.PaymentServ = &services.PaymentService{
		TransactionRepo: tranRepo,
		UserRepo:        userRepo,
	}
	handlers.AnswerRepo = ansRepo

	// Load configuration
	config.LoadConfig()

	// Initialize Firestore
	if err := db.InitFirestore(); err != nil {
		log.Fatalf("Error initializing Firestore: %v", err)
	}
	defer db.CloseFirestore()

	// Initialize Auth
	handlers.InitAuth()

	// Initialize Background Workers
	handlers.InitSentimentProcessor(5)

	mux := http.NewServeMux()

	// Static files
	fs := http.FileServer(http.Dir("static"))
	mux.Handle("/static/", http.StripPrefix("/static/", fs))

	// API Routes
	mux.HandleFunc("/api/session/create", handlers.CreateSessionHandler)
	mux.HandleFunc("/api/session/get", handlers.GetSessionHandler)
	mux.HandleFunc("/api/session/update", handlers.UpdateSessionHandler)
	mux.HandleFunc("/api/session/questions", handlers.GetQuestionsHandler)
	mux.HandleFunc("/api/gifs/search", handlers.GiphyProxyHandler)
	mux.HandleFunc("/api/question/add", handlers.AddQuestionHandler)
	mux.HandleFunc("/api/question/update", handlers.UpdateQuestionHandler)
	mux.HandleFunc("/api/question/delete", handlers.DeleteQuestionHandler)
	mux.HandleFunc("/api/upload", handlers.UploadHandler)
	mux.HandleFunc("/api/answer/submit", handlers.SubmitAnswerHandler)
	mux.HandleFunc("/api/session/answers", handlers.GetAnswersHandler)
	mux.HandleFunc("/api/session/report", handlers.GenerateReportHandler)

	// Monetization & Admin API
	mux.HandleFunc("/api/history", handlers.HistoryAPIHandler)
	mux.HandleFunc("/api/admin/sessions", handlers.AdminAPIHandler)
	mux.HandleFunc("/api/webhook/trakteer", handlers.TrakteerWebhookHandler)
	mux.HandleFunc("/api/topup/claim", handlers.ClaimTopupHandler)

	// Auth Routes
	mux.HandleFunc("/auth/google/login", handlers.GoogleLoginHandler)
	mux.HandleFunc("/auth/google/callback", handlers.GoogleCallbackHandler)
	mux.HandleFunc("/api/me", handlers.MeHandler)
	mux.HandleFunc("/auth/logout", handlers.LogoutHandler)

	// Frontend Routes
	mux.HandleFunc("/", handlers.HomeHandler)
	mux.HandleFunc("/session/", handlers.SessionHandler)
	mux.HandleFunc("/admin", handlers.AdminUIHandler)
	mux.HandleFunc("/about", handlers.AboutHandler)

	port := config.AppConfig.Port
	log.Printf("Server starting on :%s...", port)
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
