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

var sentimentQueue = make(chan SentimentTask, 1000)

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
	var texts []string
	for _, t := range batch {
		texts = append(texts, t.Text)
	}

	results, err := services.AnalyzeSentimentBatch(texts)
	if err != nil {
		log.Printf("[WORKER] AI Error: %v", err)
		return
	}

	ctx := context.Background()
	for i, res := range results {
		if i >= len(batch) {
			break
		}
		task := batch[i]
		AnswerRepo.UpdateSentiment(ctx, task.SessionID, task.AnswerID, res.Emotion, res.Color, res.Emoji)
	}
}

func QueueSentimentAnalysis(id string, sessionID string, text string) {
	select {
	case sentimentQueue <- SentimentTask{AnswerID: id, SessionID: sessionID, Text: text}:
	default:
		log.Printf("[WORKER] Queue FULL")
	}
}
