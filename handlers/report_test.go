package handlers

import (
	"testing"
	"time"
)

func TestHexToRGB(t *testing.T) {
	tests := []struct {
		hex     string
		wantR   int
		wantG   int
		wantB   int
	}{
		{"#ffffff", 255, 255, 255},
		{"#000000", 0, 0, 0},
		{"#ff0000", 255, 0, 0},
		{"invalid", 156, 163, 175}, // Fallback color
	}

	for _, tt := range tests {
		r, g, b := hexToRGB(tt.hex)
		if r != tt.wantR || g != tt.wantG || b != tt.wantB {
			t.Errorf("hexToRGB(%s) = (%d,%d,%d), want (%d,%d,%d)", tt.hex, r, g, b, tt.wantR, tt.wantG, tt.wantB)
		}
	}
}

func TestStripHTML(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"<p>Hello</p>", "Hello"},
		{"<b>World</b>", "World"},
		{"Mixed <i>Content</i>", "Mixed Content"},
		{"No HTML", "No HTML"},
	}

	for _, tt := range tests {
		got := stripHTML(tt.input)
		if got != tt.want {
			t.Errorf("stripHTML(%s) = %s, want %s", tt.input, got, tt.want)
		}
	}
}

func TestSummaryCache(t *testing.T) {
	sessionID := "test-session-123"
	summaryText := "This is a wonderful retrospective summary."

	// 1. Initial state: cache should be empty
	InvalidateSummaryCache(sessionID)
	if got, ok := getCachedSummary(sessionID); ok || got != "" {
		t.Errorf("expected empty cache, got: %q, ok: %v", got, ok)
	}

	// 2. Set cache and retrieve
	setCachedSummary(sessionID, summaryText)
	got, ok := getCachedSummary(sessionID)
	if !ok {
		t.Errorf("expected to find cached summary")
	}
	if got != summaryText {
		t.Errorf("got cached summary %q, want %q", got, summaryText)
	}

	// 3. Invalidate cache
	InvalidateSummaryCache(sessionID)
	if got, ok = getCachedSummary(sessionID); ok || got != "" {
		t.Errorf("expected empty cache after invalidation, got: %q, ok: %v", got, ok)
	}

	// 4. Test TTL expiration
	setCachedSummary(sessionID, summaryText)
	// Access the map directly to manipulate time.Time
	summaryCacheMu.Lock()
	if entry, ok := summaryCache[sessionID]; ok {
		entry.updatedAt = time.Now().Add(-11 * time.Minute)
	} else {
		t.Errorf("expected entry to exist in map")
	}
	summaryCacheMu.Unlock()

	// Should not retrieve it because it's older than 10 minutes
	if got, ok = getCachedSummary(sessionID); ok || got != "" {
		t.Errorf("expected cached summary to be expired, but retrieved %q (ok: %v)", got, ok)
	}
}

