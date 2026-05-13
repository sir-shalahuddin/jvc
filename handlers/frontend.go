package handlers

import (
	"html/template"
	"net/http"
	"path/filepath"
	"retro-gcp/config"
)

func renderTemplate(w http.ResponseWriter, tmpl string, data interface{}) {
	tmplPath := filepath.Join("templates", tmpl+".html")
	t, err := template.ParseFiles(tmplPath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	t.Execute(w, data)
}

func HomeHandler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	renderTemplate(w, "index", config.AppConfig)
}

func SessionHandler(w http.ResponseWriter, r *http.Request) {
	renderTemplate(w, "session", config.AppConfig)
}

func AdminUIHandler(w http.ResponseWriter, r *http.Request) {
	renderTemplate(w, "admin", config.AppConfig)
}

func AboutHandler(w http.ResponseWriter, r *http.Request) {
	renderTemplate(w, "about", config.AppConfig)
}

func ContactHandler(w http.ResponseWriter, r *http.Request) {
	renderTemplate(w, "contact", config.AppConfig)
}

func CheckoutHandler(w http.ResponseWriter, r *http.Request) {
	renderTemplate(w, "checkout", config.AppConfig)
}
