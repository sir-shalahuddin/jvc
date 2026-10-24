import DOMPurify from 'dompurify';

// Second layer behind the server policy (handlers/answer.go). Same allowlist.
// Old cards may predate server sanitization, so every render goes through here.
const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 's', 'del', 'strike', 'ul', 'ol', 'li', 'code', 'a'];

const purify = DOMPurify(window);
purify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer nofollow');
  }
});

export function sanitizeCardHtml(html: string): string {
  return purify.sanitize(html || '', {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOWED_URI_REGEXP: /^https?:/i,
  });
}

/** Parses a user-typed link. Returns an absolute http(s) URL, or null. */
export function normalizeHttpUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

/** Plain text of a card (for banners and prefilled fields). Sanitizes first: never trusts stored HTML. */
export function cardPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(sanitizeCardHtml(html), 'text/html');
  return (doc.body.textContent || '').trim();
}
