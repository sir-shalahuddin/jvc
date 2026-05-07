package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"retro-gcp/config"
	"retro-gcp/db"
	"retro-gcp/models"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

var (
	googleOauthConfig *oauth2.Config
	jwtSecret         []byte
)

func InitAuth() {
	googleOauthConfig = &oauth2.Config{
		RedirectURL:  config.AppConfig.AuthRedirectURL,
		ClientID:     config.AppConfig.GoogleClientID,
		ClientSecret: config.AppConfig.GoogleClientSecret,
		Scopes:       []string{"https://www.googleapis.com/auth/userinfo.email"},
		Endpoint:     google.Endpoint,
	}
	jwtSecret = []byte(config.AppConfig.JWTSecret)
}

func generateStateOauthCookie(w http.ResponseWriter) string {
	b := make([]byte, 16)
	rand.Read(b)
	state := base64.URLEncoding.EncodeToString(b)
	cookie := http.Cookie{
		Name:     "oauthstate",
		Value:    state,
		Expires:  time.Now().Add(24 * time.Hour),
		HttpOnly: true,
		Path:     "/",
	}
	http.SetCookie(w, &cookie)
	return state
}

func GoogleLoginHandler(w http.ResponseWriter, r *http.Request) {
	state := generateStateOauthCookie(w)
	url := googleOauthConfig.AuthCodeURL(state)
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

func GoogleCallbackHandler(w http.ResponseWriter, r *http.Request) {
	oauthState, err := r.Cookie("oauthstate")
	if err != nil || r.FormValue("state") != oauthState.Value {
		http.Error(w, "Invalid oauth state", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	token, err := googleOauthConfig.Exchange(ctx, r.FormValue("code"))
	if err != nil {
		http.Error(w, "Code exchange failed", http.StatusBadRequest)
		return
	}

	req, _ := http.NewRequestWithContext(ctx, "GET", "https://www.googleapis.com/oauth2/v2/userinfo?access_token="+token.AccessToken, nil)
	client := &http.Client{}
	rawAccountRes, err := client.Do(req)
	if err != nil {
		http.Error(w, "User info get failed", http.StatusBadRequest)
		return
	}
	defer rawAccountRes.Body.Close()

	var accountInfo struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(rawAccountRes.Body).Decode(&accountInfo); err != nil {
		http.Error(w, "Invalid user JSON", http.StatusBadRequest)
		return
	}

	// Update user in Firestore
	userRef := db.Client.Collection("users").Doc(accountInfo.Email)
	_, err = userRef.Get(ctx)

	quota := 1
	if accountInfo.Email == config.AppConfig.AdminEmail {
		quota = 999999
	}

	if err != nil {
		// New user
		userRef.Set(ctx, models.User{
			Email:        accountInfo.Email,
			SessionQuota: quota,
			CreatedAt:    time.Now(),
		})
	} else if accountInfo.Email == config.AppConfig.AdminEmail {
		// Ensure admin always has quota
		userRef.Set(ctx, map[string]interface{}{
			"session_quota": quota,
		}, firestore.MergeAll)
	}

	// Create JWT token
	jwtToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"email": accountInfo.Email,
		"exp":   time.Now().Add(24 * time.Hour).Unix(),
	})
	tokenString, err := jwtToken.SignedString(jwtSecret)
	if err != nil {
		http.Error(w, "Token sign failed", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    tokenString,
		Expires:  time.Now().Add(24 * time.Hour),
		HttpOnly: true,
		Path:     "/",
	})
	http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
}

func GetUserFromRequest(r *http.Request) string {
	cookie, err := r.Cookie("token")
	if err != nil {
		return ""
	}
	token, err := jwt.Parse(cookie.Value, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return ""
	}
	if claims, ok := token.Claims.(jwt.MapClaims); ok {
		if email, ok := claims["email"].(string); ok {
			return email
		}
	}
	return ""
}

func MeHandler(w http.ResponseWriter, r *http.Request) {
	email := GetUserFromRequest(r)
	w.Header().Set("Content-Type", "application/json")
	if email == "" {
		json.NewEncoder(w).Encode(map[string]interface{}{"authenticated": false})
		return
	}

	ctx := r.Context()
	doc, err := db.Client.Collection("users").Doc(email).Get(ctx)
	quota := 0
	if err == nil {
		var user models.User
		doc.DataTo(&user)
		quota = user.SessionQuota
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"authenticated": true,
		"email":         email,
		"quota":         quota,
	})
}

func LogoutHandler(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    "",
		Expires:  time.Now().Add(-1 * time.Hour),
		HttpOnly: true,
		Path:     "/",
	})
	http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
}
