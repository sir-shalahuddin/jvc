package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/url"
	"retro-gcp/config"
	"retro-gcp/db"
	"retro-gcp/models"
	"strings"
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

func getBaseURL(r *http.Request) string {
	scheme := "http"
	if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	host := r.Host
	if fwdHost := r.Header.Get("X-Forwarded-Host"); fwdHost != "" {
		host = fwdHost
	}
	return scheme + "://" + host
}

func isHTTPS(r *http.Request) bool {
	return r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https"
}

// setAuthCookie sets (or clears, with an expired time) the auth token cookie with hardened flags.
func setAuthCookie(w http.ResponseWriter, r *http.Request, value string, expires time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    value,
		Expires:  expires,
		HttpOnly: true,
		Secure:   isHTTPS(r),
		SameSite: http.SameSiteLaxMode,
		Path:     "/",
	})
}

func GoogleLoginHandler(w http.ResponseWriter, r *http.Request) {
	state := generateStateOauthCookie(w)

	// Remember a safe same-origin `next` path for after the callback.
	if next := safeNextPath(r.URL.Query().Get("next")); next != "" {
		http.SetCookie(w, &http.Cookie{
			Name:     loginNextCookie,
			Value:    url.QueryEscape(next),
			Expires:  time.Now().Add(15 * time.Minute),
			HttpOnly: true,
			Secure:   isHTTPS(r),
			SameSite: http.SameSiteLaxMode,
			Path:     "/",
		})
	}

	// Create a request-specific copy of OAuth config to dynamically set RedirectURL
	localConfig := *googleOauthConfig
	localConfig.RedirectURL = getBaseURL(r) + "/auth/google/callback"
	
	url := localConfig.AuthCodeURL(state)
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

func GoogleCallbackHandler(w http.ResponseWriter, r *http.Request) {
	oauthState, err := r.Cookie("oauthstate")
	if err != nil || r.FormValue("state") != oauthState.Value {
		http.Error(w, "Invalid oauth state", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	
	// Create a request-specific copy of OAuth config to dynamically set RedirectURL
	localConfig := *googleOauthConfig
	localConfig.RedirectURL = getBaseURL(r) + "/auth/google/callback"

	token, err := localConfig.Exchange(ctx, r.FormValue("code"))
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

	setAuthCookie(w, r, tokenString, time.Now().Add(24*time.Hour))
	http.Redirect(w, r, loginRedirectTarget(w, r), http.StatusTemporaryRedirect)
}

const loginNextCookie = "oauthnext"

// safeNextPath returns next if it is a same-origin absolute path, else "".
// It rejects scheme-relative (//host), backslash tricks, and control characters.
func safeNextPath(next string) string {
	if next == "" || len(next) > 512 || next[0] != '/' {
		return ""
	}
	if strings.HasPrefix(next, "//") || strings.Contains(next, "\\") {
		return ""
	}
	for _, c := range next {
		if c < 0x20 || c == 0x7f {
			return ""
		}
	}
	u, err := url.Parse(next)
	if err != nil || u.Scheme != "" || u.Host != "" || !strings.HasPrefix(u.Path, "/") || strings.HasPrefix(u.Path, "//") {
		return ""
	}
	return next
}

// loginRedirectTarget returns where to send the user after login: the safe
// `next` stored at login start, otherwise /dashboard. It clears the cookie.
func loginRedirectTarget(w http.ResponseWriter, r *http.Request) string {
	target := "/dashboard"
	if c, err := r.Cookie(loginNextCookie); err == nil {
		raw, _ := url.QueryUnescape(c.Value)
		if n := safeNextPath(raw); n != "" {
			target = n
		}
		http.SetCookie(w, &http.Cookie{Name: loginNextCookie, Value: "", Path: "/", MaxAge: -1, HttpOnly: true, SameSite: http.SameSiteLaxMode, Secure: isHTTPS(r)})
	}
	return target
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
		"is_admin":      email == config.AppConfig.AdminEmail,
	})
}

func LogoutHandler(w http.ResponseWriter, r *http.Request) {
	setAuthCookie(w, r, "", time.Now().Add(-1*time.Hour))
	http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
}
