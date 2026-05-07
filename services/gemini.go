package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"retro-gcp/config"
	"strings"

	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/option"
)

var availableModels = []string{
	"gemini-3.1-flash-lite",
	"gemini-2.5-flash-lite",
	"gemini-3-flash",
	"gemini-2.5-flash",
}

var currentModelIdx = 0

func SwitchToNextModel() string {
	currentModelIdx = (currentModelIdx + 1) % len(availableModels)
	newName := availableModels[currentModelIdx]
	log.Printf("[WARN] AI QUOTA/ERROR EXCEEDED! Switching to next model: %s", newName)
	return newName
}

type SentimentResult struct {
	Emotion string `json:"emotion"`
	Color   string `json:"color"`
	Emoji   string `json:"emoji"`
}

func performGenAI(prompt string, maxTokens int32, tempe float32, systemPrompt string) (string, error) {
	ctx := context.Background()
	for attempt := 0; attempt < len(availableModels); attempt++ {
		primaryModel := availableModels[currentModelIdx]
		
		client, err := genai.NewClient(ctx, option.WithAPIKey(config.AppConfig.GeminiAPIKey))
		if err != nil {
			return "", err
		}
		
		model := client.GenerativeModel(primaryModel)
		model.SetTemperature(tempe)
		model.MaxOutputTokens = &maxTokens
		if systemPrompt != "" {
			model.SystemInstruction = &genai.Content{
				Parts: []genai.Part{genai.Text(systemPrompt)},
			}
		}

		resp, err := model.GenerateContent(ctx, genai.Text(prompt))
		client.Close()
		
		if err == nil && resp != nil && len(resp.Candidates) > 0 && len(resp.Candidates[0].Content.Parts) > 0 {
			if txt, ok := resp.Candidates[0].Content.Parts[0].(genai.Text); ok {
				return string(txt), nil
			}
		}

		log.Printf("[ERROR] GenAI Model %s failed: %v", primaryModel, err)
		SwitchToNextModel()
	}
	return "", fmt.Errorf("all LLM models failed")
}

func AnalyzeSentimentBatch(texts []string) ([]SentimentResult, error) {
	if len(texts) == 0 {
		return nil, nil
	}

	var batchInput strings.Builder
	for i, t := range texts {
		batchInput.WriteString(fmt.Sprintf("[%d]: %s\n", i, t))
	}

	prompt := fmt.Sprintf(`Analyze the following list of retrospective feedback and return a JSON array containing the sentiment for each item. 
Return exactly %d results in the same order.

Feedback List:
%s
`, len(texts), batchInput.String())

	systemPrompt := `You are a batch sentiment analyzer. 
Return ONLY a raw JSON array of objects.
For each item, provide:
1. "emotion": string
2. "emoji": string
3. "color": string (hex code)`

	rawResponse, err := performGenAI(prompt, 5000, 0.1, systemPrompt)
	if err != nil {
		return nil, err
	}

	start := strings.Index(rawResponse, "[")
	end := strings.LastIndex(rawResponse, "]")
	if start == -1 || end == -1 {
		return nil, fmt.Errorf("invalid format from AI")
	}
	
	rawResponse = rawResponse[start : end+1]
	
	var results []SentimentResult
	if err := json.Unmarshal([]byte(rawResponse), &results); err != nil {
		return nil, err
	}
	
	return results, nil
}

func SummarizeRetrospective(feedback []string) (string, error) {
	if len(feedback) == 0 {
		return "No feedback", nil
	}

	prompt := fmt.Sprintf(`Summarize these retro items concisely (max 4 sentences):
%s`, strings.Join(feedback, "\n"))

	rawResponse, err := performGenAI(prompt, 400, 0.2, "")
	if err != nil {
		return "Summary failed", err
	}

	return strings.TrimSpace(rawResponse), nil
}
