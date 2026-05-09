package handlers

import (
	"encoding/json"
	"net/http"
	"retro-gcp/config"
	"retro-gcp/dto"
	"retro-gcp/services"
)

var SessionServ *services.SessionService

func CreateSessionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	email := GetUserFromRequest(r)
	if email == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req dto.CreateSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.Name = "Sprint Retrospective"
	}

	session, err := SessionServ.CreateSession(r.Context(), email, req.Name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusPaymentRequired)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(session)
}

func GetSessionHandler(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("id")
	if sessionID == "" {
		http.Error(w, "Session ID required", http.StatusBadRequest)
		return
	}

	userEmail := GetUserFromRequest(r)
	session, err := SessionServ.GetSessionWithOwnership(r.Context(), sessionID, userEmail)
	if err != nil {
		http.Error(w, "Session not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(session)
}

func UpdateSessionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	email := GetUserFromRequest(r)
	if email == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req dto.UpdateSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	session, err := SessionServ.SessionRepo.GetByID(r.Context(), req.ID)
	if err != nil || session.OwnerEmail != email {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	if err := SessionServ.SessionRepo.UpdateName(r.Context(), req.ID, req.Name); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func GiphyProxyHandler(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Query required", http.StatusBadRequest)
		return
	}

	apiKey := config.AppConfig.GiphyAPIKey
	url := "https://api.giphy.com/v1/gifs/search?api_key=" + apiKey + "&q=" + query + "&limit=12&rating=g"

	resp, err := http.Get(url)
	if err != nil {
		http.Error(w, "Failed to reach Giphy", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	var data interface{}
	json.NewDecoder(resp.Body).Decode(&data)
	json.NewEncoder(w).Encode(data)
}
