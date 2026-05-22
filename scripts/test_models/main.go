package main

import (
	"context"
	"flag"
	"fmt"
	"os"

	"github.com/google/generative-ai-go/genai"
	"github.com/joho/godotenv"
	"google.golang.org/api/option"
)

func main() {
	// Try loading .env first
	_ = godotenv.Load()

	apiKeyFlag := flag.String("key", "", "Your Gemini API Key (falls back to GEMINI_API_KEY env var)")
	flag.Parse()

	apiKey := *apiKeyFlag
	if apiKey == "" {
		apiKey = os.Getenv("GEMINI_API_KEY")
	}

	if apiKey == "" {
		fmt.Println("Error: Gemini API Key is required.")
		fmt.Println("Usage: go run scripts/test_models/main.go -key=YOUR_API_KEY")
		fmt.Println("Or set the GEMINI_API_KEY environment variable in your shell or .env file.")
		os.Exit(1)
	}

	modelsToTest := []string{
		"gemini-3.1-flash-lite",
		"gemini-2.5-flash-lite",
		"gemini-3-flash",
		"gemini-2.5-flash",
		"gemma-4-31b-it",
		"gemma-4-26b-a4b-it",
	}

	ctx := context.Background()

	fmt.Println("=========================================================================")
	fmt.Println("                  GEMINI & GEMMA MODEL CONNECTIVITY TEST                 ")
	fmt.Println("=========================================================================")
	fmt.Printf("API Key: %s...%s\n\n", apiKey[:4], apiKey[len(apiKey)-4:])

	for _, modelName := range modelsToTest {
		fmt.Printf("Testing model [%s]... ", modelName)

		client, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
		if err != nil {
			fmt.Printf("❌ Failed to create client: %v\n", err)
			continue
		}

		model := client.GenerativeModel(modelName)
		model.SetTemperature(0.1)

		resp, err := model.GenerateContent(ctx, genai.Text("Say 'Hello World' if you can read this."))
		client.Close()

		if err != nil {
			fmt.Printf("❌ FAILED: %v\n", err)
			continue
		}

		if resp == nil || len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
			fmt.Println("❌ FAILED: Received empty response from model.")
			continue
		}

		txt, ok := resp.Candidates[0].Content.Parts[0].(genai.Text)
		if !ok {
			fmt.Println("❌ FAILED: Non-text response candidate.")
			continue
		}

		fmt.Printf("✅ SUCCESS! Response: %q\n", string(txt))
	}
	fmt.Println("=========================================================================")
}
