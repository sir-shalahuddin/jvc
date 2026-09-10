package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"retro-gcp/config"
	"retro-gcp/dto"
	"retro-gcp/services"
	"strings"
	"sync"
	"time"
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
	giphyURL := "https://api.giphy.com/v1/gifs/search?api_key=" + apiKey + "&q=" + url.QueryEscape(query) + "&limit=12&rating=g"

	resp, err := http.Get(giphyURL)
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

var shortLinkCache sync.Map // sessionID -> shortURL

type ShareLinkResponse struct {
	ShortURL    string `json:"short_url"`
	OriginalURL string `json:"original_url"`
	IsShortened bool   `json:"is_shortened"`
}

func SessionShareLinkHandler(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("id")
	if sessionID == "" {
		http.Error(w, "Session ID required", http.StatusBadRequest)
		return
	}

	// Tentukan URL asli sesi Retro
	scheme := "https"
	if r.TLS == nil && r.Header.Get("X-Forwarded-Proto") != "https" {
		host := r.Host
		if strings.HasPrefix(host, "localhost") || strings.HasPrefix(host, "127.0.0.1") {
			scheme = "http"
		}
	}
	originalURL := fmt.Sprintf("%s://%s/session/?id=%s", scheme, r.Host, url.QueryEscape(sessionID))

	// Periksa cache in-memory agar efisien (0ms response)
	if cached, ok := shortLinkCache.Load(sessionID); ok {
		if shortURL, ok := cached.(string); ok && shortURL != "" {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(ShareLinkResponse{
				ShortURL:    shortURL,
				OriginalURL: originalURL,
				IsShortened: true,
			})
			return
		}
	}

	// Panggil API Hanya.Click /shorten dengan timeout 2.5 detik
	shortenServiceURL := strings.TrimRight(config.AppConfig.ShortenLinkURL, "/") + "/shorten"
	reqPayload, _ := json.Marshal(map[string]string{"url": originalURL})

	client := &http.Client{Timeout: 2500 * time.Millisecond}
	resp, err := client.Post(shortenServiceURL, "application/json", bytes.NewBuffer(reqPayload))

	if err == nil && (resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusCreated) {
		defer resp.Body.Close()
		var resData struct {
			ShortURL string `json:"short_url"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&resData); err == nil && resData.ShortURL != "" {
			shortLinkCache.Store(sessionID, resData.ShortURL)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(ShareLinkResponse{
				ShortURL:    resData.ShortURL,
				OriginalURL: originalURL,
				IsShortened: true,
			})
			return
		}
	}

	// Fallback ke tautan asli jika layanan Hanya.Click sedang offline atau lambat
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ShareLinkResponse{
		ShortURL:    originalURL,
		OriginalURL: originalURL,
		IsShortened: false,
	})
}
