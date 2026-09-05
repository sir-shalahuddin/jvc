# Frontend Builder
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Go Builder
FROM golang:1.25-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o retro-gcp .

# Final Release Image
FROM alpine:3.19
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /app/retro-gcp .
COPY --from=frontend-builder /app/frontend/dist/ ./frontend/dist/
COPY templates/ ./templates/
COPY static/ ./static/
EXPOSE 8080
CMD ["./retro-gcp"]

