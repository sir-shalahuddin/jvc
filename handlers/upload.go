package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"retro-gcp/config"
	"strings"
	"time"

	"cloud.google.com/go/storage"
)

var allowedImageExtensions = map[string]bool{
	".jpg":  true,
	".jpeg": true,
	".png":  true,
	".webp": true,
	".gif":  true,
}

var allowedImageMIMEs = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
	"image/gif":  true,
}

func UploadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 1. Authentication Check
	email := GetUserFromRequest(r)
	if email == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// 2. Parse Multipart Form (10 MB limit)
	err := r.ParseMultipartForm(10 << 20)
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

	// 3. Extension Validation
	ext := strings.ToLower(filepath.Ext(handler.Filename))
	if !allowedImageExtensions[ext] {
		http.Error(w, "Invalid file extension. Only JPG, PNG, WEBP, and GIF images are allowed", http.StatusBadRequest)
		return
	}

	// 4. MIME-type Sniffing (Magic Bytes Verification)
	sniffBuf := make([]byte, 512)
	n, err := file.Read(sniffBuf)
	if err != nil && err != io.EOF {
		http.Error(w, "Failed to read file", http.StatusBadRequest)
		return
	}
	detectedType := http.DetectContentType(sniffBuf[:n])
	if !allowedImageMIMEs[detectedType] {
		http.Error(w, "Invalid file format: content is not a supported image type", http.StatusBadRequest)
		return
	}

	// Reset read pointer to beginning of file
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		http.Error(w, "Failed to process file stream", http.StatusInternalServerError)
		return
	}

	ctx := r.Context()
	client, err := storage.NewClient(ctx)
	if err != nil {
		http.Error(w, "Failed to create storage client", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	
	bucket := client.Bucket(config.AppConfig.GCSBucketName)
	obj := bucket.Object(filename)
	
	wc := obj.NewWriter(ctx)
	wc.ContentType = detectedType
	if _, err := io.Copy(wc, file); err != nil {
		http.Error(w, "Failed to upload to storage", http.StatusInternalServerError)
		return
	}
	if err := wc.Close(); err != nil {
		http.Error(w, "Failed to close storage writer", http.StatusInternalServerError)
		return
	}

	publicURL := fmt.Sprintf("https://storage.googleapis.com/%s/%s", config.AppConfig.GCSBucketName, filename)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"url": publicURL,
	})
}
