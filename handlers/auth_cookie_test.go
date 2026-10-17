package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestAuthCookieFlags(t *testing.T) {
	cases := []struct {
		name   string
		proto  string
		secure bool
	}{
		{"http", "", false},
		{"forwarded https", "https", true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			if c.proto != "" {
				req.Header.Set("X-Forwarded-Proto", c.proto)
			}
			for _, kind := range []string{"set", "logout"} {
				w := httptest.NewRecorder()
				if kind == "set" {
					setAuthCookie(w, req, "abc", time.Now().Add(time.Hour))
				} else {
					LogoutHandler(w, req)
				}
				cs := w.Result().Cookies()
				if len(cs) != 1 || cs[0].Name != "token" {
					t.Fatalf("%s: expected one token cookie, got %v", kind, cs)
				}
				ck := cs[0]
				if !ck.HttpOnly || ck.SameSite != http.SameSiteLaxMode || ck.Secure != c.secure {
					t.Errorf("%s: bad flags: HttpOnly=%v SameSite=%v Secure=%v", kind, ck.HttpOnly, ck.SameSite, ck.Secure)
				}
			}
		})
	}
}
