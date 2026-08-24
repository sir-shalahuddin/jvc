package handlers

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"retro-gcp/config"
	"retro-gcp/dto"
	"retro-gcp/models"
	"retro-gcp/repositories"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/microcosm-cc/bluemonday"
)

const (
	MaxVotesPerParticipant = 5
	GuestCookieName        = "retro_guest_token"
)

var (
	guestAdjectives = []string{
		"Brave", "Clever", "Swift", "Cosmic", "Curious",
		"Silent", "Radiant", "Epic", "Gentle", "Nimble",
		"Bright", "Wise", "Mystic", "Golden", "Astro",
		"Cyber", "Neon", "Happy", "Lucky", "Zen",
		"Dynamic", "Stellar", "Hyper", "Solar", "Lunar",
	}
	guestAnimals = []string{
		"Panda", "Fox", "Otter", "Falcon", "Dolphin",
		"Owl", "Tiger", "Koala", "Lynx", "Penguin",
		"Badger", "Eagle", "Gecko", "Wolf", "Bear",
		"Hawk", "Rabbit", "Shark", "Deer", "Lion",
		"Cheetah", "Beaver", "Hedgehog", "Jaguar", "Phoenix",
	}
)

type IAnswerRepository interface {
	Create(ctx context.Context, sessionID string, a models.Answer) error
	GetBySession(ctx context.Context, sessionID string) ([]models.Answer, error)
	UpdateSentiment(ctx context.Context, sessionID string, answerID string, emotion, color, emoji string) error
	IncrementVotes(ctx context.Context, sessionID string, answerID string) (int, error)
	GetVoterRecord(ctx context.Context, sessionID string, voterID string) (*models.VoterRecord, error)
	CastVote(ctx context.Context, sessionID string, answerID string, voterID string, maxVotes int) (int, int, error)
}

var AnswerRepo IAnswerRepository

func getGuestHMACKey() []byte {
	if config.AppConfig.JWTSecret != "" {
		return []byte(config.AppConfig.JWTSecret)
	}
	return []byte("retro-gcp-guest-voting-secret-key-2026")
}

func signGuestData(data string) string {
	mac := hmac.New(sha256.New, getGuestHMACKey())
	mac.Write([]byte(data))
	return hex.EncodeToString(mac.Sum(nil))
}

func generateRandomGuestName(seedUUID string) string {
	h := sha256.Sum256([]byte(seedUUID))
	adjIdx := int(h[0]) % len(guestAdjectives)
	animIdx := int(h[1]) % len(guestAnimals)
	return fmt.Sprintf("%s %s", guestAdjectives[adjIdx], guestAnimals[animIdx])
}

func getOrCreateSignedGuestToken(w http.ResponseWriter, r *http.Request) (string, string) {
	cookie, err := r.Cookie(GuestCookieName)
	if err == nil && cookie.Value != "" {
		parts := strings.Split(cookie.Value, ".")
		if len(parts) == 4 {
			guestUUID := parts[0]
			guestNameBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
			tsStr := parts[2]
			providedSig := parts[3]

			if err == nil {
				guestName := string(guestNameBytes)
				data := fmt.Sprintf("%s.%s.%s", guestUUID, parts[1], tsStr)
				expectedSig := signGuestData(data)

				if hmac.Equal([]byte(providedSig), []byte(expectedSig)) {
					// Signature valid! Return verified guest UUID and name
					return guestUUID, guestName
				}
			}
		}
	}

	// Generate a fresh cryptographically signed guest UUID and deterministic random alias
	newUUID := uuid.New().String()
	guestName := generateRandomGuestName(newUUID)
	encodedName := base64.RawURLEncoding.EncodeToString([]byte(guestName))
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	data := fmt.Sprintf("%s.%s.%s", newUUID, encodedName, ts)
	sig := signGuestData(data)
	signedToken := fmt.Sprintf("%s.%s.%s.%s", newUUID, encodedName, ts, sig)

	http.SetCookie(w, &http.Cookie{
		Name:     GuestCookieName,
		Value:    signedToken,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   86400 * 30, // 30 days
	})

	return newUUID, guestName
}

func computeEffectiveVoterID(guestUUID string, deviceFingerprint string) string {
	h := sha256.New()
	h.Write([]byte(guestUUID + ":" + deviceFingerprint))
	return hex.EncodeToString(h.Sum(nil))
}

