package handlers

import (
	"testing"
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
