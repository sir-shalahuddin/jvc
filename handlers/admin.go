package handlers

import (
	"encoding/json"
	"net/http"
	"retro-gcp/config"
	"retro-gcp/repositories"
)

var (
	UserRepo *repositories.UserRepository
	TranRepo *repositories.TransactionRepository
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

func AdminStatsHandler(w http.ResponseWriter, r *http.Request) {
	email := GetUserFromRequest(r)
	if email == "" || email != config.AppConfig.AdminEmail {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	ctx := r.Context()

	sessions, err := SessionServ.SessionRepo.GetAll(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	users, err := UserRepo.GetAll(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	trans, err := TranRepo.GetAll(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	totalRevenue := 0
	for _, t := range trans {
		totalRevenue += t.Quantity
	}

	recentSessions := sessions
	if len(recentSessions) > 10 {
		recentSessions = recentSessions[:10]
	}

	resp := map[string]interface{}{
		"total_sessions":  len(sessions),
		"total_users":     len(users),
		"total_revenue":   totalRevenue,
		"recent_sessions": recentSessions,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
