package main

import (
	"compress/gzip"
	"log"
	"net/http"
	"retro-gcp/config"
	"retro-gcp/db"
	"retro-gcp/handlers"
	"retro-gcp/repositories"
	"retro-gcp/services"
	"strings"
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
	handlers.UserRepo = userRepo
	handlers.TranRepo = tranRepo

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
	staticHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		fs.ServeHTTP(w, r)
	})
	mux.Handle("/static/", http.StripPrefix("/static/", staticHandler))

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
	mux.HandleFunc("/api/admin/stats", handlers.AdminStatsHandler)
	mux.HandleFunc("/api/payment/create", handlers.CreatePaymentHandler)
	mux.HandleFunc("/api/payment/methods", handlers.GetPaymentMethodsHandler)
	mux.HandleFunc("/api/payment/status", handlers.CheckPaymentStatusHandler)
	mux.HandleFunc("/api/payment/callback", handlers.PaymentCallbackHandler)
	mux.HandleFunc("/duitku/callback", handlers.PaymentCallbackHandler)

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
	mux.HandleFunc("/contact", handlers.ContactHandler)
	mux.HandleFunc("/checkout", handlers.CheckoutHandler)

	port := config.AppConfig.Port
	log.Printf("Server starting on :%s...", port)

	// Global logger middleware
	loggingMux := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("[REQ] %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)
		mux.ServeHTTP(w, r)
	})

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      gzipHandler(loggingMux),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}

type gzipResponseWriter struct {
	http.ResponseWriter
	gz          *gzip.Writer
	wroteHeader bool
}

func shouldCompress(ct string) bool {
	if ct == "" {
		return true
	}
	return !(strings.Contains(ct, "image/png") ||
		strings.Contains(ct, "image/jpeg") ||
		strings.Contains(ct, "image/webp") ||
		strings.Contains(ct, "audio/") ||
		strings.Contains(ct, "application/pdf") ||
		strings.Contains(ct, "application/zip"))
}

func (w *gzipResponseWriter) WriteHeader(statusCode int) {
	if w.wroteHeader {
		return
	}
	w.wroteHeader = true

	ct := w.Header().Get("Content-Type")
	if statusCode != http.StatusNotModified && statusCode != http.StatusNoContent && (statusCode < 100 || statusCode >= 200) && shouldCompress(ct) {
		w.Header().Set("Content-Encoding", "gzip")
		w.Header().Del("Content-Length")
		w.ResponseWriter.WriteHeader(statusCode)
		w.gz = gzip.NewWriter(w.ResponseWriter)
	} else {
		w.ResponseWriter.WriteHeader(statusCode)
	}
}

func (w *gzipResponseWriter) Write(b []byte) (int, error) {
	if !w.wroteHeader {
		ct := w.Header().Get("Content-Type")
		if ct == "" {
			ct = http.DetectContentType(b)
			w.Header().Set("Content-Type", ct)
		}
		w.WriteHeader(http.StatusOK)
	}

	if w.gz != nil {
		return w.gz.Write(b)
	}
	return w.ResponseWriter.Write(b)
}

func (w *gzipResponseWriter) Close() {
	if w.gz != nil {
		w.gz.Close()
	}
}

func (w *gzipResponseWriter) Flush() {
	if w.gz != nil {
		w.gz.Flush()
	}
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func gzipHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "HEAD" || !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}

		gzw := &gzipResponseWriter{ResponseWriter: w}
		defer gzw.Close()

		next.ServeHTTP(gzw, r)
	})
}
