package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"retro-gcp/config"
	"retro-gcp/db"
	"retro-gcp/models"
	"retro-gcp/repositories"
	"strconv"
	"strings"
	"time"

	"google.golang.org/api/iterator"
)

var (
	UserRepo *repositories.UserRepository
	TranRepo *repositories.TransactionRepository
)

const (
	adminDefaultPageSize = 20
	adminMaxPageSize     = 50
)

var processStartedAt = time.Now()

// firestorePing checks that Firestore answers a trivial read. Overridden in tests.
var firestorePing = func(ctx context.Context) error {
	if db.Client == nil {
		return context.Canceled
	}
	_, err := db.Client.Collection("sessions").Limit(1).Documents(ctx).Next()
	if err == iterator.Done {
		return nil
	}
	return err
}

// adminHealth reports real status: a Firestore ping with latency, and uptime since process start.
func adminHealth(ctx context.Context) map[string]interface{} {
	pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	start := time.Now()
	err := firestorePing(pingCtx)
	status := "ok"
	if err != nil {
		status = "degraded"
	}
	return map[string]interface{}{
		"status":             status,
		"firestore_ok":       err == nil,
		"firestore_ms":       time.Since(start).Milliseconds(),
		"uptime_seconds":     int64(time.Since(processStartedAt).Seconds()),
		"started_at_unix_ms": processStartedAt.UnixMilli(),
	}
}

// sessionForgetter is implemented by repositories that keep in-memory caches.
type sessionForgetter interface{ ForgetSession(sessionID string) }

// forgetSessionState drops every in-memory trace of a deleted session.
func forgetSessionState(sessionID string) {
	if f, ok := AnswerRepo.(sessionForgetter); ok {
		f.ForgetSession(sessionID)
	}
	if f, ok := ActionItemRepo.(sessionForgetter); ok {
		f.ForgetSession(sessionID)
	}
	timerMu.Lock()
	delete(timerStates, sessionID)
	timerMu.Unlock()
	spotlightMu.Lock()
	delete(spotlightStates, sessionID)
	spotlightMu.Unlock()
	presenceMu.Lock()
	delete(presenceStates, sessionID)
	presenceMu.Unlock()
	InvalidateSummaryCache(sessionID)
	shortLinkCache.Delete(sessionID)
}

func AdminAPIHandler(w http.ResponseWriter, r *http.Request) {
	email := GetUserFromRequest(r)
	if email == "" || email != config.AppConfig.AdminEmail {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	ctx := r.Context()

	if r.Method == http.MethodDelete {
		sessionID := r.URL.Query().Get("id")
		if sessionID == "" {
			writeJSONError(w, http.StatusBadRequest, "id required")
			return
		}
		if err := SessionServ.SessionRepo.DeleteWithRelated(ctx, sessionID); err != nil {
			writeJSONError(w, http.StatusInternalServerError, "Failed to delete session: "+err.Error())
			return
		}
		forgetSessionState(sessionID)
		w.WriteHeader(http.StatusOK)
		return
	}

	sessions, err := SessionServ.SessionRepo.GetAll(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Search over name and owner email.
	if q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q"))); q != "" {
		filtered := make([]models.Session, 0, len(sessions))
		for _, s := range sessions {
			if strings.Contains(strings.ToLower(s.Name), q) || strings.Contains(strings.ToLower(s.OwnerEmail), q) {
				filtered = append(filtered, s)
			}
		}
		sessions = filtered
	}

	page, pageSize := 1, adminDefaultPageSize
	if n, err := strconv.Atoi(r.URL.Query().Get("page")); err == nil && n > 0 {
		page = n
	}
	if n, err := strconv.Atoi(r.URL.Query().Get("page_size")); err == nil && n > 0 {
		pageSize = n
	}
	if pageSize > adminMaxPageSize {
		pageSize = adminMaxPageSize
	}

	total := len(sessions)
	start := (page - 1) * pageSize
	if start > total {
		start = total
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	pageItems := make([]models.Session, end-start)
	copy(pageItems, sessions[start:end])
	for i := range pageItems {
		pageItems[i].Phase = pageItems[i].EffectivePhase()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"sessions":  pageItems,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
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
		"health":          adminHealth(ctx),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
