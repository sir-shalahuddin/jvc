// API service for the session board. Contract: tasks/API-retro-v2.md.
import { normalizePhase, type ActionItem, type BoardState, type Phase, type PreviousActions, type SpotlightState } from '../types/session';

// Device fingerprint. The server derives the voter identity from this value, so the
// SAME value must go out on every call (state, submit, vote). Never use the presence
// client id here, or own cards come back hidden.
export function getDeviceFingerprint(): string {
  let fp = localStorage.getItem('retro_device_fp');
  if (!fp) {
    fp = 'dev_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36);
    localStorage.setItem('retro_device_fp', fp);
  }
  return fp;
}

// Typed API error. Mock/demo fallbacks were removed on purpose: every failure
// must propagate so the UI can show it instead of pretending it succeeded.
export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type StatusMessages = Partial<Record<number, string>>;

function defaultMessage(status: number, fallback: string): string {
  if (status === 401) return 'Silakan masuk terlebih dahulu';
  if (status === 403) return 'Hanya pemilik sesi yang boleh melakukan ini';
  if (status === 404) return 'Data tidak ditemukan';
  if (status === 409) return 'Tidak bisa dilakukan di fase ini';
  if (status === 429) return 'Terlalu banyak permintaan, coba lagi sebentar';
  return fallback;
}

// fetch wrapper: throws ApiError on network failure or non-2xx response.
// Server texts are English; we only pass them through when we have no Indonesian line.
async function apiFetch(
  url: string,
  init: RequestInit | undefined,
  fallback: string,
  messages: StatusMessages = {}
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (_) {
    throw new ApiError('Koneksi gagal, periksa jaringan', 0);
  }
  if (!res.ok) {
    let msg = messages[res.status] || defaultMessage(res.status, fallback);
    const known = !!messages[res.status] || [401, 403, 404, 409, 429].includes(res.status);
    try {
      const text = (await res.text()).trim();
      let j: any = null;
      if (text.startsWith('{')) {
        try {
          j = JSON.parse(text);
        } catch (_) {}
      }
      if (res.status === 409 && j && typeof j.phase === 'string') {
        // Phase guard: keep the Indonesian line.
        msg = 'Tidak bisa dilakukan di fase ini';
      } else if (!known && text && text.length <= 120 && !text.startsWith('<')) {
        msg = (typeof j?.message === 'string' && j.message) || (typeof j?.error === 'string' && j.error) || (j ? msg : text);
      }
    } catch (_) {}
    throw new ApiError(msg, res.status);
  }
  return res;
}

function postJson(url: string, body: unknown, fallback: string, headers: Record<string, string> = {}, messages: StatusMessages = {}) {
  return apiFetch(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    },
    fallback,
    messages
  );
}

const q = encodeURIComponent;

// ---------- state (the only polled call) ----------

export async function fetchBoardState(
  sessionId: string,
  presence: { clientId: string; name: string }
): Promise<BoardState> {
  const fp = getDeviceFingerprint();
  const url =
    `/api/session/state?session_id=${q(sessionId)}&voter_id=${q(fp)}` +
    `&client_id=${q(presence.clientId)}&name=${q(presence.name)}`;
  try {
    const res = await apiFetch(
      url,
      { headers: { 'X-Device-Fingerprint': fp }, cache: 'no-store' },
      'Gagal memuat sesi'
    );
    const data = (await res.json()) as BoardState;
    if (!data || !data.session || !data.session.id) throw new ApiError('Sesi tidak ditemukan', 404);
    data.questions = Array.isArray(data.questions) ? data.questions : [];
    data.answers = Array.isArray(data.answers) ? data.answers : [];
    data.clusters = Array.isArray(data.clusters) ? data.clusters : [];
    data.session.phase = normalizePhase(data.session.phase);
    return data;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) {
      throw new ApiError('Sesi tidak ditemukan', 404);
    }
    throw e;
  }
}

export async function setPhaseApi(sessionId: string, phase: Phase): Promise<void> {
  await postJson('/api/session/phase', { session_id: sessionId, phase }, 'Gagal mengganti fase');
}

export async function fetchPreviousActions(sessionId: string): Promise<PreviousActions> {
  const res = await apiFetch(`/api/session/previous-actions?session_id=${q(sessionId)}`, undefined, 'Gagal memuat janji sesi lalu');
  const data = await res.json();
  return { session: data?.session ?? null, items: Array.isArray(data?.items) ? data.items : [] };
}

export function leavePresenceApi(sessionId: string, clientId: string): void {
  const payload = JSON.stringify({ session_id: sessionId, client_id: clientId });
  try {
    navigator.sendBeacon('/api/session/presence/leave', new Blob([payload], { type: 'application/json' }));
  } catch (_) {}
}

// ---------- topics ----------

export async function addQuestion(sessionId: string, text: string, gifUrl = ''): Promise<{ id: string }> {
  const res = await postJson('/api/question/add', { session_id: sessionId, text, gif_url: gifUrl }, 'Gagal menambah topik');
  return res.json();
}

export async function updateQuestion(sessionId: string, questionId: string, text: string, gifUrl = ''): Promise<void> {
  await postJson('/api/question/update', { session_id: sessionId, id: questionId, text, gif_url: gifUrl }, 'Gagal mengubah topik');
}

