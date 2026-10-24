import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal, Plus, X } from 'lucide-react';
import { Menu } from '../common/Menu';
import { CardItem } from './CardItem';
import { isHidden, type Answer, type AnyAnswer, type ClusterCount, type Phase, type Question } from '../../types/session';

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
  setClusterFilter: (tag: string) => void;
  /** Kelompok names with counts (discuss/done). */
  clusterCounts: ClusterCount[];
  votedIds: Set<string>;
  votesLeft: number;
  budget: number;
  sessionId: string;
  /** Bumps when the user picks "Urutkan by vote" (discuss). */
  sortTick: number;
  onSort: () => void;
  spotlightId: string;
  busyIds: Set<string>;
  /** One short muted line inside the topic box. */
  hint: string;
  /** Open promises from last time; null hides the menu item. */
  prevOpen: number | null;
  onOpenPrev: () => void;
  /** Done: summary link and (owner) share. */
  summaryHref: string | null;
  onShareSummary: () => void;
  /** Done, owner only: open the PDF report. */
  onExport: () => void;
}

const byVotes = (a: Answer, b: Answer) => (b.votes || 0) - (a.votes || 0);

interface Item {
  id: string;
  hidden: boolean;
  a?: Answer;
}

const FLIP_MS = 500;

// Someone else's card during Tulis: no text, no author, no mood.
const ClosedCard: React.FC<{ back?: boolean }> = ({ back }) => (
  <article className={`card card-closed ${back ? 'flip-back' : ''}`} aria-label={back ? undefined : 'Kartu tertutup'} aria-hidden={back || undefined}>
    <span className="closed-label">Tertutup</span>
  </article>
);

