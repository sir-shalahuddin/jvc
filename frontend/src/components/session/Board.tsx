import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, Plus } from 'lucide-react';
import { Menu } from '../common/Menu';
import { CardItem } from './CardItem';
import { isHidden, type Answer, type AnyAnswer, type Phase, type Question } from '../../types/session';

export interface BoardHandlers {
  onAddCard: (q: Question) => void;
  onAddTopic: () => void;
  onEditTopic: (q: Question) => void;
  onDeleteTopic: (q: Question) => void;
  onVote: (a: Answer) => void;
  onSetCluster: (a: Answer, tag: string) => Promise<boolean>;
  onSpotlight: (a: Answer) => void;
  onMakeAction: (a: Answer) => void;
}

export type BoardView = 'focus' | 'columns';

interface Props extends BoardHandlers {
  /** Effective view: mobile is always 'focus'. */
  view: BoardView;
  setView: (v: BoardView) => void;
  isMobile: boolean;
  questions: Question[];
  answers: AnyAnswer[];
  phase: Phase;
  isOwner: boolean;
  myVoterId: string;
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  clusterFilter: string;
  clusters: string[];
  votedIds: Set<string>;
  votesLeft: number;
  sessionId: string;
  /** Bumps when the user taps "Urutkan by vote" (discuss). */
  sortTick: number;
  spotlightId: string;
  busyIds: Set<string>;
  /** Focus view: the phase hint line under the title. */
  hint: string;
  /** Focus view, discuss/done: the line with the vote budget, sort and group filter. */
  tools: React.ReactNode;
  /** Focus view: small links beside the topic navigation (previous promises, + Topik). */
  navExtras: React.ReactNode;
}

const byVotes = (a: Answer, b: Answer) => (b.votes || 0) - (a.votes || 0);

interface Item {
  id: string;
  hidden: boolean;
  a?: Answer;
}

const FLIP_MS = 500;

// The back of a card someone else wrote; shown during Tulis. No text, no author.
const ClosedCard: React.FC<{ back?: boolean }> = ({ back }) => (
  <article className={`card card-closed ${back ? 'flip-back' : ''}`} aria-label={back ? undefined : 'Kartu tertutup'} aria-hidden={back || undefined}>
    <span className="closed-label">Tertutup</span>
  </article>
);

