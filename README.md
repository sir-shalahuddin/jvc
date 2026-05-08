# Retro - AI-Powered Sprint Retrospective Tool

Retro is a premium, high-performance retrospective application built for modern engineering teams. It leverages the power of **Google Gemini API** to provide real-time sentiment analysis and safety monitoring, ensuring productive and safe team discussions.

Built for the **GCP Always Free Tier**, it demonstrates a highly scalable, serverless architecture using **Go** and **Google Cloud Run**.

## 🚀 Key Features

- **Real-Time Anonymous Feedback**: Facilitate honest and open discussions with secure, anonymous sessions.
- **AI-Powered Sentiment Analysis**: Automatically categorize feedback by emotion and visualize it with dynamic color cues and emojis.
- **Safety & Guardrails**: Automatic red-pulse highlighting for toxic or inappropriate content to help facilitators maintain a healthy environment.
- **Smart RPM Handling**: Built-in request batching and multi-model failover to handle Gemini API rate limits effectively.
- **Automated Reporting**: Generate professional PDF reports of your retrospective sessions with a single click.
- **Monetization Ready**: Integrated with Trakteer webhooks for quota-based session management.

## 🛠️ Tech Stack

- **Backend**: Golang (Clean Architecture)
- **Database**: Google Firestore (NoSQL)
- **Infrastructure**: Google Cloud Run (Serverless), Cloud Storage
- **AI Engine**: Google Gemini API
- **Frontend**: Vanilla JS, CSS (Responsive & Premium Design)
- **CI/CD**: GitHub Actions

## ⚙️ Environment Variables

To run this project, you need to set the following environment variables:

```bash
GCP_PROJECT_ID=your-project-id
GCS_BUCKET_NAME=your-bucket-name
GEMINI_API_KEY=your-gemini-key
GOOGLE_CLIENT_ID=your-oauth-id
GOOGLE_CLIENT_SECRET=your-oauth-secret
JWT_SECRET=your-random-secret
ADMIN_EMAIL=admin@example.com
TRAKTEER_WEBHOOK_SECRET=your-webhook-token
```

## 🏗️ Getting Started

### Local Development
1. Clone the repository: `git clone https://github.com/sir-shalahuddin/jvc`
2. Install dependencies: `go mod download`
3. Run the application: `go run main.go`

### Deployment
This project is configured for automated deployment via GitHub Actions. Simply push your changes to the `main` branch, and the CI/CD pipeline will:
1. Run unit tests.
2. Build the Docker container.
3. Deploy to Google Cloud Run.

---

## 🤖 Built by Antigravity
This entire project was autonomously developed and optimized by **Antigravity**, an advanced Agentic AI Coding Assistant. From the DDD-inspired backend structure to the premium glassmorphism UI, Antigravity handled the end-to-end development process.

