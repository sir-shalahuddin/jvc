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
var batchQueue = make(chan []SentimentTask, 500)

func InitSentimentProcessor(workerCount int) {
	if workerCount <= 0 {
		workerCount = 1
	}
	go sentimentDispatcher()
	for i := 0; i < workerCount; i++ {
		go sentimentWorker(i)
	}
}

func sentimentDispatcher() {
	const maxBatchSize = 10
	var batch []SentimentTask
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case task, ok := <-sentimentQueue:
			if !ok {
				if len(batch) > 0 {
					batchQueue <- batch
				}
				close(batchQueue)
				return
			}
			batch = append(batch, task)
			if len(batch) >= maxBatchSize {
				batchQueue <- batch
				batch = nil
			}
		case <-ticker.C:
			if len(batch) > 0 {
				batchQueue <- batch
				batch = nil
			}
		}
	}
}

func sentimentWorker(workerID int) {
	for batch := range batchQueue {
		processBatch(workerID, batch)
	}
}

func processBatch(workerID int, batch []SentimentTask) {
	ctx := context.Background()
	var texts []string
	for _, t := range batch {
		texts = append(texts, t.Text)
	}

	results, err := services.AnalyzeSentimentBatch(texts)
	if err != nil {
		log.Printf("[WORKER-%d] AI Error for batch: %v", workerID, err)
		// Set fallback sentiment for this batch so it doesn't spin forever
		for _, task := range batch {
			AnswerRepo.UpdateSentiment(ctx, task.SessionID, task.AnswerID, "Unavailable", "#9CA3AF", "⚠️")
		}
		return
	}

	for j, res := range results {
		if j >= len(batch) {
			break
		}
		task := batch[j]
		AnswerRepo.UpdateSentiment(ctx, task.SessionID, task.AnswerID, res.Emotion, res.Color, res.Emoji)
	}

	// Fallback for length mismatches
	if len(results) < len(batch) {
		for j := len(results); j < len(batch); j++ {
			task := batch[j]
			AnswerRepo.UpdateSentiment(ctx, task.SessionID, task.AnswerID, "Unavailable", "#9CA3AF", "⚠️")
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

