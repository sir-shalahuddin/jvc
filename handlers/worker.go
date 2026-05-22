package handlers

import (
	"context"
	"log"
	"retro-gcp/services"
	"time"
)

type SentimentTask struct {
	AnswerID   string
	SessionID  string
	Text       string
	RetryCount int
}

var sentimentQueue = make(chan SentimentTask, 5000)

func InitSentimentProcessor(workerCount int) {
	go sentimentBatchWorker()
}

func sentimentBatchWorker() {
	var batch []SentimentTask
	const batchDuration = 15 * time.Second
	ticker := time.NewTicker(batchDuration)

	for {
		select {
		case task := <-sentimentQueue:
			batch = append(batch, task)
		case <-ticker.C:
			if len(batch) > 0 {
				processBatchWithRetry(batch)
				batch = nil
			}
		}
	}
}

func processBatchWithRetry(batch []SentimentTask) {
	const chunkSize = 10
	ctx := context.Background()

	for i := 0; i < len(batch); i += chunkSize {
		end := i + chunkSize
		if end > len(batch) {
			end = len(batch)
		}
		chunk := batch[i:end]

		var texts []string
		for _, t := range chunk {
			texts = append(texts, t.Text)
		}

		results, err := services.AnalyzeSentimentBatch(texts)
		if err != nil {
			log.Printf("[WORKER] AI Error for chunk: %v", err)
			// Set fallback sentiment for this chunk so it doesn't spin forever
			for _, task := range chunk {
				AnswerRepo.UpdateSentiment(ctx, task.SessionID, task.AnswerID, "Unavailable", "#9CA3AF", "⚠️")
			}
			continue
		}

		for j, res := range results {
			if j >= len(chunk) {
				break
			}
			task := chunk[j]
			AnswerRepo.UpdateSentiment(ctx, task.SessionID, task.AnswerID, res.Emotion, res.Color, res.Emoji)
		}

		// Fallback for length mismatches
		if len(results) < len(chunk) {
			for j := len(results); j < len(chunk); j++ {
				task := chunk[j]
				AnswerRepo.UpdateSentiment(ctx, task.SessionID, task.AnswerID, "Unavailable", "#9CA3AF", "⚠️")
			}
		}

		// Small delay to respect rate limits if multiple chunks exist
		if end < len(batch) {
			time.Sleep(500 * time.Millisecond)
		}
	}
}

func QueueSentimentAnalysis(id string, sessionID string, text string) {
	select {
	case sentimentQueue <- SentimentTask{AnswerID: id, SessionID: sessionID, Text: text}:
	default:
		log.Printf("[WORKER] Queue FULL - setting fallback sentiment")
		// Asynchronously update status directly to Unavailable so the UI doesn't spin forever
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			AnswerRepo.UpdateSentiment(ctx, sessionID, id, "Unavailable", "#9CA3AF", "⚠️")
		}()
	}
}
