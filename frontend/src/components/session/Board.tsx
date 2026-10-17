import React, { useEffect, useMemo, useRef } from 'react';
import { MoreHorizontal, Plus } from 'lucide-react';
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

interface Props extends BoardHandlers {
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
  spotlightId: string;
  busyIds: Set<string>;
}

function sortCards(list: Answer[], phase: Phase): Answer[] {
  const t = (a: Answer) => new Date(a.created_at || 0).getTime() || 0;
  const out = [...list];
  if (phase === 'group') {
    out.sort((a, b) => (a.cluster_tag || '￿').localeCompare(b.cluster_tag || '￿') || t(a) - t(b));
  } else if (phase === 'discuss' || phase === 'act' || phase === 'done') {
    out.sort((a, b) => (b.votes || 0) - (a.votes || 0) || t(a) - t(b));
  } else {
    out.sort((a, b) => t(a) - t(b));
  }
  return out;
}

export const Board: React.FC<Props> = (p) => {
  const colsRef = useRef<HTMLDivElement>(null);

  const byTopic = useMemo(() => {
    const m = new Map<string, { cards: Answer[]; hidden: number }>();
    for (const q of p.questions) m.set(q.id, { cards: [], hidden: 0 });
    for (const a of p.answers) {
      const slot = m.get(a.question_id);
      if (!slot) continue;
      if (isHidden(a)) slot.hidden++;
      else slot.cards.push(a);
    }
    for (const slot of m.values()) {
      let cards = slot.cards;
      if (p.clusterFilter) cards = cards.filter((c) => (c.cluster_tag || '') === p.clusterFilter);
      slot.cards = sortCards(cards, p.phase);
    }
    return m;
  }, [p.questions, p.answers, p.phase, p.clusterFilter]);

  // Keyboard topic changes on desktop: bring that column into view.
  useEffect(() => {
    if (p.isMobile) return;
    // Scroll the column strip only (never the page).
    const c = colsRef.current;
    const el = c?.children[p.activeIndex] as HTMLElement | undefined;
    if (!c || !el || c.scrollWidth <= c.clientWidth) return;
    const left = el.getBoundingClientRect().left - c.getBoundingClientRect().left + c.scrollLeft;
    if (left < c.scrollLeft || left + el.offsetWidth > c.scrollLeft + c.clientWidth) {
      c.scrollTo({ left: Math.max(0, left - 8), behavior: 'smooth' });
    }
  }, [p.activeIndex, p.isMobile]);

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

  const renderColumn = (q: Question, idx: number) => {
    const slot = byTopic.get(q.id) || { cards: [], hidden: 0 };
    const total = q.answer_count ?? slot.cards.length + slot.hidden;
    return (
      <section
        key={q.id}
        className={`col ${idx === p.activeIndex ? 'is-active' : ''}`}
        aria-labelledby={`col-h-${q.id}`}
        onFocusCapture={() => idx !== p.activeIndex && p.setActiveIndex(idx)}
        onMouseDown={() => idx !== p.activeIndex && p.setActiveIndex(idx)}
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

        <div className="col-cards">
          {slot.cards.map((a) => (
            <CardItem
              key={a.id}
              answer={a}
              phase={p.phase}
              isOwner={p.isOwner}
              isMine={p.phase === 'write' || (!!p.myVoterId && a.author_id === p.myVoterId)}
              spotlighted={p.spotlightId === a.id}
              voted={p.votedIds.has(a.id)}
              votesLeft={p.votesLeft}
              clusters={p.clusters}
              busy={p.busyIds.has(a.id)}
              onVote={p.onVote}
              onSetCluster={p.onSetCluster}
              onSpotlight={p.onSpotlight}
              onMakeAction={p.onMakeAction}
            />
          ))}
          {slot.hidden > 0 && <p className="hidden-line">{slot.hidden} kartu dari orang lain, dibuka di fase berikutnya</p>}
          {slot.cards.length === 0 && slot.hidden === 0 && (
            <p className="col-empty">{p.clusterFilter ? 'Tidak ada kartu di kelompok ini.' : 'Belum ada kartu.'}</p>
          )}
        </div>
      </section>
    );
  };

  if (p.isMobile) {
    const idx = Math.min(p.activeIndex, p.questions.length - 1);
    const q = p.questions[idx];
    return (
      <div className="board-m">
        <div className="tabs" role="tablist" aria-label="Topik">
          {p.questions.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={i === idx}
              className="tab"
              onClick={() => p.setActiveIndex(i)}
            >
              <span className="tab-name">{t.text}</span>
              <span className="tab-n num">{t.answer_count ?? 0}</span>
            </button>
          ))}
        </div>
        <div role="tabpanel">{renderColumn(q, idx)}</div>
      </div>
    );
  }

  return (
    <>
      {p.questions.length > 4 && (
        <p className="cols-hint">{p.questions.length} topik. Geser ke samping atau pakai ← → untuk melihat semuanya.</p>
      )}
      <div className="cols" ref={colsRef} style={{ '--cols': Math.min(4, p.questions.length) } as React.CSSProperties}>
        {p.questions.map(renderColumn)}
      </div>
    </>
  );
};