func SubmitAnswerHandler(w http.ResponseWriter, r *http.Request) {
	var req dto.SubmitAnswerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	p := bluemonday.UGCPolicy()
	sanitizedText := p.Sanitize(req.Text)

	// Obtain verified cryptographically signed random guest name
	_, guestName := getOrCreateSignedGuestToken(w, r)
	if guestName == "" {
		guestName = "Anonymous Guest"
	}

	ansID := uuid.New().String()
	ans := models.Answer{
		ID:               ansID,
		QuestionID:       req.QuestionID,
		SessionID:        req.SessionID,
		Text:             sanitizedText,
		GifURL:           req.GifURL,
		AuthorName:       guestName,
		SentimentEmotion: "Analyzing...",
		SentimentColor:   "#9CA3AF",
		SentimentEmoji:   "⏳",
		CreatedAt:        time.Now(),
	}

	if err := AnswerRepo.Create(r.Context(), req.SessionID, ans); err != nil {
		log.Printf("Repo Error: %v", err)
		http.Error(w, "Error saving answer", http.StatusInternalServerError)
		return
	}

	InvalidateSummaryCache(req.SessionID)

	QueueSentimentAnalysis(ansID, req.SessionID, sanitizedText)

	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]interface{}{"id": ansID, "status": "success", "author_name": guestName})
}

func GetAnswersHandler(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("session_id")
	if sessionID == "" {
		http.Error(w, "session_id required", http.StatusBadRequest)
		return
	}

	answers, err := AnswerRepo.GetBySession(r.Context(), sessionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// 1. Sort by CreatedAt ascending for consistent ordering
	sort.Slice(answers, func(i, j int) bool {
		return answers[i].CreatedAt.Before(answers[j].CreatedAt)
	})

	// 2. Filter by question_id if specified
	qID := r.URL.Query().Get("question_id")
	if qID != "" {
		var filtered []models.Answer
		for _, ans := range answers {
			if ans.QuestionID == qID {
				filtered = append(filtered, ans)
			}
		}
		answers = filtered
	}

	// 3. Handle Pagination (Limit / Offset)
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	var limit, offset int
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}
	if offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
	}

	if offset > 0 {
		if offset >= len(answers) {
			answers = []models.Answer{}
		} else {
			answers = answers[offset:]
		}
	}

	if limit > 0 && limit < len(answers) {
		answers = answers[:limit]
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(answers)
}

func VoteAnswerHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		SessionID         string `json:"session_id"`
		AnswerID          string `json:"answer_id"`
		DeviceFingerprint string `json:"device_fingerprint"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	if req.SessionID == "" || req.AnswerID == "" {
		http.Error(w, "session_id and answer_id required", http.StatusBadRequest)
		return
	}

	// 1. Layer 1: Server-Signed HMAC Cookie
	guestUUID, _ := getOrCreateSignedGuestToken(w, r)

	// 2. Layer 2: Browser Hardware Fingerprint
	fp := req.DeviceFingerprint
	if fp == "" {
		fp = r.Header.Get("X-Device-Fingerprint")
	}
	voterID := computeEffectiveVoterID(guestUUID, fp)

	// 3. Layer 3: Dot Voting Quota Enforcement via Firestore Transaction
	newVotes, remVotes, err := AnswerRepo.CastVote(r.Context(), req.SessionID, req.AnswerID, voterID, MaxVotesPerParticipant)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		if errors.Is(err, repositories.ErrAlreadyVoted) {
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"status":  "error",
				"message": "You've already upvoted this card!",
			})
			return
		}
		if errors.Is(err, repositories.ErrVoteQuotaExceeded) {
			w.WriteHeader(http.StatusTooManyRequests)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"status":  "error",
				"message": fmt.Sprintf("You have reached your %d dot-vote limit for this session!", MaxVotesPerParticipant),
			})
			return
		}
		log.Printf("Error casting vote for answer %s: %v", req.AnswerID, err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":  "error",
			"message": "Error recording vote",
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":          "success",
		"votes":           newVotes,
		"remaining_votes": remVotes,
		"max_votes":       MaxVotesPerParticipant,
	})
}

func VoterStatusHandler(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("session_id")
	if sessionID == "" {
		http.Error(w, "session_id required", http.StatusBadRequest)
		return
	}

	guestUUID, guestName := getOrCreateSignedGuestToken(w, r)
	fp := r.URL.Query().Get("device_fingerprint")
	if fp == "" {
		fp = r.Header.Get("X-Device-Fingerprint")
	}
	voterID := computeEffectiveVoterID(guestUUID, fp)

	rec, err := AnswerRepo.GetVoterRecord(r.Context(), sessionID, voterID)
	if err != nil {
		http.Error(w, "Error retrieving voter status", http.StatusInternalServerError)
		return
	}

	rem := MaxVotesPerParticipant - rec.TotalVotes
	if rem < 0 {
		rem = 0
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"guest_name":      guestName,
		"guest_id":        guestUUID,
		"total_votes":     rec.TotalVotes,
		"remaining_votes": rem,
		"max_votes":       MaxVotesPerParticipant,
		"voted_answers":   rec.VotedAnswers,
	})
}
