package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"retro-gcp/config"
	"time"

	"cloud.google.com/go/storage"
)

func UploadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	err := r.ParseMultipartForm(10 << 20) // 10 MB limit
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	file, handler, err := r.FormFile("image")
	if err != nil {
		http.Error(w, "Error retrieving the file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	ctx := r.Context()
	client, err := storage.NewClient(ctx)
	if err != nil {
		http.Error(w, "Failed to create storage client", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	ext := filepath.Ext(handler.Filename)
	filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	
	bucket := client.Bucket(config.AppConfig.GCSBucketName)
	obj := bucket.Object(filename)
	
	wc := obj.NewWriter(ctx)
	if _, err := io.Copy(wc, file); err != nil {
		http.Error(w, "Failed to upload to storage", http.StatusInternalServerError)
		return
	}
	if err := wc.Close(); err != nil {
		http.Error(w, "Failed to close storage writer", http.StatusInternalServerError)
		return
	}

	// Assuming the bucket is publicly accessible or you use a specific URL format
	publicURL := fmt.Sprintf("https://storage.googleapis.com/%s/%s", config.AppConfig.GCSBucketName, filename)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"url": publicURL,
	})
}
