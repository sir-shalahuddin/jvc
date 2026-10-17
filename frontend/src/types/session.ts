// Types for the session board. Shapes follow tasks/API-retro-v2.md.

export type Phase = 'write' | 'discuss' | 'done';

export const PHASES: Phase[] = ['write', 'discuss', 'done'];

export const PHASE_LABEL: Record<Phase, string> = {
  write: 'Tulis',
  discuss: 'Bahas',
  done: 'Selesai',
};

/** Legacy stored phases (group, vote, act) and a missing value all mean discuss. */
export function normalizePhase(p: string | undefined | null): Phase {
  return p === 'write' || p === 'done' ? p : 'discuss';
}

export interface SessionDetail {
  id: string;
  name: string;
  owner_email?: string;
  created_at: string;
  status?: string;
  phase: Phase;
  is_owner?: boolean;
}

export interface Question {
  id: string;
  session_id: string;
  text: string;
  type?: string;
  gif_url?: string;
  time_limit_seconds?: number;
  created_at?: string;
  answer_count?: number;
}

export interface Answer {
  id: string;
  question_id: string;
  session_id: string;
  text: string;
  gif_url?: string;
  sentiment_emotion?: string;
  sentiment_color?: string;
  sentiment_emoji?: string;
  author_name?: string;
  author_id?: string;
  votes: number;
  cluster_tag?: string;
  parent_id?: string;
  created_at: string;
  hidden?: undefined;
}

/** Someone else's card during `write`: only id + topic, no content. */
export interface HiddenAnswer {
  id: string;
  question_id: string;
  hidden: true;
}

export type AnyAnswer = Answer | HiddenAnswer;

export function isHidden(a: AnyAnswer): a is HiddenAnswer {
  return (a as HiddenAnswer).hidden === true;
}

export interface ActionItem {
  id: string;
  session_id: string;
  answer_id?: string;
  text: string;
  assignee?: string;
  due_date?: string;
  completed: boolean;
  created_at?: string;
}

export interface PresenceUser {
  id: string;
  name: string;
  role: 'moderator' | 'participant';
  last_seen?: string;
}

export interface Presence {
  session_id?: string;
  count: number;
  participants: PresenceUser[];
  topic_counts?: Record<string, number>;
}

export interface TimerState {
  session_id?: string;
  running: boolean;
  remaining_seconds: number;
  end_time_unix_ms: number;
  preset_minutes?: number;
}

export interface SpotlightState {
  session_id?: string;
  active: boolean;
  question_id: string;
  answer_id: string;
  updated_at_ms: number;
}

export interface VoterStatus {
  guest_name?: string;
  guest_id?: string;
  total_votes: number;
  remaining_votes: number;
  max_votes?: number;
  voted_answers: string[];
}

export interface ClusterCount {
  tag: string;
  count: number;
}

/** GET /api/session/state */
export interface BoardState {
  session: SessionDetail;
  questions: Question[];
  answers: AnyAnswer[];
  voter_status: VoterStatus;
  vote_budget: number;
  timer: TimerState;
  spotlight: SpotlightState;
  presence: Presence;
  clusters: ClusterCount[];
  server_time_ms: number;
}

/** GET /api/session/previous-actions */
export interface PreviousActions {
  session: { id: string; name: string; created_at: string } | null;
  items: ActionItem[];
}
