package handlers

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"retro-gcp/dto"
	"retro-gcp/models"
	"retro-gcp/services"
	"time"
)

var PaymentServ *services.PaymentService

func TrakteerWebhookHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	expectedToken := os.Getenv("TRAKTEER_WEBHOOK_SECRET")
	receivedToken := r.Header.Get("X-Webhook-Token")
	if expectedToken != "" && receivedToken != expectedToken {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	body, _ := io.ReadAll(r.Body)
	var req dto.TrakteerWebhookRequest
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	err := PaymentServ.TransactionRepo.Create(r.Context(), models.Transaction{
		TransactionID: req.TransactionID,
		SupporterName: req.SupporterName,
		Quantity:      req.Quantity,
		Price:         req.Price,
		Status:        "unclaimed",
		CreatedAt:     time.Now(),
	})

	if err != nil {
		log.Printf("Repo Error: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func ClaimTopupHandler(w http.ResponseWriter, r *http.Request) {
	email := GetUserFromRequest(r)
	if email == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req dto.ClaimTopupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	if err := PaymentServ.ClaimTopup(r.Context(), email, req.TransactionID); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}
