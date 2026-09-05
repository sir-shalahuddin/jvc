// API service for Retrospective Session Board endpoints
import type {
  SessionDetail,
  Question,
  Answer,
  ActionItem,
  PresenceResponse,
  TimerState,
  SpotlightState,
  VoterStatus,
} from '../types/session';

// Device Fingerprint Helper
export function getDeviceFingerprint(): string {
  let fp = localStorage.getItem('retro_device_fp');
  if (!fp) {
    fp = 'dev_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36);
    localStorage.setItem('retro_device_fp', fp);
  }
  return fp;
}

const isMockMode = (id: string) => {
  return (
    id === 'demo-session' ||
    id.startsWith('demo-') ||
    new URLSearchParams(window.location.search).get('mock') === 'true'
  );
};

export async function fetchSessionDetails(id: string, role = 'guest'): Promise<SessionDetail> {
  try {
    const res = await fetch(`/api/session/get?id=${encodeURIComponent(id)}&role=${encodeURIComponent(role)}`);
    if (res.ok) return await res.json();
  } catch (_) {}

  if (isMockMode(id) || !window.location.host.includes('8080')) {
    return {
      id: id || 'demo-session',
      name: 'Sprint 42 Retrospective',
      created_at: new Date().toISOString(),
      is_owner: true,
      owner_email: 'facilitator@retro.hanya.click',
    };
  }
  throw new Error('Session not found');
}

export async function fetchQuestions(sessionId: string): Promise<Question[]> {
  try {
    const res = await fetch(`/api/session/questions?session_id=${encodeURIComponent(sessionId)}`);
    if (res.ok) return await res.json();
  } catch (_) {}

  if (isMockMode(sessionId) || !window.location.host.includes('8080')) {
    return [
      { id: 'q-1', session_id: sessionId, text: 'What went well this sprint? 🎉', created_at: new Date().toISOString(), answer_count: 5 },
      { id: 'q-2', session_id: sessionId, text: 'What challenges did we encounter? 🚧', created_at: new Date().toISOString(), answer_count: 0 },
      { id: 'q-3', session_id: sessionId, text: 'Innovations & Ideas for next sprint 🚀', created_at: new Date().toISOString(), answer_count: 0 },
    ];
  }
  throw new Error('Failed to fetch questions');
}

export async function addQuestion(sessionId: string, text: string, gifUrl = ''): Promise<{ id: string }> {
  const res = await fetch('/api/question/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, text, gif_url: gifUrl }),
  });
  if (!res.ok) throw new Error('Failed to add topic');
  return res.json();
}

export async function updateQuestion(questionId: string, text: string, gifUrl = ''): Promise<void> {
  const res = await fetch('/api/question/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question_id: questionId, text, gif_url: gifUrl }),
  });
  if (!res.ok) throw new Error('Failed to update topic');
}

export async function deleteQuestion(questionId: string): Promise<void> {
  const res = await fetch('/api/question/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question_id: questionId }),
  });
  if (!res.ok) throw new Error('Failed to delete topic');
}