export const Board: React.FC<Props> = (p) => {
  const colsRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

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

  // ---------- flip state: which cards show their back (text) ----------
  // Lives here (not in the card) so it survives topic switches and polling.
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const toggleCard = useCallback((id: string) => {
    setOpenIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);
  // A spotlighted card opens for everyone.
  useEffect(() => {
    if (!p.spotlightId) return;
    setOpenIds((s) => (s.has(p.spotlightId) ? s : new Set(s).add(p.spotlightId)));
  }, [p.spotlightId]);
  // Phase changes start from the front (the reveal shows kaomoji first).
  const lastPhase = useRef(p.phase);
  useEffect(() => {
    if (lastPhase.current === p.phase) return;
    lastPhase.current = p.phase;
    setOpenIds(p.spotlightId ? new Set([p.spotlightId]) : new Set());
  }, [p.phase, p.spotlightId]);

  const n = p.questions.length;
  const idx = Math.min(p.activeIndex, Math.max(0, n - 1));
  const current = p.questions[idx];
  // "Buka/Tutup semua kartu": the cards in view (current topic in focus view, all in columns).
  const inView = useMemo(() => {
    const ids: string[] = [];
    for (const [qid, slot] of byTopic) {
      if (p.view === 'focus' && qid !== current?.id) continue;
      for (const it of slot.items) if (!it.hidden) ids.push(it.id);
    }
    return ids;
  }, [byTopic, p.view, current?.id]);
  const allOpen = inView.length > 0 && inView.every((id) => openIds.has(id));
  const flipAll = (open: boolean) =>
    setOpenIds((s) => {
      const nx = new Set(s);
      for (const id of inView) {
        if (open) nx.add(id);
        else nx.delete(id);
      }
      return nx;
    });

  // ---------- reveal: when write ends while we watch, closed cards flip to their front once ----------
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

  // Columns view: keyboard topic changes bring that column into view.
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

  // Edge arrows + dock are fixed to the viewport, but placed at the edges of the board area,
  // so an open action aside never sits under the right arrow.
  const [edges, setEdges] = useState<{ l: number; r: number; c: number } | null>(null);
  const hasTopics = n > 0;
  useLayoutEffect(() => {
    if (p.view !== 'focus') return;
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const b = el.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      setEdges((o) => {
        const nx = { l: Math.round(b.left), r: Math.round(vw - b.right), c: Math.round(b.left + b.width / 2) };
        return o && o.l === nx.l && o.r === nx.r && o.c === nx.c ? o : nx;
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [p.view, hasTopics]);

  if (n === 0) {
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

  const showClusters = p.phase !== 'write' && p.clusterCounts.length > 0;

  // The one "⋯" menu: everything that is not the primary action lives here.
  const boardMenu = (q: Question | null) => (
    <Menu
      label="Menu papan"
      className="board-menu"
      trigger={(t) => (
        <button type="button" {...t} className="icon-btn tb-more" aria-label="Menu papan" title="Menu papan">
          <MoreHorizontal size={18} />
        </button>
      )}
    >
      {(close) => {
        const item = (label: React.ReactNode, run: () => void, current?: boolean, key?: string) => (
          <button
            key={key}
            type="button"
            role="menuitem"
            className="menu-item"
            aria-current={current ? 'true' : undefined}
            onClick={() => {
              close();
              run();
            }}
          >
            {label}
          </button>
        );
        return (
          <>
            {inView.length > 0 && item(allOpen ? 'Tutup semua kartu' : 'Buka semua kartu', () => flipAll(!allOpen))}
            {p.phase === 'discuss' && item('Urutkan by vote', p.onSort)}
            {showClusters && (
              <>
                <div className="menu-sep" role="separator" />
                <div className="menu-label">Kelompok</div>
                {item('Semua', () => p.setClusterFilter(''), !p.clusterFilter, '__all')}
                {p.clusterCounts.map((c) =>
                  item(
                    <>
                      <span className="menu-t">{c.tag}</span> <span className="hint num">{c.count}</span>
                    </>,
                    () => p.setClusterFilter(c.tag),
                    p.clusterFilter === c.tag,
                    c.tag,
                  ),
                )}
              </>
            )}
            {(p.prevOpen !== null || (p.phase === 'done' && p.summaryHref && !q)) && <div className="menu-sep" role="separator" />}
            {p.prevOpen !== null && item(`Janji sesi lalu (${p.prevOpen})`, p.onOpenPrev)}
            {p.phase === 'done' && p.summaryHref && !q && (
              <a role="menuitem" className="menu-item" href={p.summaryHref} target="_blank" rel="noopener" onClick={close}>
                Lihat ringkasan
              </a>
            )}
            {p.phase === 'done' && p.isOwner && !q && item('Bagikan ringkasan', p.onShareSummary)}
            {p.isOwner && (p.phase !== 'done' || q) && (
              <>
                <div className="menu-sep" role="separator" />
                <div className="menu-label">Topik</div>
                {p.phase !== 'done' && item('+ Topik', p.onAddTopic)}
                {q && item('Ubah topik', () => p.onEditTopic(q))}
                {q && item('Hapus topik', () => p.onDeleteTopic(q))}
              </>
            )}
            {!p.isMobile && n > 1 && (
              <>
                <div className="menu-sep" role="separator" />
                <div className="menu-label">Tampilan</div>
                {item('Fokus (satu topik)', () => p.setView('focus'), p.view === 'focus')}
                {item('Semua kolom', () => p.setView('columns'), p.view === 'columns')}
              </>
            )}
          </>
        );
      }}
    </Menu>
  );

  const filterChip = p.clusterFilter && (
    <button type="button" className="link-btn tb-filter" onClick={() => p.setClusterFilter('')} title="Tampilkan semua kelompok">
      Kelompok: {p.clusterFilter} <X size={13} aria-hidden="true" />
    </button>
  );

  const renderCards = (slot: { items: Item[] }) => {
    const reveal = seen.reveal;
    const nFlip = reveal ? slot.items.filter((i) => reveal.has(i.id)).length : 0;
    // Whole reveal stays within ~900ms: 500ms flip + at most 400ms of stagger.
    const step = nFlip > 1 ? Math.min(25, 400 / (nFlip - 1)) : 0;
    let flipIdx = 0;
    return (
      <>
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
                  clusters={p.clusterCounts.map((c) => c.tag)}
                  busy={p.busyIds.has(it.id)}
                  flipped={openIds.has(it.id)}
                  onFlip={toggleCard}
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
          <p className="col-empty">
            {p.clusterFilter ? 'Tidak ada kartu di kelompok ini.' : p.phase === 'write' ? `Belum ada kartu. Mulai dengan "Tulis kartu".` : 'Belum ada kartu.'}
          </p>
        )}
      </>
    );
  };

  // ---------- focus view (default): one topic, centred box, big cards, edge arrows + dock ----------
  if (p.view === 'focus' && current) {
    const q = current;
    const slot = byTopic.get(q.id) || { items: [], cards: 0, hidden: 0 };
    const total = q.answer_count ?? slot.cards + slot.hidden;
    const prevQ = idx > 0 ? p.questions[idx - 1] : null;
    const nextQ = idx < n - 1 ? p.questions[idx + 1] : null;
    const navStyle = edges
      ? ({ '--edge-l': `${edges.l}px`, '--edge-r': `${edges.r}px`, '--edge-c': `${edges.c}px` } as React.CSSProperties)
      : undefined;

    return (
      <div className="focus-wrap" ref={wrapRef}>
        <div className="focus">
          <section className="topic-box" aria-labelledby={`tb-h-${q.id}`}>
            <h2 className="tb-title" id={`tb-h-${q.id}`}>
              <span className="tb-text">{q.text}</span>{' '}
              <span className="tb-count num" aria-label={`${total} kartu`} title={`${total} kartu`}>
                ({total})
              </span>
            </h2>
            {q.gif_url && <img className="col-gif tb-gif" src={q.gif_url} alt="" loading="lazy" />}
            <div className="tb-acts">
              {p.phase === 'write' && (
                <button type="button" className="btn primary tb-add" onClick={() => p.onAddCard(q)}>
                  <Plus size={16} aria-hidden="true" /> Tulis kartu
                </button>
              )}
              {p.phase === 'done' && p.summaryHref && (
                <>
                  <a className="btn primary tb-sum" href={p.summaryHref} target="_blank" rel="noopener">
                    Lihat ringkasan
                  </a>
                  {p.isOwner && (
                    <button type="button" className="btn tb-sum" onClick={p.onExport}>
                      Export PDF
                    </button>
                  )}
                  {p.isOwner && (
                    <button type="button" className="btn tb-sum" onClick={p.onShareSummary}>
                      Bagikan ringkasan
                    </button>
                  )}
                </>
              )}
              {p.phase === 'discuss' && (
                <p className="tb-votes" aria-live="polite">
                  Sisa <b className="num">{p.votesLeft}</b> vote{p.budget ? ` dari ${p.budget}` : ''}
                </p>
              )}
              {filterChip}
              {boardMenu(q)}
            </div>
            <p className="tb-hint">{p.hint}</p>
          </section>

          <div className="fgrid">{renderCards(slot)}</div>
        </div>

        {n > 1 && (
          <nav className={`tnav ${edges ? "" : "is-measuring"} ${n > 12 ? "is-many" : ""}`} aria-label="Pindah topik" style={navStyle}>
            <button
              type="button"
              className="edge-btn edge-prev"
              disabled={!prevQ}
              onClick={() => p.setActiveIndex(idx - 1)}
              aria-label={prevQ ? `Topik sebelumnya: ${prevQ.text}` : 'Topik sebelumnya'}
              title={prevQ ? `${prevQ.text} (←)` : undefined}
            >
              <ChevronLeft size={26} strokeWidth={2.75} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="edge-btn edge-next"
              disabled={!nextQ}
              onClick={() => p.setActiveIndex(idx + 1)}
              aria-label={nextQ ? `Topik berikutnya: ${nextQ.text}` : 'Topik berikutnya'}
              title={nextQ ? `${nextQ.text} (→)` : undefined}
            >
              <ChevronRight size={26} strokeWidth={2.75} aria-hidden="true" />
            </button>
            <div className="dock">
              <button type="button" className="dock-arrow" disabled={!prevQ} onClick={() => p.setActiveIndex(idx - 1)} aria-label="Topik sebelumnya">
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <div className="dock-dots">
                {p.questions.map((t, i) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`dock-dot ${i === idx ? 'is-on' : ''}`}
                    aria-label={`Topik ${i + 1}: ${t.text}`}
                    aria-current={i === idx ? 'step' : undefined}
                    title={`${i + 1}. ${t.text}`}
                    onClick={() => p.setActiveIndex(i)}
                  />
                ))}
              </div>
              <span className="dock-pos num" aria-hidden="true">
                {idx + 1}/{n}
              </span>
              <button type="button" className="dock-arrow" disabled={!nextQ} onClick={() => p.setActiveIndex(idx + 1)} aria-label="Topik berikutnya">
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          </nav>
        )}
      </div>
    );
  }

  // ---------- all columns (optional, reached from the "⋯" menu) ----------
  return (
    <>
      <div className="cols-bar">
        <p className="cols-hint">
          {p.hint}
          {p.phase === 'discuss' && (
            <>
              {' '}
              <span className="tb-votes">
                Sisa <b className="num">{p.votesLeft}</b> vote{p.budget ? ` dari ${p.budget}` : ''}
              </span>
            </>
          )}
        </p>
        {filterChip}
        {boardMenu(null)}
      </div>
      <div className="cols" ref={colsRef} style={{ '--cols': Math.min(4, n) } as React.CSSProperties}>
        {p.questions.map((q, i) => {
          const slot = byTopic.get(q.id) || { items: [], cards: 0, hidden: 0 };
          const total = q.answer_count ?? slot.cards + slot.hidden;
          return (
            <section
              key={q.id}
              className={`col ${i === p.activeIndex ? 'is-active' : ''}`}
              aria-labelledby={`col-h-${q.id}`}
              onFocusCapture={() => i !== p.activeIndex && p.setActiveIndex(i)}
              onMouseDown={() => i !== p.activeIndex && p.setActiveIndex(i)}
            >
              <div className="col-h">
                <div className="col-title">
                  <h2 id={`col-h-${q.id}`}>{q.text}</h2>
                  <span className="col-count num">{total} kartu</span>
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
              {p.phase === 'write' && (
                <button type="button" className="btn block add-card" onClick={() => p.onAddCard(q)}>
                  <Plus size={16} aria-hidden="true" /> Tulis kartu
                </button>
              )}
              <div className="col-cards">{renderCards(slot)}</div>
            </section>
          );
        })}
      </div>
    </>
  );
};
