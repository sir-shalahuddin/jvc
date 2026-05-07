# Multi-stage build
FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o retro-gcp .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /app/retro-gcp .
COPY templates/ ./templates/
COPY static/ ./static/
EXPOSE 8080
CMD ["./retro-gcp"]
