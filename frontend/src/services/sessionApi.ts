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

export async function fetchSessionDetails(id: string, role = 'guest'): Promise<SessionDetail> {
  const res = await fetch(`/api/session/get?id=${encodeURIComponent(id)}&role=${encodeURIComponent(role)}`);
  if (!res.ok) throw new Error('Session not found');
  return res.json();
}

export async function fetchQuestions(sessionId: string): Promise<Question[]> {
  const res = await fetch(`/api/session/questions?session_id=${encodeURIComponent(sessionId)}`);
  if (!res.ok) throw new Error('Failed to fetch questions');
  return res.json();
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
  questionId: string,
  limit = 50,
  offset = 0
): Promise<Answer[]> {
  const res = await fetch(
    `/api/session/answers?question_id=${encodeURIComponent(questionId)}&limit=${limit}&offset=${offset}`
  );
  if (!res.ok) return [];
  return res.json();
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: params.sessionId,
      answer_id: params.answerId,
      voter_id: fp,
      action: params.action,
    }),
  });
  return res.json();
}

export async function fetchVoterStatus(sessionId: string): Promise<VoterStatus> {
  const fp = getDeviceFingerprint();
  const res = await fetch(
    `/api/session/voter-status?session_id=${encodeURIComponent(sessionId)}&voter_id=${encodeURIComponent(fp)}`
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
  const res = await fetch(`/api/action-items/get?session_id=${encodeURIComponent(sessionId)}`);
  if (!res.ok) return [];
  return res.json();
}

export async function addActionItemApi(params: {
  sessionId: string;
  text: string;
  assignee?: string;
  dueDate?: string;
  answerId?: string;
}): Promise<ActionItem> {
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
  if (!res.ok) throw new Error('Failed to create action item');
  return res.json();
}

export async function toggleActionItemApi(id: string, completed: boolean): Promise<void> {
  const res = await fetch('/api/action-items/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, completed }),
  });
  if (!res.ok) throw new Error('Failed to toggle action item');
}

export async function deleteActionItemApi(id: string): Promise<void> {
  const res = await fetch(`/api/action-items/delete?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete action item');
}

export async function clusterCardApi(sessionId: string, answerId: string, tag: string): Promise<void> {
  const res = await fetch('/api/answer/cluster', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, answer_id: answerId, cluster_tag: tag }),
  });
  if (!res.ok) throw new Error('Failed to cluster card');
}

export async function fetchSessionClusters(sessionId: string): Promise<string[]> {
  const res = await fetch(`/api/session/clusters?session_id=${encodeURIComponent(sessionId)}`);
  if (!res.ok) return [];
  return res.json();
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
