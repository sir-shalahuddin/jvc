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
	GiphyAPIKey        string
	DuitkuMerchantCode string
	DuitkuAPIKey       string
	ContactEmail       string
	ContactPhone       string
	ContactAddress     string
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
		GiphyAPIKey:        getEnv("GIPHY_API_KEY", ""),
		DuitkuMerchantCode: getEnv("DUITKU_MERCHANT_CODE", ""),
		DuitkuAPIKey:       getEnv("DUITKU_API_KEY", ""),
		ContactEmail:       getEnv("CONTACT_EMAIL", "support@hanya.click"),
		ContactPhone:       getEnv("CONTACT_PHONE", "+62 812-3456-7890"),
		ContactAddress:     getEnv("CONTACT_ADDRESS", "Jl. Jenderal Sudirman Kav. 52-53, Jakarta Selatan, 12190, Indonesia"),
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
