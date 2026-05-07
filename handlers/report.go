package handlers

import (
	"fmt"
	"net/http"
	"retro-gcp/models"
	"retro-gcp/services"
	"regexp"
	"strings"
	"time"

	"github.com/go-pdf/fpdf"
)

func GenerateReportHandler(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("session_id")
	if sessionID == "" {
		http.Error(w, "session_id required", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	
	session, err := SessionServ.SessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		http.Error(w, "Session not found", http.StatusNotFound)
		return
	}
	title := session.Name
	if title == "" {
		title = "Sprint Retrospective"
	}

	questions, _ := SessionServ.QuestionRepo.GetBySession(ctx, sessionID)
	answers, _ := AnswerRepo.GetBySession(ctx, sessionID)

	var allFeedback []string
	answersByQ := map[string][]models.Answer{}
	for _, a := range answers {
		answersByQ[a.QuestionID] = append(answersByQ[a.QuestionID], a)
		if a.Text != "" && !strings.Contains(a.SentimentEmotion, "Anal") {
			allFeedback = append(allFeedback, a.Text)
		}
	}

	aiSummary := "No feedback available for summary."
	if len(allFeedback) > 0 {
		aiSummary, _ = services.SummarizeRetrospective(allFeedback)
	}

	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 20, 15)
	pdf.SetAutoPageBreak(true, 20)
	pdf.AddPage()

	// 1. Header
	pdf.SetFont("Arial", "B", 24)
	pdf.SetTextColor(30, 41, 59)
	pdf.Cell(0, 20, title)
	pdf.Ln(12)

	// ... (Rest of PDF logic stays same, just using the fetched slices)
	// (Shortened for brevity in this tool call, but I should keep the full logic)
	
	// PDF logic continues...
	// (I'll re-implement the full logic to ensure it works)
	
	pdf.SetFont("Arial", "I", 9)
	pdf.SetTextColor(100, 116, 139)
	pdf.Cell(0, 10, fmt.Sprintf("Report ID: %s | Generated on: %s", sessionID[:8], time.Now().Format("Jan 02, 2006 at 15:04")))
	pdf.Ln(12)

	pdf.SetDrawColor(226, 232, 240)
	pdf.Line(15, pdf.GetY(), 195, pdf.GetY())
	pdf.Ln(10)

	// AI Summary
	pdf.SetFillColor(248, 250, 252)
	pdf.SetDrawColor(203, 213, 225)
	pdf.SetFont("Arial", "B", 13)
	pdf.SetTextColor(15, 23, 42)
	pdf.CellFormat(0, 10, "Executive AI Summary", "LT R", 1, "L", true, 0, "")
	pdf.SetFont("Arial", "", 11)
	pdf.SetTextColor(51, 65, 85)
	pdf.MultiCell(0, 7, aiSummary, "LBR", "L", true)
	pdf.Ln(15)

	for i, q := range questions {
		pdf.SetFillColor(241, 245, 249)
		pdf.SetTextColor(30, 41, 59)
		pdf.SetFont("Arial", "B", 12)
		pdf.MultiCell(0, 10, fmt.Sprintf("%d. %s", i+1, q.Text), "B", "L", true)
		pdf.Ln(2)

		ansList := answersByQ[q.ID]
		if len(ansList) == 0 {
			pdf.SetFont("Arial", "I", 10)
			pdf.SetTextColor(148, 163, 184)
			pdf.Cell(0, 10, "      (No reflections submitted yet)")
			pdf.Ln(8)
		} else {
			for _, ans := range ansList {
				if pdf.GetY() > 270 { pdf.AddPage() }
				pdf.Ln(2)
				r, g, b := hexToRGB(ans.SentimentColor)
				pdf.SetFillColor(r, g, b)
				pdf.Rect(pdf.GetX() + 2, pdf.GetY() + 1.2, 2.5, 7, "F")
				pdf.SetX(pdf.GetX() + 8)
				pdf.SetFont("Arial", "B", 10)
				displayName := ans.AuthorName
				if displayName == "" { displayName = "Anonymous" }
				pdf.Cell(0, 6, fmt.Sprintf("%s [%s]:", displayName, ans.SentimentEmotion))
				pdf.Ln(6)
				pdf.SetX(pdf.GetX() + 8)
				pdf.SetFont("Arial", "", 10)
				pdf.MultiCell(0, 6, stripHTML(ans.Text), "", "L", false)
				pdf.Ln(4)
			}
		}
		pdf.Ln(6)
	}

	pdf.AliasNbPages("")
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"Retro_Report_%s.pdf\"", time.Now().Format("20060102")))
	pdf.Output(w)
}

func hexToRGB(h string) (int, int, int) {
	if len(h) < 7 || h[0] != '#' { return 156, 163, 175 }
	var r, g, b int
	fmt.Sscanf(h[1:7], "%02x%02x%02x", &r, &g, &b)
	return r, g, b
}

func stripHTML(s string) string {
	re := regexp.MustCompile("<[^>]*>")
	return strings.TrimSpace(re.ReplaceAllString(s, ""))
}
