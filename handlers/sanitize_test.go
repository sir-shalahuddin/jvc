package handlers

import (
	"strings"
	"testing"
)

func TestSanitizeCardHTMLStripsDangerous(t *testing.T) {
	cases := map[string]string{
		`<script>alert(1)</script>hi`:            "script",
		`<p onclick="x()">a</p>`:                 "onclick",
		`<img src=x onerror=alert(1)>t`:          "<img",
		`<h1>Title</h1>`:                         "<h1",
		`<p style="color:red">a</p>`:             "style",
		`<style>p{}</style>a`:                    "<style",
		`<a href="javascript:alert(1)">x</a>`:    "javascript",
		`<a href="JaVaScRiPt:alert(1)">x</a>`:    "script:",
		`<a href="data:text/html,<b>">x</a>`:     "data:",
		`<iframe src="https://e.com"></iframe>`:  "iframe",
		`<blockquote>q</blockquote><pre>c</pre>`: "<blockquote",
		`<a href="/relative">x</a>`:              `href="/relative"`,
		`<a href="mailto:a@b.c">x</a>`:           "mailto",
	}
	for in, bad := range cases {
		out := SanitizeCardHTML(in)
		if strings.Contains(strings.ToLower(out), strings.ToLower(bad)) {
			t.Errorf("input %q -> %q still contains %q", in, out, bad)
		}
	}
}

func TestSanitizeCardHTMLKeepsAllowed(t *testing.T) {
	in := `<p>a <strong>b</strong> <b>b</b> <em>i</em> <i>i</i> <s>s</s> <del>d</del> <strike>k</strike> <code>c</code><br></p><ul><li>x</li></ul><ol><li>y</li></ol>`
	out := SanitizeCardHTML(in)
	for _, tag := range []string{"<p>", "<strong>", "<b>", "<em>", "<i>", "<s>", "<del>", "<strike>", "<code>", "<br", "<ul>", "<ol>", "<li>"} {
		if !strings.Contains(out, tag) {
			t.Errorf("expected %s kept in %q", tag, out)
		}
	}
}

func TestSanitizeCardHTMLLinks(t *testing.T) {
	out := SanitizeCardHTML(`<a href="https://example.com/a?b=1" target="_self" rel="author" onclick="x()">go</a>`)
	for _, want := range []string{`href="https://example.com/a?b=1"`, `target="_blank"`, "nofollow", "noopener", "noreferrer"} {
		if !strings.Contains(out, want) {
			t.Errorf("expected %q in %q", want, out)
		}
	}
	if strings.Contains(out, "onclick") || strings.Contains(out, "_self") || strings.Contains(out, "author") {
		t.Errorf("unexpected attrs kept: %q", out)
	}
	if !strings.Contains(SanitizeCardHTML(`<a href="http://example.com">x</a>`), `href="http://example.com"`) {
		t.Error("http link dropped")
	}
	if got := SanitizeCardHTML(`<a href="javascript:alert(1)">x</a>`); strings.Contains(got, "<a") || !strings.Contains(got, "x") {
		t.Errorf("javascript href: %q", got)
	}
}
