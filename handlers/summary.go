package handlers

import (
	"bytes"
	"html"
	"html/template"
	"net/http"
	"retro-gcp/models"
	"sort"
	"strconv"
	"strings"
)

var indonesianMonths = [...]string{"Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"}

type summaryCard struct {
	Text       string
	Votes      int
	ClusterTag string
}

type summaryTopic struct {
	Title string
	Cards []summaryCard
}

type summaryView struct {
	Name     string
	Date     string
	Topics   []summaryTopic
	Clusters []ClusterTagCount
	Actions  []models.ActionItem
	Message  string
}

const summaryCSS = `
:root{--paper:#fff;--ink:#121419;--muted:#5e6472;--rule:#e5e7eb;--link:#2563EB;--ok:#067647;--sans:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",sans-serif}
@media (prefers-color-scheme:dark){:root{--paper:#0e1014;--ink:#eceef2;--muted:#9aa0ac;--rule:#252931;--link:#86a8ff;--ok:#6ce9a6}}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);font-size:15px;line-height:1.55;padding:0 20px 56px;-webkit-font-smoothing:antialiased}
main{max-width:680px;margin:0 auto}
a{color:var(--link);text-decoration:none}a:hover{text-decoration:underline;text-underline-offset:3px}
header{padding:24px 0 20px;border-bottom:1px solid var(--rule)}
.brand{font-weight:800;font-size:15px;color:var(--ink)}
h1{font-size:28px;line-height:1.2;letter-spacing:-.01em;margin:18px 0 4px}
.date{color:var(--muted);margin:0}
h2{font-size:17px;margin:36px 0 12px;padding-bottom:8px;border-bottom:1px solid var(--rule)}
ul{list-style:none;margin:0;padding:0}
li{padding:12px 0;border-bottom:1px solid var(--rule)}
.meta{display:block;color:var(--muted);font-size:13px;margin-top:2px}
.votes{font-variant-numeric:tabular-nums}
.done{color:var(--ok);font-weight:600}
.empty{color:var(--muted)}
`

var summaryTmpl = template.Must(template.New("summary").Parse(`<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>{{.Name}} · Ringkasan · retro.hanya.click</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
<style>` + summaryCSS + `</style>
</head>
<body>
<main>
<header><a class="brand" href="/">retro.hanya.click</a>
<h1>{{.Name}}</h1>
{{if .Date}}<p class="date">{{.Date}}</p>{{end}}
</header>
{{if .Message}}<p class="empty">{{.Message}}</p>{{else}}
{{range .Topics}}
<section>
<h2>{{.Title}}</h2>
{{if .Cards}}<ul>
{{range .Cards}}<li>{{.Text}}<span class="meta"><span class="votes">{{.Votes}} suara</span>{{if .ClusterTag}} · {{.ClusterTag}}{{end}}</span></li>
{{end}}</ul>{{else}}<p class="empty">Tidak ada kartu.</p>{{end}}
</section>
{{end}}
<section>
<h2>Kelompok</h2>
{{if .Clusters}}<ul>
{{range .Clusters}}<li>{{.Tag}}<span class="meta">{{.Count}} kartu</span></li>
{{end}}</ul>{{else}}<p class="empty">Belum ada kelompok.</p>{{end}}
</section>
<section>
<h2>Aksi</h2>
{{if .Actions}}<ul>
{{range .Actions}}<li>{{.Text}}<span class="meta">{{.Assignee}} · {{.DueDate}} · {{if .Completed}}<span class="done">Selesai</span>{{else}}Belum selesai{{end}}</span></li>
{{end}}</ul>{{else}}<p class="empty">Belum ada aksi.</p>{{end}}
</section>
{{end}}
</main>
</body>
</html>
`))

func writeSummaryHTML(w http.ResponseWriter, status int, v summaryView) {
	var buf bytes.Buffer
	if err := summaryTmpl.Execute(&buf, v); err != nil {
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("X-Robots-Tag", "noindex")
	w.WriteHeader(status)
	w.Write(buf.Bytes())
}

// SessionSummaryHandler renders the read-only summary page for a session.
// Same access as the board: anyone with the session id.
func SessionSummaryHandler(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.URL.Query().Get("id"))
	if id == "" {
		writeSummaryHTML(w, http.StatusNotFound, summaryView{Name: "Sesi tidak ditemukan", Message: "Tautan ringkasan ini tidak valid."})
		return
	}
	ctx := r.Context()
	session, err := SessionServ.SessionRepo.GetByID(ctx, id)
	if err != nil || session == nil {
		writeSummaryHTML(w, http.StatusNotFound, summaryView{Name: "Sesi tidak ditemukan", Message: "Sesi ini tidak ada atau sudah dihapus."})
		return
	}

	view := summaryView{Name: session.Name}
	if view.Name == "" {
		view.Name = "Retrospektif"
	}
	if !session.CreatedAt.IsZero() {
		t := session.CreatedAt
		view.Date = strings.TrimSpace(strings.Join([]string{itoa(t.Day()), indonesianMonths[t.Month()-1], itoa(t.Year())}, " "))
	}

	// Cards are hidden while people are still writing.
	if session.EffectivePhase() == models.PhaseWrite {
		view.Message = "Ringkasan belum tersedia. Sesi ini masih di tahap menulis."
		writeSummaryHTML(w, http.StatusConflict, view)
		return
	}

	questions, err := SessionServ.QuestionRepo.GetBySession(ctx, id)
	if err != nil {
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}
	answers, err := AnswerRepo.GetBySession(ctx, id)
	if err != nil {
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	byQ := map[string][]models.Answer{}
	for _, a := range answers {
		byQ[a.QuestionID] = append(byQ[a.QuestionID], a)
	}
	for _, q := range questions {
		list := byQ[q.ID]
		sort.SliceStable(list, func(i, j int) bool {
			if list[i].Votes != list[j].Votes {
				return list[i].Votes > list[j].Votes
			}
			return list[i].CreatedAt.Before(list[j].CreatedAt)
		})
		topic := summaryTopic{Title: q.Text}
		for _, a := range list {
			topic.Cards = append(topic.Cards, summaryCard{Text: html.UnescapeString(stripHTML(a.Text)), Votes: a.Votes, ClusterTag: strings.TrimSpace(a.ClusterTag)})
		}
		view.Topics = append(view.Topics, topic)
	}
	view.Clusters = computeClusters(answers, session.EffectivePhase())

	if ActionItemRepo != nil {
		items, err := ActionItemRepo.GetBySession(ctx, id)
		if err == nil {
			view.Actions = items
		}
	}

	writeSummaryHTML(w, http.StatusOK, view)
}

func itoa(n int) string { return strconv.Itoa(n) }
