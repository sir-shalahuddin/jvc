package handlers

import (
	"html/template"
	"net/http"
	"os"
	"path/filepath"
	"retro-gcp/config"
	"sync"
)

var (
	templatesMap = make(map[string]*template.Template)
	templatesMu  sync.RWMutex
)

func getSPAIndexPath() string {
	spaIndex := filepath.Join("frontend", "dist", "index.html")
	if _, err := os.Stat(spaIndex); err == nil {
		return spaIndex
	}
	parent := filepath.Join("..", "frontend", "dist", "index.html")
	if _, err := os.Stat(parent); err == nil {
		return parent
	}
	return ""
}

func renderTemplate(w http.ResponseWriter, tmpl string, data interface{}) {
	templatesMu.RLock()
	t, cached := templatesMap[tmpl]
	templatesMu.RUnlock()

	if !cached {
		tmplPath := filepath.Join("templates", tmpl+".html")
		if _, err := os.Stat(tmplPath); os.IsNotExist(err) {
			tmplPath = filepath.Join("..", "templates", tmpl+".html")
		}
		var err error
		t, err = template.ParseFiles(tmplPath)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		templatesMu.Lock()
		templatesMap[tmpl] = t
		templatesMu.Unlock()
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	t.Execute(w, data)
}

func HomeHandler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	renderTemplate(w, "index", config.AppConfig)
}

func DashboardHandler(w http.ResponseWriter, r *http.Request) {
	if spa := getSPAIndexPath(); spa != "" {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		http.ServeFile(w, r, spa)
		return
	}
	http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
}

func SessionHandler(w http.ResponseWriter, r *http.Request) {
	if spa := getSPAIndexPath(); spa != "" {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		http.ServeFile(w, r, spa)
		return
	}
	renderTemplate(w, "session", config.AppConfig)
}

func AdminUIHandler(w http.ResponseWriter, r *http.Request) {
	if spa := getSPAIndexPath(); spa != "" {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		http.ServeFile(w, r, spa)
		return
	}
	renderTemplate(w, "admin", config.AppConfig)
}


func AboutHandler(w http.ResponseWriter, r *http.Request) {
	renderTemplate(w, "about", config.AppConfig)
}

func ContactHandler(w http.ResponseWriter, r *http.Request) {
	renderTemplate(w, "contact", config.AppConfig)
}

func CheckoutHandler(w http.ResponseWriter, r *http.Request) {
	http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
}
