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

	// Paint soft cream background on every page
	pdf.SetHeaderFunc(func() {
		pdf.SetFillColor(253, 250, 246) // #fdfaf6
		pdf.Rect(0, 0, 210, 297, "F")
	})

	pdf.AddPage()

	// Title
	pdf.SetFont("Arial", "B", 24)
	pdf.SetTextColor(26, 26, 26) // dark charcoal
	pdf.Cell(0, 15, title)
	pdf.Ln(12)

	// Meta info
	pdf.SetFont("Arial", "B", 9)
	pdf.SetTextColor(125, 117, 109) // #7d756d
	pdf.Cell(0, 8, fmt.Sprintf("RETRO SESSION ID: %s | GENERATED: %s", strings.ToUpper(sessionID), strings.ToUpper(time.Now().Format("Jan 02, 2006, 15:04 MST"))))
	pdf.Ln(10)

	// Draw a thick horizontal line under header
	pdf.SetDrawColor(26, 26, 26)
	pdf.SetLineWidth(1.5)
	pdf.Line(15, pdf.GetY(), 195, pdf.GetY())
	pdf.Ln(10)

	// AI Summary Card
	wBox := 180.0
	y := pdf.GetY()
	lines := pdf.SplitLines([]byte(aiSummary), wBox-10)
	boxH := float64(len(lines))*6.0 + 15.0 // Title + lines spacing + padding

	if y+boxH > 270 {
		pdf.AddPage()
		y = pdf.GetY()
	}

	// 1. Shadow (solid orange #ff5f1f, offset by 2.0mm)
	pdf.SetFillColor(255, 95, 31)
	pdf.Rect(15+2.0, y+2.0, wBox, boxH, "F")

	// 2. White box with thick black border
	pdf.SetFillColor(255, 255, 255)
	pdf.SetDrawColor(26, 26, 26)
	pdf.SetLineWidth(1.0)
	pdf.Rect(15, y, wBox, boxH, "FD")

	// 3. Title inside box
	pdf.SetFont("Arial", "B", 10)
	pdf.SetTextColor(255, 95, 31) // orange
	pdf.SetXY(20, y+5)
	pdf.Cell(0, 5, "EXECUTIVE AI SUMMARY")

	// 4. Content inside box
	pdf.SetFont("Arial", "", 10)
	pdf.SetTextColor(26, 26, 26)
	pdf.SetXY(20, y+11)
	pdf.MultiCell(wBox-10, 6, aiSummary, "", "L", false)

	// Move cursor below summary
	pdf.SetY(y + boxH + 12)

	for i, q := range questions {
		y := pdf.GetY()
		qText := fmt.Sprintf("%d. %s", i+1, q.Text)

		// Split question text to find exact box height
		qLines := pdf.SplitLines([]byte(qText), wBox-10)
		qBoxH := float64(len(qLines))*6.0 + 8.0

		if y+qBoxH > 265 {
			pdf.AddPage()
			y = pdf.GetY()
		}

		// 1. Shadow (black, 1.5mm offset)
		pdf.SetFillColor(26, 26, 26)
		pdf.Rect(15+1.5, y+1.5, wBox, qBoxH, "F")

		// 2. Box (white background, black border)
		pdf.SetFillColor(255, 255, 255)
		pdf.SetDrawColor(26, 26, 26)
		pdf.Rect(15, y, wBox, qBoxH, "FD")

		// 3. Text
		pdf.SetFont("Arial", "B", 12)
		pdf.SetTextColor(26, 26, 26)
		pdf.SetXY(20, y+4)
		pdf.MultiCell(wBox-10, 6, qText, "", "L", false)

		pdf.SetY(y + qBoxH + 6)

		ansList := answersByQ[q.ID]
		if len(ansList) == 0 {
			pdf.SetFont("Arial", "I", 10)
			pdf.SetTextColor(125, 117, 109)
			pdf.SetX(20)
			pdf.Cell(0, 10, "(No reflections submitted yet)")
			pdf.Ln(10)
		} else {
			for _, ans := range ansList {
				ansTextClean := stripHTML(ans.Text)
				displayName := ans.AuthorName
				if displayName == "" {
					displayName = "Anonymous"
				}
				emotionText := strings.ToUpper(ans.SentimentEmotion)

				// Calculate text lines and required height
				aLines := pdf.SplitLines([]byte(ansTextClean), wBox-20)
				ansBoxH := float64(len(aLines))*5.5 + 16.0 // Padding + metadata header height

				currY := pdf.GetY()
				if currY+ansBoxH > 275 {
					pdf.AddPage()
					currY = pdf.GetY()
				}

				// 1. Shadow (black, offset by 1.5mm)
				pdf.SetFillColor(26, 26, 26)
				pdf.Rect(15+1.5, currY+1.5, wBox, ansBoxH, "F")

				// 2. Main Box (white fill, black border)
				pdf.SetFillColor(255, 255, 255)
				pdf.SetDrawColor(26, 26, 26)
				pdf.Rect(15, currY, wBox, ansBoxH, "FD")

				// 3. Thick Left Border in Sentiment Color
				r, g, b := hexToRGB(ans.SentimentColor)
				pdf.SetFillColor(r, g, b)
				pdf.Rect(15, currY, 4.0, ansBoxH, "F")

				// 4. Meta Information
				pdf.SetFont("Arial", "B", 9)
				pdf.SetTextColor(26, 26, 26)
				pdf.SetXY(22, currY+4)
				pdf.Cell(0, 5, fmt.Sprintf("%s  |  %s", strings.ToUpper(displayName), emotionText))

				// 5. Answer Content
				pdf.SetFont("Arial", "", 10)
				pdf.SetTextColor(51, 51, 51)
				pdf.SetXY(22, currY+10)
				pdf.MultiCell(wBox-12, 5.5, ansTextClean, "", "L", false)

				pdf.SetY(currY + ansBoxH + 6)
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
