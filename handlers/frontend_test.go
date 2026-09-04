package handlers

import (
	"bytes"
	"html/template"
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
