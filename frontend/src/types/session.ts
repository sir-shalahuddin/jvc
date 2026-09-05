// Type definitions for the Retrospective Session Board

export interface SessionDetail {
  id: string;
  name: string;
  owner_email?: string;
  created_at: string;
  status?: string;
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
  votes: number;
  cluster_tag?: string;
  parent_id?: string;
  created_at: string;
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
}

export interface PresenceResponse {
  participants: PresenceUser[];
  count: number;
  topic_counts?: Record<string, number>;
}

export interface TimerState {
  running: boolean;
  end_time_unix_ms: number;
  remaining_seconds: number;
}

export interface SpotlightState {
  active: boolean;
  question_id: string;
  answer_id: string;
  updated_at_ms: number;
}

export interface VoterStatus {
  voter_id: string;
  total_votes: number;
  remaining_votes: number;
  voted_answers: string[];
}

export type SortMode = 'votes' | 'newest' | 'oldest';
export type MoodFilter = 'all' | 'positive' | 'negative' | 'ideas' | 'action';
