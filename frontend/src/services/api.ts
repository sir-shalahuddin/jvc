// API client and types for the dashboard and admin pages.

export interface User {
  authenticated: boolean;
  email?: string;
  quota?: number;
  is_admin?: boolean;
}

export interface Session {
  id: string;
  name: string;
  owner_email?: string;
  creator_email?: string;
  created_at: string;
  status?: string;
  phase?: string;
  is_owner?: boolean;
}

export interface HistoryResponse {
  quota: number;
  sessions: Session[];
}

export interface AdminHealth {
  status: 'ok' | 'degraded';
  firestore_ok: boolean;
  firestore_ms: number;
  uptime_seconds: number;
  started_at_unix_ms: number;
}

export interface AdminStats {
  total_sessions: number;
  total_users: number;
  total_revenue: number;
  health?: AdminHealth;
}

export interface AdminSessionsPage {
  sessions: Session[];
  total: number;
  page: number;
  page_size: number;
}

export async function fetchCurrentUser(): Promise<User> {
  const res = await fetch('/api/me');
  if (!res.ok) {
    return { authenticated: false };
  }
  return res.json();
}

export async function fetchHistory(): Promise<HistoryResponse> {
  const res = await fetch('/api/history');
  if (!res.ok) {
    throw new Error('Gagal memuat riwayat sesi');
  }
  return res.json();
}

export async function createSession(name: string): Promise<{ id: string }> {
  const res = await fetch('/api/session/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Gagal membuat sesi');
  }
  return res.json();
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const res = await fetch('/api/admin/stats');
  if (!res.ok) {
    throw new Error('Gagal memuat statistik');
  }
  return res.json();
}

export async function fetchAdminSessions(
  params: { page?: number; pageSize?: number; q?: string } = {},
  signal?: AbortSignal
): Promise<AdminSessionsPage> {
  const qs = new URLSearchParams();
  qs.set('page', String(params.page ?? 1));
  qs.set('page_size', String(Math.min(params.pageSize ?? 20, 50)));
  if (params.q && params.q.trim()) qs.set('q', params.q.trim());
  const res = await fetch(`/api/admin/sessions?${qs.toString()}`, { signal });
  if (!res.ok) {
    throw new Error('Gagal memuat daftar sesi');
  }
  const data = await res.json();
  return {
    sessions: Array.isArray(data?.sessions) ? data.sessions : [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    page_size: data?.page_size ?? 20,
  };
}

export async function deleteAdminSession(sessionId: string): Promise<void> {
  const res = await fetch(`/api/admin/sessions?id=${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error('Gagal menghapus sesi');
  }
}
