// Card front: kaomoji + mood label + mood colour, from the answer's sentiment fields.
// Kaomoji mapping ported from the old services/sentimentEngine.ts (f8e8d28), without the
// per-emotion animations. Colours are clamped so the hard shadow stays readable on cream
// (light) and on the dark card background.
import type { Answer } from '../types/session';

export type MoodGroup = 'green' | 'red' | 'purple' | 'amber';

export interface Mood {
  kaomoji: string;
  /** Short label shown under the kaomoji ("…" while sentiment is not in yet). */
  label: string;
  type: string;
  pending: boolean;
  /** Shadow / edge colour for the light and the dark scheme; null = plain ink. */
  light: string | null;
  dark: string | null;
}

function pick(list: string[], seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return list[Math.abs(h) % list.length];
}

interface Rule {
  type: string;
  group: MoodGroup | null;
  words: string[];
  faces: string[];
  emoji?: string[];
}

// Order matters: first match wins (same order as the old engine, then the extra buckets).
const RULES: Rule[] = [
  { type: 'fight', group: 'amber', words: ['fight', 'semangat', 'challeng', 'determ', 'push', 'bisa', 'power', 'strong', 'tantangan'], faces: ["(ง'̀-'́)ง", '(ง •̀_•́)ง', 'ᕦ(ò_óˇ)ᕤ'], emoji: ['💪', '🥊', '⚔️'] },
  { type: 'party', group: 'green', words: ['party', 'celebrat', 'win', 'victory', 'champion', 'cheer', 'menang', 'rayakan'], faces: ['＼(＾O＾)／', '(ﾉ◕ヮ◕)ﾉ', '(≧◡≦)', 'ᕕ( ᐛ )ᕗ'], emoji: ['🎉', '🎊', '🏆', '🚀', '🥳'] },
  { type: 'love', group: 'green', words: ['love', 'gratitude', 'grateful', 'appreciat', 'kudos', 'thank', 'support', 'syukur', 'terima kasih', 'makasih', 'apresiasi'], faces: ['(♥‿♥)', '(人´∀｀)', '(◍•ᴗ•◍)', '( ˘ ³˘)♥'], emoji: ['❤️', '💖', '💕', '🙏', '🥰'] },
  { type: 'mindblown', group: 'amber', words: ['idea', 'sparkle', 'mindblown', 'genius', 'eureka', 'innovat', 'solut', 'inspir'], faces: ['( ✧Д✧)', '(★ω★)', '( ﾟヮﾟ)', '(⊙_⊙)！'], emoji: ['💡', '✨', '⭐', '🧠'] },
  { type: 'panic', group: 'red', words: ['panic', 'chaos', 'flip', 'incident', 'blocker', 'disaster', 'fire', 'panik', 'kacau'], faces: ['(╯°□°)╯', '(ノಠ益ಠ)ノ', '(;￣Д￣)'], emoji: ['💥', '🚨', '⚠️', '🔥'] },
  { type: 'exhausted', group: 'purple', words: ['tired', 'exhaust', 'burnout', 'sleep', 'drained', 'overwork', 'capek', 'lelah', 'letih'], faces: ['(×_×)', '(っ- ‸ -ς)', '(-.-)Zzz', '(ノ_ _)ノ'], emoji: ['😴', '🥱', '😩'] },
  { type: 'crying', group: 'red', words: ['cry', 'tear', 'broken', 'grief', 'regret', 'sad', 'sedih', 'kecewa', 'disappoint'], faces: ['ಥ_ಥ', '(T_T)', '( ; _ ; )', '(இдஇ)'], emoji: ['😢', '😭', '💔'] },
  { type: 'joy', group: 'green', words: ['joy', 'happy', 'positive', 'good', 'great', 'senang', 'bahagia', 'puas', 'lega', 'excit', 'proud', 'bangga', 'optimis'], faces: ['(ᵔ◡ᵔ)', '(✿◠‿◠)', '(＾◡＾)', '(^‿^)'], emoji: ['😀', '😄', '😊', '🙂', '👍'] },
  // Extra buckets (kaomoji from tasks/SPEC-card-emot-animation.md), so common negative moods map too.
  { type: 'angry', group: 'red', words: ['angry', 'anger', 'rage', 'frustrat', 'annoy', 'irritat', 'marah', 'kesal', 'jengkel', 'negative'], faces: ['(ಠ_ಠ)', '(｀Д´)', '(╬ಠ益ಠ)'], emoji: ['😠', '😡', '😤'] },
  { type: 'nervous', group: 'amber', words: ['nervous', 'worr', 'anxi', 'concern', 'stress', 'cemas', 'khawatir', 'takut', 'gugup'], faces: ['(・_・;)', '(￣▽￣;)'], emoji: ['😬', '😰', '😟'] },
  { type: 'curious', group: 'amber', words: ['curious', 'confus', 'question', 'wonder', 'uncertain', 'bingung', 'penasaran', 'ragu'], faces: ['(⊙_⊙)', '(・・?)', '(˘･_･˘)'], emoji: ['🤔', '❓', '😕'] },
  { type: 'cool', group: 'green', words: ['cool', 'calm', 'chill', 'relax', 'smart', 'tenang', 'santai'], faces: ['(⌐■_■)', '(￣ー￣)'], emoji: ['😎'] },
];