export const Board: React.FC<Props> = (p) => {
  const colsRef = useRef<HTMLDivElement>(null);

  // Discuss: card order per topic, frozen so cards do not jump while people vote.
  // Keyed by session|topic, component state only (not persisted). Starts as server order,
  // new cards are appended, and "Urutkan by vote" re-sorts once and freezes again.
  const [frozen, setFrozen] = useState<Record<string, string[]>>({});
  useEffect(() => {
    if (p.phase !== 'discuss') {
      setFrozen((f) => (Object.keys(f).length ? {} : f));
      return;
    }
    setFrozen((f) => {
      const next = { ...f };
      let changed = false;
      const ids = new Map<string, string[]>();
      for (const a of p.answers) if (!isHidden(a)) ids.set(a.question_id, [...(ids.get(a.question_id) || []), a.id]);
      for (const [q, list] of ids) {
        const k = `${p.sessionId}|${q}`;
        const cur = f[k] || [];
        const missing = list.filter((id) => !cur.includes(id));
        if (missing.length || !f[k]) {
          next[k] = [...cur, ...missing];
          changed = true;
        }
      }
      return changed ? next : f;
    });
  }, [p.phase, p.answers, p.sessionId]);
  const handledTick = useRef(p.sortTick);
  useEffect(() => {
    if (handledTick.current === p.sortTick) return;
    handledTick.current = p.sortTick;
    if (p.phase !== 'discuss') return;
    const by = new Map<string, Answer[]>();
    for (const a of p.answers) if (!isHidden(a)) by.set(a.question_id, [...(by.get(a.question_id) || []), a]);
    const next: Record<string, string[]> = {};
    for (const [q, list] of by) next[`${p.sessionId}|${q}`] = [...list].sort(byVotes).map((a) => a.id);
    setFrozen(next);
  }, [p.sortTick, p.phase, p.answers, p.sessionId]);

  const byTopic = useMemo(() => {
    const m = new Map<string, { items: Item[]; cards: number; hidden: number }>();
    for (const q of p.questions) m.set(q.id, { items: [], cards: 0, hidden: 0 });
    for (const a of p.answers) {
      const slot = m.get(a.question_id);
      if (!slot) continue;
      if (isHidden(a)) {
        slot.hidden++;
        slot.items.push({ id: a.id, hidden: true });
      } else if (!p.clusterFilter || (a.cluster_tag || '') === p.clusterFilter) {
        slot.cards++;
        slot.items.push({ id: a.id, hidden: false, a });
      }
    }
    for (const slot of m.values()) {
      if (p.phase === 'write') continue; // keep server order: own and closed cards mixed
      const cards = slot.items.map((i) => i.a!).filter(Boolean);
      if (p.phase === 'done') {
        cards.sort(byVotes); // stable: ties keep server order
      } else {
        // discuss: order is frozen (see `frozen`); cards not yet frozen stay at the end in server order.
        const q = cards[0]?.question_id;
        const rank = new Map((frozen[`${p.sessionId}|${q}`] || []).map((id, i) => [id, i]));
        const r = (a: Answer) => rank.get(a.id) ?? Infinity;
        cards.sort((a, b) => (r(a) === r(b) ? 0 : r(a) < r(b) ? -1 : 1));
      }
      slot.items = cards.map((a) => ({ id: a.id, hidden: false, a }));
    }
    return m;
  }, [p.questions, p.answers, p.phase, p.clusterFilter, p.sessionId, frozen]);

  // Reveal: when write ends while we are watching, the cards that were closed flip once.
  const hiddenRef = useRef<Set<string>>(new Set());
  const [seen, setSeen] = useState<{ phase: Phase; reveal: Set<string> | null }>({ phase: p.phase, reveal: null });
  if (seen.phase !== p.phase) {
    let reveal: Set<string> | null = null;
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (seen.phase === 'write' && !reduced) {
      reveal = new Set();
      for (const a of p.answers) if (!isHidden(a) && hiddenRef.current.has(a.id)) reveal.add(a.id);
      if (reveal.size === 0) reveal = null;
    }
    setSeen({ phase: p.phase, reveal });
  }
  useEffect(() => {
    if (p.phase === 'write') hiddenRef.current = new Set(p.answers.filter(isHidden).map((a) => a.id));
  }, [p.phase, p.answers]);
  useEffect(() => {
    if (!seen.reveal) return;
    const t = window.setTimeout(() => setSeen((s) => ({ ...s, reveal: null })), 1000);
    return () => window.clearTimeout(t);
  }, [seen.reveal]);

  // Keyboard topic changes on desktop: bring that column into view.
  useEffect(() => {
    if (p.view !== 'columns') return;
    // Scroll the column strip only (never the page).
    const c = colsRef.current;
    const el = c?.children[p.activeIndex] as HTMLElement | undefined;
    if (!c || !el || c.scrollWidth <= c.clientWidth) return;
    const left = el.getBoundingClientRect().left - c.getBoundingClientRect().left + c.scrollLeft;
    if (left < c.scrollLeft || left + el.offsetWidth > c.scrollLeft + c.clientWidth) {
      c.scrollTo({ left: Math.max(0, left - 8), behavior: 'smooth' });
    }
  }, [p.activeIndex, p.view]);

  if (p.questions.length === 0) {
    return (
      <div className="board-empty">
        {p.isOwner ? (
          <>
            <p>Belum ada topik.</p>
            <button type="button" className="btn primary" onClick={p.onAddTopic}>
              Tambah topik
            </button>
          </>
        ) : (
          <p>Fasilitator belum menambah topik.</p>
        )}
      </div>
    );
  }

  // Focus view, under the title: prev/next, "Topik N dari M" menu, small links, then the hint.
  const focusHead = (_q: Question, idx: number) => {
    const n = p.questions.length;
    return (
      <>
        <div className="fnav-row">
          <button type="button" className="icon-btn" disabled={idx === 0} onClick={() => p.setActiveIndex(idx - 1)} aria-label="Topik sebelumnya" title="Topik sebelumnya (←)">
            <ChevronLeft size={18} />
          </button>
          {n > 1 ? (
            <Menu
              label="Pilih topik"
              align="left"
              className="topic-jump"
              trigger={(t) => (
                <button type="button" {...t} className="fnav-pos fnav-pos-btn num" aria-live="polite">
                  Topik {idx + 1} dari {n} <ChevronDown size={14} aria-hidden="true" />
                </button>
              )}
            >
              {(close) => (
                <div className="topic-menu">
                  {p.questions.map((t, i) => (
                    <button
                      key={t.id}
                      type="button"
                      role="menuitem"
                      className="menu-item topic-item"
                      aria-current={i === idx ? 'true' : undefined}
                      onClick={() => (close(), p.setActiveIndex(i))}
                    >
                      <span className="topic-item-n num">{i + 1}</span>
                      <span className="topic-item-t">{t.text}</span>
                      <span className="topic-item-c num">{t.answer_count ?? 0}</span>
                    </button>
                  ))}
                </div>
              )}
            </Menu>
          ) : (
            <span className="fnav-pos num" aria-live="polite">
              Topik {idx + 1} dari {n}
            </span>
          )}
          <button type="button" className="icon-btn" disabled={idx === n - 1} onClick={() => p.setActiveIndex(idx + 1)} aria-label="Topik berikutnya" title="Topik berikutnya (→)">
            <ChevronRight size={18} />
          </button>
          <div className="fnav-extras">
            {p.navExtras}
            {!p.isMobile && n > 1 && (
              <button type="button" className="link-btn view-link" onClick={() => p.setView('columns')}>
                Semua kolom
              </button>
            )}
          </div>
        </div>
        <p className="focus-hint">{p.hint}</p>
      </>
    );
  };

  const renderColumn = (q: Question, idx: number, focus = false) => {
    const slot = byTopic.get(q.id) || { items: [], cards: 0, hidden: 0 };
    const total = q.answer_count ?? slot.cards + slot.hidden;
    const reveal = seen.reveal;
    const nFlip = reveal ? slot.items.filter((i) => reveal.has(i.id)).length : 0;
    // Whole reveal stays within ~900ms: 500ms flip + at most 400ms of stagger.
    const step = nFlip > 1 ? Math.min(25, 400 / (nFlip - 1)) : 0;
    let flipIdx = 0;
    return (
      <section
        key={q.id}
        className={`col ${focus ? 'is-focus' : idx === p.activeIndex ? 'is-active' : ''}`}
        aria-labelledby={`col-h-${q.id}`}
        onFocusCapture={focus ? undefined : () => idx !== p.activeIndex && p.setActiveIndex(idx)}
        onMouseDown={focus ? undefined : () => idx !== p.activeIndex && p.setActiveIndex(idx)}
      >
        <div className="col-h">
          <div className="col-title">
            <h2 id={`col-h-${q.id}`}>{q.text}</h2>
            <span className="col-count num">
              {total} kartu
            </span>
          </div>
          {p.isOwner && (
            <Menu
              label="Topik"
              trigger={(t) => (
                <button type="button" {...t} className="icon-btn" aria-label={`Atur topik ${q.text}`}>
                  <MoreHorizontal size={16} />
                </button>
              )}
            >
              {(close) => (
                <>
                  <button type="button" role="menuitem" className="menu-item" onClick={() => (close(), p.onEditTopic(q))}>
                    Ubah topik
                  </button>
                  <button type="button" role="menuitem" className="menu-item" onClick={() => (close(), p.onDeleteTopic(q))}>
                    Hapus topik
                  </button>
                </>
              )}
            </Menu>
          )}
        </div>
        {q.gif_url && <img className="col-gif" src={q.gif_url} alt="" loading="lazy" />}

        {focus && focusHead(q, idx)}

        {p.phase === 'write' && (
          <button type="button" className={`btn block add-card ${focus ? 'add-card-focus' : ''}`} onClick={() => p.onAddCard(q)}>
            <Plus size={16} aria-hidden="true" /> Tulis kartu
          </button>
        )}
        {focus && p.phase !== 'write' && p.tools}


        <div className={focus ? 'col-cards fgrid' : 'col-cards'}>
          {slot.items.map((it) => {
            const flipping = !!reveal && reveal.has(it.id) && !it.hidden;
            const delay = flipping ? Math.round(flipIdx++ * step) : 0;
            return (
              <div
                key={it.id}
                className={`cw ${flipping ? 'is-flip' : ''}`}
                style={flipping ? ({ '--flip-delay': `${delay}ms`, '--flip-ms': `${FLIP_MS}ms` } as React.CSSProperties) : undefined}
              >
                {flipping && <ClosedCard back />}
                {it.hidden || !it.a ? (
                  <ClosedCard />
                ) : (
                  <CardItem
                    answer={it.a}
                    phase={p.phase}
                    isOwner={p.isOwner}
                    isMine={p.phase === 'write' || (!!p.myVoterId && it.a.author_id === p.myVoterId)}
                    spotlighted={p.spotlightId === it.id}
                    voted={p.votedIds.has(it.id)}
                    votesLeft={p.votesLeft}
                    clusters={p.clusters}
                    busy={p.busyIds.has(it.id)}
                    onVote={p.onVote}
                    onSetCluster={p.onSetCluster}
                    onSpotlight={p.onSpotlight}
                    onMakeAction={p.onMakeAction}
                  />
                )}
              </div>
            );
          })}
          {slot.items.length === 0 && (
            <p className="col-empty">{p.clusterFilter ? 'Tidak ada kartu di kelompok ini.' : 'Belum ada kartu.'}</p>
          )}
        </div>
      </section>
    );
  };

  if (p.view === 'focus') {
    const n = p.questions.length;
    const idx = Math.min(p.activeIndex, n - 1);
    const q = p.questions[idx];
    return (
      <div className="focus">
        {renderColumn(q, idx, true)}
      </div>
    );
  }

  return (
    <>
      <div className="fnav-row cols-bar">
        {p.questions.length > 4 && (
          <p className="cols-hint">{p.questions.length} topik. Geser ke samping atau pakai ← → untuk melihat semuanya.</p>
        )}
        <div className="view-toggle" role="group" aria-label="Tampilan papan">
          <button type="button" aria-pressed="false" onClick={() => p.setView('focus')}>Fokus</button>
          <button type="button" aria-pressed="true">Semua kolom</button>
        </div>
      </div>
      <div className="cols" ref={colsRef} style={{ '--cols': Math.min(4, p.questions.length) } as React.CSSProperties}>
        {p.questions.map((q, i) => renderColumn(q, i))}
      </div>
    </>
  );
};