export async function deleteQuestion(sessionId: string, questionId: string): Promise<void> {
  await postJson('/api/question/delete', { session_id: sessionId, id: questionId }, 'Gagal menghapus topik');
}

// ---------- cards ----------

export async function submitAnswer(params: {
  sessionId: string;
  questionId: string;
  text: string;
  gifUrl?: string;
}): Promise<{ id: string; author_name?: string }> {
  const fp = getDeviceFingerprint();
  const res = await postJson(
    '/api/answer/submit',
    {
      session_id: params.sessionId,
      question_id: params.questionId,
      text: params.text,
      gif_url: params.gifUrl || '',
      device_fingerprint: fp,
    },
    'Gagal mengirim kartu',
    { 'X-Device-Fingerprint': fp }
  );
  return res.json();
}

// Voting is one-way on the server (no unvote).
export async function voteAnswer(sessionId: string, answerId: string): Promise<{ votes: number; remaining_votes: number }> {
  const fp = getDeviceFingerprint();
  const res = await postJson(
    '/api/answer/vote',
    { session_id: sessionId, answer_id: answerId, device_fingerprint: fp },
    'Gagal memberi vote',
    { 'X-Device-Fingerprint': fp },
    { 409: 'Kartu ini sudah kamu vote', 429: 'Vote kamu sudah habis' }
  );
  return res.json();
}

export async function clusterCardApi(sessionId: string, answerId: string, tag: string): Promise<void> {
  await postJson('/api/answer/cluster', { session_id: sessionId, answer_id: answerId, cluster_tag: tag }, 'Gagal menyimpan kelompok');
}

// ---------- facilitator tools ----------

export async function timerAction(sessionId: string, action: 'start' | 'reset', seconds = 300): Promise<void> {
  await postJson('/api/session/timer/action', { session_id: sessionId, action, seconds }, 'Gagal mengubah timer');
}

export async function spotlightAction(params: {
  sessionId: string;
  action: 'focus' | 'clear';
  questionId?: string;
  answerId?: string;
}): Promise<SpotlightState> {
  const res = await postJson(
    '/api/session/spotlight/action',
    {
      session_id: params.sessionId,
      action: params.action,
      question_id: params.questionId || '',
      answer_id: params.answerId || '',
    },
    'Gagal mengubah sorotan'
  );
  return res.json();
}

// Invite link: the server shortens the board URL through hanya.click when it can.
export async function fetchShareLink(sessionId: string): Promise<string> {
  const res = await apiFetch(`/api/session/share-link?id=${q(sessionId)}`, undefined, 'Gagal membuat link undangan');
  const data = await res.json();
  if (!data?.short_url) throw new ApiError('Gagal membuat link undangan', 500);
  return data.short_url as string;
}

// ---------- action items ----------

export async function fetchActionItems(sessionId: string): Promise<ActionItem[]> {
  const res = await apiFetch(`/api/action-items/get?session_id=${q(sessionId)}`, undefined, 'Gagal memuat aksi');
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function addActionItemApi(params: {
  sessionId: string;
  text: string;
  assignee?: string;
  dueDate?: string;
  answerId?: string;
}): Promise<ActionItem> {
  const res = await postJson(
    '/api/action-items/add',
    {
      session_id: params.sessionId,
      text: params.text,
      assignee: params.assignee || '',
      due_date: params.dueDate || '',
      answer_id: params.answerId || '',
    },
    'Gagal menambah aksi'
  );
  return res.json();
}

// Backend contract: POST {session_id, id, completed}. The server stores the value we send.
// For "Janji sesi lalu" pass the OLD session id.
export async function toggleActionItemApi(sessionId: string, id: string, completed: boolean): Promise<void> {
  await postJson('/api/action-items/toggle', { session_id: sessionId, id, completed }, 'Gagal memperbarui aksi');
}

export async function deleteActionItemApi(sessionId: string, id: string): Promise<void> {
  await postJson('/api/action-items/delete', { session_id: sessionId, id }, 'Gagal menghapus aksi');
}

// ---------- media ----------

export async function searchGiphy(query: string): Promise<Array<{ id: string; url: string; previewUrl: string }>> {
  if (query.trim().length < 2) return [];
  const res = await apiFetch(`/api/gifs/search?q=${q(query)}`, undefined, 'Gagal mencari GIF');
  const data = await res.json();
  if (!data?.data) return [];
  return data.data.map((g: any) => ({
    id: g.id,
    url: g.images?.fixed_height?.url || g.images?.original?.url || '',
    previewUrl: g.images?.fixed_height_small?.url || g.images?.fixed_height?.url || '',
  }));
}

// Requires login (/api/upload). The UI hides upload for guests.
export async function uploadMedia(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('image', file);
  const res = await apiFetch('/api/upload', { method: 'POST', body: fd }, 'Gagal mengunggah gambar');
  const data = await res.json();
  return data.url || '';
}

// The server's voter id: hex(sha256("hw_voter:" + fp)). Used to recognise own cards
// outside `write`. Returns '' when SubtleCrypto is unavailable (non-secure context).
export async function getVoterId(): Promise<string> {
  try {
    const bytes = new TextEncoder().encode('hw_voter:' + getDeviceFingerprint());
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  } catch (_) {
    return '';
  }
}
