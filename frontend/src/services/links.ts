// Copy and share helpers shared by the dashboard and admin pages.
import { fetchShareLink } from './sessionApi';

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API unavailable (insecure context, denied permission): legacy fallback.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Participant invite link (shortened by the server when possible, else the plain board URL). */
export async function resolveInviteUrl(sessionId: string): Promise<string> {
  try {
    return await fetchShareLink(sessionId);
  } catch {
    return `${window.location.origin}/session/?id=${encodeURIComponent(sessionId)}`;
  }
}

/** Copies the participant invite link. */
export async function copyInviteLink(sessionId: string): Promise<boolean> {
  return copyText(await resolveInviteUrl(sessionId));
}

export function boardUrl(sessionId: string): string {
  return `/session/?id=${encodeURIComponent(sessionId)}&role=sm`;
}

/** Top-ups are handled by hand over WhatsApp. */
export function topUpUrl(email?: string): string {
  const msg = `Halo, saya ingin menambah kuota sesi Retro untuk akun ${email || '-'}. Terima kasih.`;
  return `https://wa.me/6285640390800?text=${encodeURIComponent(msg)}`;
}

/** Login URL that returns to the page the user was on (dashboard by default). */
export function loginUrl(): string {
  const path = window.location.pathname;
  const next = path.startsWith('/admin') ? '/admin' : '/dashboard';
  return `/auth/google/login?next=${encodeURIComponent(next)}`;
}

export function formatDate(iso: string, withTime = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}
