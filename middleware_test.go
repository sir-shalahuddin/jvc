package main

import (
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGzipHandler(t *testing.T) {
	// Create a dummy handler that returns a simple string
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte("Hello, World! This is a test string to be gzipped."))
	})

	gzipWrapped := gzipHandler(handler)

	// Case 1: Request without Accept-Encoding: gzip
	req1 := httptest.NewRequest("GET", "/", nil)
	rr1 := httptest.NewRecorder()
	gzipWrapped.ServeHTTP(rr1, req1)

	if rr1.Header().Get("Content-Encoding") == "gzip" {
		t.Errorf("expected no gzip encoding when Accept-Encoding is not set")
	}
	if rr1.Body.String() != "Hello, World! This is a test string to be gzipped." {
		t.Errorf("unexpected body content: got %q", rr1.Body.String())
	}

	// Case 2: Request with Accept-Encoding: gzip
	req2 := httptest.NewRequest("GET", "/", nil)
	req2.Header.Set("Accept-Encoding", "gzip")
	rr2 := httptest.NewRecorder()
	gzipWrapped.ServeHTTP(rr2, req2)

	if rr2.Header().Get("Content-Encoding") != "gzip" {
		t.Errorf("expected gzip Content-Encoding header")
	}

	// Read and decompress body
	gr, err := gzip.NewReader(rr2.Body)
	if err != nil {
		t.Fatalf("failed to create gzip reader: %v", err)
	}
	defer gr.Close()

	decompressed, err := io.ReadAll(gr)
	if err != nil {
		t.Fatalf("failed to read decompressed body: %v", err)
	}

	expected := "Hello, World! This is a test string to be gzipped."
	if string(decompressed) != expected {
		t.Errorf("expected decompressed body to be %q, got %q", expected, string(decompressed))
	}
}

func TestGzipHandler_SkipCompression(t *testing.T) {
	// Create a dummy handler that returns PNG content type
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		w.Write([]byte("fake-png-data"))
	})

	gzipWrapped := gzipHandler(handler)

	req := httptest.NewRequest("GET", "/image.png", nil)
	req.Header.Set("Accept-Encoding", "gzip")
	rr := httptest.NewRecorder()
	gzipWrapped.ServeHTTP(rr, req)

	if rr.Header().Get("Content-Encoding") == "gzip" {
		t.Errorf("expected no compression for image/png content type")
	}
	if rr.Body.String() != "fake-png-data" {
		t.Errorf("expected intact body, got %q", rr.Body.String())
	}
}
