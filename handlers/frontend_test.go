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

	templates := []string{"session", "index", "admin", "about", "contact", "checkout"}

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

func TestDashboardAndAdminHandlers(t *testing.T) {
	// Test DashboardHandler
	req, _ := http.NewRequest("GET", "/dashboard", nil)
	rr := httptest.NewRecorder()
	DashboardHandler(rr, req)

	// Since frontend/dist may not be found relative to package handlers when testing,
	// it will redirect to "/" or serve 200 OK
	if rr.Code != http.StatusOK && rr.Code != http.StatusTemporaryRedirect {
		t.Errorf("expected status 200 or 307 for DashboardHandler, got %d", rr.Code)
	}

	// Test SessionHandler
	reqSession, _ := http.NewRequest("GET", "/session?id=test", nil)
	rrSession := httptest.NewRecorder()
	SessionHandler(rrSession, reqSession)
	if rrSession.Code != http.StatusOK {
		t.Errorf("expected status 200 for SessionHandler, got %d", rrSession.Code)
	}
}