export async function fetchAnswers(
  sessionId: string,
  questionId?: string,
  limit = 50,
  offset = 0
): Promise<Answer[]> {
  if (!sessionId) return [];
  try {
    let url = `/api/session/answers?session_id=${encodeURIComponent(sessionId)}`;
    if (questionId) {
      url += `&question_id=${encodeURIComponent(questionId)}`;
    }
    if (limit) url += `&limit=${limit}`;
    if (offset) url += `&offset=${offset}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (_) {}

  if (isMockMode(sessionId) || !window.location.host.includes('8080')) {
    return [
      {
        id: 'ans-1',
        session_id: sessionId,
        question_id: questionId || 'q-1',
        text: 'Deploy ke Cloud Run sangat mulus dan zero-downtime! Pipeline CI/CD berjalan dalam 2 menit.',
        sentiment_emoji: '🎉',
        sentiment_emotion: 'Celebration',
        sentiment_color: '#10b981',
        votes: 7,
        cluster_tag: 'devops',
        author_name: 'Swift Falcon',
        created_at: new Date().toISOString(),
      },
      {
        id: 'ans-2',
        session_id: sessionId,
        question_id: questionId || 'q-1',
        text: 'Kolaborasi dan komunikasi tim lintas divisi jauh lebih responsif dan transparan minggu ini.',
        sentiment_emoji: '💪',
        sentiment_emotion: 'Motivated',
        sentiment_color: '#3b82f6',
        votes: 5,
        cluster_tag: 'culture',
        author_name: 'Clever Otter',
        created_at: new Date().toISOString(),
      },
      {
        id: 'ans-3',
        session_id: sessionId,
        question_id: questionId || 'q-1',
        text: 'Dokumentasi API Swagger sudah sinkron dengan backend, mempermudah integrasi frontend.',
        sentiment_emoji: '✨',
        sentiment_emotion: 'Delight',
        sentiment_color: '#10b981',
        votes: 3,
        cluster_tag: 'docs',
        author_name: 'Cosmic Fox',
        created_at: new Date().toISOString(),
      },
      {
        id: 'ans-4',
        session_id: sessionId,
        question_id: questionId || 'q-1',
        text: 'Kopi di pantry sering habis sebelum makan siang :( butuh restock terjadwal!',
        sentiment_emoji: '☕',
        sentiment_emotion: 'Tired',
        sentiment_color: '#f59e0b',
        votes: 9,
        cluster_tag: 'office',
        author_name: 'Hyper Panda',
        created_at: new Date().toISOString(),
      },
      {
        id: 'ans-5',
        session_id: sessionId,
        question_id: questionId || 'q-1',
        text: 'Review PR sering tertunda lebih dari 48 jam, perlu notifikasi pengingat harian.',
        sentiment_emoji: '⏳',
        sentiment_emotion: 'Waiting',
        sentiment_color: '#ef4444',
        votes: 4,
        cluster_tag: 'process',
        author_name: 'Quiet Bear',
        created_at: new Date().toISOString(),
      },
    ];
  }
  return [];
}

export async function submitAnswer(params: {
  sessionId: string;
  questionId: string;
  text: string;
  gifUrl?: string;
}): Promise<{ id: string; author_name?: string }> {
  const fp = getDeviceFingerprint();
  const res = await fetch('/api/answer/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Fingerprint': fp,
    },
    body: JSON.stringify({
      session_id: params.sessionId,
      question_id: params.questionId,
      text: params.text,
      gif_url: params.gifUrl || '',
      device_fingerprint: fp,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Failed to submit reflection card');
  }
  return res.json();
}

export async function voteAnswer(params: {
  sessionId: string;
  answerId: string;
  action: 'vote' | 'unvote';
}): Promise<{ ok: boolean; remaining_votes?: number; message?: string }> {
  const fp = getDeviceFingerprint();
  const res = await fetch('/api/answer/vote', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Fingerprint': fp,
    },
    body: JSON.stringify({
      session_id: params.sessionId,
      answer_id: params.answerId,
      device_fingerprint: fp,
    }),
  });
  return res.json();
}

export async function fetchVoterStatus(sessionId: string): Promise<VoterStatus> {
  const fp = getDeviceFingerprint();
  const res = await fetch(
    `/api/session/voter-status?session_id=${encodeURIComponent(sessionId)}&device_fingerprint=${encodeURIComponent(fp)}`,
    {
      headers: {
        'X-Device-Fingerprint': fp,
      },
    }
  );
  if (!res.ok) return { voter_id: fp, total_votes: 0, remaining_votes: 5, voted_answers: [] };
  return res.json();
}

export async function fetchTimer(sessionId: string): Promise<TimerState> {
  const res = await fetch(`/api/session/timer?session_id=${encodeURIComponent(sessionId)}`);
  if (!res.ok) return { running: false, end_time_unix_ms: 0, remaining_seconds: 300 };
  return res.json();
}

export async function timerAction(sessionId: string, action: 'start' | 'reset', seconds = 300): Promise<void> {
  await fetch('/api/session/timer/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, action, seconds }),
  });
}

export async function fetchSpotlight(sessionId: string): Promise<SpotlightState> {
  const res = await fetch(`/api/session/spotlight?session_id=${encodeURIComponent(sessionId)}`);
  if (!res.ok) return { active: false, question_id: '', answer_id: '', updated_at_ms: 0 };
  return res.json();
}

export async function spotlightAction(params: {
  sessionId: string;
  action: 'focus' | 'clear';
  questionId?: string;
  answerId?: string;
}): Promise<SpotlightState> {
  const res = await fetch('/api/session/spotlight/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: params.sessionId,
      action: params.action,
      question_id: params.questionId || '',
      answer_id: params.answerId || '',
    }),
  });
  return res.json();
}

export async function syncPresenceApi(params: {
  sessionId: string;
  clientId: string;
  name: string;
  role: 'moderator' | 'participant';
}): Promise<PresenceResponse> {
  const res = await fetch('/api/session/presence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: params.sessionId,
      client_id: params.clientId,
      name: params.name,
      role: params.role,
    }),
  });
  if (!res.ok) return { participants: [], count: 1 };
  return res.json();
}

export function leavePresenceApi(sessionId: string, clientId: string): void {
  const payload = JSON.stringify({ session_id: sessionId, client_id: clientId });
  const blob = new Blob([payload], { type: 'application/json' });
  navigator.sendBeacon('/api/session/presence/leave', blob);
}

export async function fetchActionItems(sessionId: string): Promise<ActionItem[]> {
  try {
    const res = await fetch(`/api/action-items/get?session_id=${encodeURIComponent(sessionId)}`);
    if (res.ok) return await res.json();
  } catch (_) {}

  if (isMockMode(sessionId) || !window.location.host.includes('8080')) {
    return [
      { id: 'act-1', session_id: sessionId, text: 'Setup Slack bot untuk reminder PR review harian', assignee: 'John (Tech Lead)', due_date: 'Sprint 43', completed: false, created_at: new Date().toISOString() },
      { id: 'act-2', session_id: sessionId, text: 'Restock kopi dan snack pantry setiap Senin pagi', assignee: 'Office Ops', due_date: 'Next Week', completed: true, created_at: new Date().toISOString() },
    ];
  }
  return [];
}

export async function addActionItemApi(params: {
  sessionId: string;
  text: string;
  assignee?: string;
  dueDate?: string;
  answerId?: string;
}): Promise<ActionItem> {
  try {
    const res = await fetch('/api/action-items/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: params.sessionId,
        text: params.text,
        assignee: params.assignee || '',
        due_date: params.dueDate || '',
        answer_id: params.answerId || '',
      }),
    });
    if (res.ok) return await res.json();
  } catch (_) {}

  return {
    id: 'act-' + Math.random().toString(36).substring(2, 9),
    session_id: params.sessionId,
    text: params.text,
    assignee: params.assignee || 'Unassigned',
    due_date: params.dueDate || 'Next Sprint',
    completed: false,
    created_at: new Date().toISOString(),
  };
}

export async function toggleActionItemApi(id: string, completed: boolean): Promise<void> {
  try {
    await fetch('/api/action-items/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, completed }),
    });
  } catch (_) {}
}

export async function deleteActionItemApi(id: string): Promise<void> {
  try {
    await fetch(`/api/action-items/delete?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch (_) {}
}

export async function clusterCardApi(sessionId: string, answerId: string, tag: string): Promise<void> {
  try {
    await fetch('/api/answer/cluster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, answer_id: answerId, cluster_tag: tag }),
    });
  } catch (_) {}
}

export async function fetchSessionClusters(sessionId: string): Promise<string[]> {
  if (!sessionId) return [];
  try {
    const res = await fetch(`/api/session/clusters?session_id=${encodeURIComponent(sessionId)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((item: any) => (typeof item === 'string' ? item : item?.tag || '')).filter(Boolean);
      }
    }
  } catch (_) {}

  if (isMockMode(sessionId) || !window.location.host.includes('8080')) {
    return ['devops', 'culture', 'docs', 'office', 'process'];
  }
  return [];
}

export async function searchGiphy(query: string): Promise<Array<{ id: string; url: string; previewUrl: string }>> {
  if (query.trim().length < 2) return [];
  const res = await fetch(`/api/gifs/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const data = await res.json();
  if (!data?.data) return [];
  return data.data.map((g: any) => ({
    id: g.id,
    url: g.images?.fixed_height?.url || g.images?.original?.url || '',
    previewUrl: g.images?.fixed_height_small?.url || g.images?.fixed_height?.url || '',
  }));
}

export async function uploadMedia(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch('/api/upload', {
    method: 'POST',
    body: fd,
  });
  if (!res.ok) throw new Error('Failed to upload media');
  const data = await res.json();
  return data.url || '';
}
