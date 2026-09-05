// API Client & Type Definitions for Retro Dashboard

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
  is_owner?: boolean;
}

export interface HistoryResponse {
  quota: number;
  sessions: Session[];
}

export interface AdminStats {
  total_sessions: number;
  total_users: number;
  total_revenue: number;
  recent_sessions: Session[];
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
    throw new Error('Failed to fetch user sessions history');
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
    throw new Error(errorText || 'Failed to create session');
  }
  return res.json();
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const res = await fetch('/api/admin/stats');
  if (!res.ok) {
    throw new Error('Failed to fetch admin statistics');
  }
  return res.json();
}

export async function fetchAdminSessions(): Promise<Session[]> {
  const res = await fetch('/api/admin/sessions');
  if (!res.ok) {
    throw new Error('Failed to fetch admin sessions');
  }
  return res.json();
}

export async function deleteAdminSession(sessionId: string): Promise<void> {
  const res = await fetch(`/api/admin/sessions?id=${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error('Failed to delete session');
  }
}