const GROUP_COLOR: Record<MoodGroup, { light: string; dark: string }> = {
  green: { light: '#0e8a5a', dark: '#4fd8a0' },
  red: { light: '#cf2f36', dark: '#ff8079' },
  purple: { light: '#7445c9', dark: '#b99af5' },
  amber: { light: '#c06a00', dark: '#f6b740' },
};

const PENDING_FACE = '(・_・)';

function isPending(a: Answer): boolean {
  const e = (a.sentiment_emotion || '').trim().toLowerCase();
  return !e || e.startsWith('analy') || e === 'unavailable' || e === 'pending' || e === '…' || e === '...';
}

// ---------- colour helpers ----------

function hexToHsl(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue *= 60;
  return [hue, s, l];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const hsl = (h: number, s: number, l: number) => `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;

/** A valid, saturated hex colour from the server, made readable for both schemes. Grey = no colour. */
function readable(hex: string | undefined): { light: string; dark: string } | null {
  if (!hex) return null;
  const v = hexToHsl(hex);
  if (!v) return null;
  const [h, s, l] = v;
  if (s < 0.18) return null; // greys (incl. the "#9CA3AF" placeholder) carry no mood
  const sat = clamp(s, 0.45, 0.85);
  return { light: hsl(h, sat, clamp(l, 0.3, 0.46)), dark: hsl(h, sat, clamp(l, 0.62, 0.74)) };
}

export function moodOf(a: Answer): Mood {
  if (isPending(a)) {
    return { kaomoji: PENDING_FACE, label: '…', type: 'pending', pending: true, light: null, dark: null };
  }
  const emotion = (a.sentiment_emotion || '').trim();
  const lower = emotion.toLowerCase();
  const emoji = a.sentiment_emoji || '';
  const seed = a.id || emotion;
  let rule = RULES.find((r) => r.words.some((w) => lower.includes(w)));
  if (!rule && emoji) rule = RULES.find((r) => r.emoji?.some((e) => emoji.includes(e)));
  const label = emotion.length > 22 ? `${emotion.slice(0, 21)}…` : emotion;
  const own = readable(a.sentiment_color);
  const byGroup = rule?.group ? GROUP_COLOR[rule.group] : null;
  const col = own || byGroup;
  return {
    kaomoji: rule ? pick(rule.faces, seed) : '(•‿•)',
    label,
    type: rule?.type || 'neutral',
    pending: false,
    light: col?.light ?? null,
    dark: col?.dark ?? null,
  };
}
