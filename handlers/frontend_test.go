package handlers

import (
	"bytes"
	"html/template"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"retro-gcp/config"
	"testing"
)

func TestTemplatesParseAndExecute(t *testing.T) {
	// Ensure we can find the templates folder from handlers dir
	templatesDir := "../templates"
	if _, err := os.Stat(templatesDir); os.IsNotExist(err) {
		templatesDir = "templates"
	}

	templates := []string{"index", "about", "contact"}

	for _, tmplName := range templates {
		t.Run(tmplName, func(t *testing.T) {
			path := filepath.Join(templatesDir, tmplName+".html")
			tmpl, err := template.ParseFiles(path)
			if err != nil {
				t.Fatalf("Failed to parse template %s: %v", tmplName, err)
			}

			var buf bytes.Buffer
			err = tmpl.Execute(&buf, config.AppConfig)
			if err != nil {
				t.Fatalf("Failed to execute template %s: %v", tmplName, err)
			}

			if buf.Len() == 0 {
				t.Fatalf("Template %s produced empty output", tmplName)
			}
		})
	}
}

// The SPA handlers serve frontend/dist/index.html when it exists and otherwise
// answer 503 with a clear message (no legacy template fallback).
func TestSPAHandlers(t *testing.T) {
	built := getSPAIndexPath() != ""
	handlers := map[string]http.HandlerFunc{
		"/dashboard":    DashboardHandler,
		"/session?id=x": SessionHandler,
		"/admin":        AdminUIHandler,
	}
	for path, h := range handlers {
		req := httptest.NewRequest("GET", path, nil)
		rr := httptest.NewRecorder()
		h(rr, req)
		if built {
			if rr.Code != http.StatusOK {
				t.Errorf("%s: expected 200 when dist exists, got %d", path, rr.Code)
			}
			continue
		}
		if rr.Code != http.StatusServiceUnavailable {
			t.Errorf("%s: expected 503 when dist is missing, got %d", path, rr.Code)
		}
		if !bytes.Contains(rr.Body.Bytes(), []byte("frontend/dist")) {
			t.Errorf("%s: 503 body should explain the missing build, got %q", path, rr.Body.String())
		}
	}
}
