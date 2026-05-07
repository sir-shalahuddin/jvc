package handlers

import (
	"encoding/json"
	"net/http"
	"retro-gcp/config"
)

func AdminAPIHandler(w http.ResponseWriter, r *http.Request) {
	email := GetUserFromRequest(r)
	if email == "" || email != config.AppConfig.AdminEmail {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	ctx := r.Context()

	if r.Method == http.MethodDelete {
		sessionID := r.URL.Query().Get("id")
		if sessionID != "" {
			SessionServ.SessionRepo.Delete(ctx, sessionID)
			w.WriteHeader(http.StatusOK)
			return
		}
	}

	sessions, err := SessionServ.SessionRepo.GetAll(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sessions)
}
