package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
)

type ClusterAnswerRequest struct {
	SessionID  string `json:"session_id"`
	AnswerID   string `json:"answer_id"`
	ClusterTag string `json:"cluster_tag"`
	ParentID   string `json:"parent_id,omitempty"`
}

type ClusterTagCount struct {
	Tag   string `json:"tag"`
	Count int    `json:"count"`
}

// ClusterAnswerHandler allows session moderators to assign, change, or remove thematic cluster tags on reflection cards.
func ClusterAnswerHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ClusterAnswerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.SessionID == "" || req.AnswerID == "" {
		http.Error(w, "session_id and answer_id are required", http.StatusBadRequest)
		return
	}

	// Moderator Authorization Check
	email := GetUserFromRequest(r)
	session, err := SessionServ.SessionRepo.GetByID(r.Context(), req.SessionID)
	if err != nil || session == nil || session.OwnerEmail != email {
		http.Error(w, "Unauthorized: only session moderator can cluster cards", http.StatusForbidden)
		return
	}

	// Clean tag: remove leading hashes and excess spaces
	cleanedTag := strings.TrimSpace(req.ClusterTag)
	cleanedTag = strings.TrimPrefix(cleanedTag, "#")
	cleanedTag = strings.TrimSpace(cleanedTag)

	if err := AnswerRepo.UpdateCluster(r.Context(), req.SessionID, req.AnswerID, cleanedTag, req.ParentID); err != nil {
		http.Error(w, "Failed to update cluster tag: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":      "success",
		"answer_id":   req.AnswerID,
		"cluster_tag": cleanedTag,
		"parent_id":   req.ParentID,
	})
}

// GetClustersHandler returns all distinct cluster tags and their card counts for a session.
func GetClustersHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	sessionID := r.URL.Query().Get("session_id")
	if sessionID == "" {
		http.Error(w, "session_id required", http.StatusBadRequest)
		return
	}

	answers, err := AnswerRepo.GetBySession(r.Context(), sessionID)
	if err != nil {
		http.Error(w, "Failed to fetch answers: "+err.Error(), http.StatusInternalServerError)
		return
	}

	tagCounts := make(map[string]int)
	for _, a := range answers {
		tag := strings.TrimSpace(a.ClusterTag)
		if tag != "" {
			tagCounts[tag]++
		}
	}

	var results []ClusterTagCount
	for tag, count := range tagCounts {
		results = append(results, ClusterTagCount{Tag: tag, Count: count})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}
