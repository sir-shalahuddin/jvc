package config

import (
	"os"
)

type Config struct {
	GCPProjectID       string
	GCSBucketName      string
	GeminiAPIKey       string
	GoogleClientID     string
	GoogleClientSecret string
	AuthRedirectURL    string
	JWTSecret          string
	Port               string
	AdminEmail         string
}

var AppConfig Config

func LoadConfig() {
	AppConfig = Config{
		GCPProjectID:       getEnv("GCP_PROJECT_ID", "your-project-id"),
		GCSBucketName:      getEnv("GCS_BUCKET_NAME", "retro-gcp-uploads"),
		GeminiAPIKey:       getEnv("GEMINI_API_KEY", ""),
		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		AuthRedirectURL:    getEnv("AUTH_REDIRECT_URL", "http://localhost:8080/auth/google/callback"),
		JWTSecret:          getEnv("JWT_SECRET", "super-secret-key"),
		Port:               getEnv("PORT", "8080"),
		AdminEmail:         getEnv("ADMIN_EMAIL", "sirajshalahuddin@gmail.com"),
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
