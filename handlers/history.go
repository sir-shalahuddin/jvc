package handlers

import (
	"encoding/json"
	"net/http"
	"retro-gcp/models"
)

func HistoryAPIHandler(w http.ResponseWriter, r *http.Request) {
	email := GetUserFromRequest(r)
	if email == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	ctx := r.Context()
	
	user, err := SessionServ.UserRepo.GetByEmail(ctx, email)
	quota := 0
	if err == nil {
		quota = user.SessionQuota
	}

	sessions, err := SessionServ.SessionRepo.GetByOwner(ctx, email)
	if err != nil {
		sessions = []models.Session{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"quota":    quota,
		"sessions": sessions,
	})
}
