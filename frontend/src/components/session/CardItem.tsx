import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, MoreHorizontal } from 'lucide-react';
import type { Answer, Phase } from '../../types/session';
import { sanitizeCardHtml } from '../../lib/cardHtml';
import { moodOf } from '../../lib/mood';
import { Menu } from '../common/Menu';

interface Props {
  answer: Answer;
  phase: Phase;
  isOwner: boolean;
  isMine: boolean;
  spotlighted: boolean;
  voted: boolean;
  votesLeft: number;
  clusters: string[];
  busy: boolean;
  /** Back (text) side showing. Owned by the board so it survives topic switches. */
  flipped: boolean;
  onFlip: (id: string) => void;
  onVote: (a: Answer) => void;
  onSetCluster: (a: Answer, tag: string) => Promise<boolean>;
  onSpotlight: (a: Answer) => void;
  onMakeAction: (a: Answer) => void;
}

// Vote counts are visible from discuss on (voting and discussing happen together).
const SHOW_VOTES: Phase[] = ['discuss', 'done'];

// Clicks on these never flip the card.
const INTERACTIVE = 'button, a, input, textarea, select, label, form, .menu';

/**
 * Two-sided card. Front: kaomoji + mood label (no text). Back: author, formatted text, GIF,
 * controls. Click or Enter/Space flips it; prefers-reduced-motion swaps instantly (CSS).
 */
export const CardItem: React.FC<Props> = ({
  answer,
  phase,
  isOwner,
  isMine,
  spotlighted,
  voted,
  votesLeft,
  clusters,
  busy,
  flipped,
  onFlip,
  onVote,
  onSetCluster,
  onSpotlight,
  onMakeAction,
}) => {
  const [editingTag, setEditingTag] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const listId = useId();
  const html = useMemo(() => sanitizeCardHtml(answer.text), [answer.text]);
  const mood = useMemo(() => moodOf(answer), [answer]);
  const tag = answer.cluster_tag || '';
  const canTag = isOwner && phase === 'discuss';
  const showVotes = SHOW_VOTES.includes(phase);
  const author = isMine ? 'Kamu' : answer.author_name || 'Anonim';

  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLElement>(null);
  // Keyboard flips move focus to the side that is now showing (the other side becomes inert).
  const moveFocus = useRef(false);
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    (flipped ? backRef.current : frontRef.current)?.focus({ preventScroll: true });
  }, [flipped]);
  useEffect(() => {
    if (!flipped) setEditingTag(false);
  }, [flipped]);

  const flip = () => onFlip(answer.id);

  const onClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest(INTERACTIVE)) return;
    // Selecting text on the back (to copy it) should not flip the card.
    const sel = window.getSelection();
    if (flipped && sel && sel.toString().trim()) return;
    flip();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.target !== e.currentTarget) return; // a button inside the card handles its own keys
    e.preventDefault();
    moveFocus.current = true;
    flip();
  };

  const saveTag = async () => {
    const next = tagDraft.trim();
    if (next === tag) {
      setEditingTag(false);
      return;
    }
    const ok = await onSetCluster(answer, next);
    if (ok) setEditingTag(false);
  };

  const moodStyle = {
    ...(mood.light ? { '--mood-l': mood.light } : {}),
    ...(mood.dark ? { '--mood-d': mood.dark } : {}),
  } as React.CSSProperties;

  const voteChip = showVotes && (
    <span className={`fc-votes num ${voted ? 'is-voted' : ''}`} title={`${answer.votes || 0} vote`}>
      ▲ {answer.votes || 0}
    </span>
  );

  const ownerMenu = phase === 'discuss' && isOwner && (
    <Menu
      label="Atur kartu"
      className="fc-menu"
      trigger={(t) => (
        <button type="button" {...t} className="icon-btn fc-more" aria-label="Atur kartu" title="Atur kartu" disabled={busy}>
          <MoreHorizontal size={16} />
        </button>
      )}
    >
      {(close) => (
        <>
          <button type="button" role="menuitem" className="menu-item" onClick={() => (close(), onSpotlight(answer))}>
            {spotlighted ? 'Lepas sorotan' : 'Sorot'}
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => {
              close();
              setTagDraft(tag);
              setEditingTag(true);
            }}
          >
            Kelompok{tag ? <span className="hint">{tag}</span> : null}
          </button>
          <button type="button" role="menuitem" className="menu-item" onClick={() => (close(), onMakeAction(answer))}>
            Jadikan aksi
          </button>
        </>
      )}
    </Menu>
  );

  const tagForm = canTag && editingTag && (
    <form
      className="tag-edit"
      onSubmit={(e) => {
        e.preventDefault();
        void saveTag();
      }}
    >
      <input
        className="inp sm"
        value={tagDraft}
        onChange={(e) => setTagDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            setEditingTag(false);
          }
        }}
        list={listId}
        placeholder="Nama kelompok"
        aria-label="Nama kelompok"
        maxLength={40}
        autoFocus
        disabled={busy}
      />
      <datalist id={listId}>
        {clusters.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <button type="submit" className="link-btn" disabled={busy}>
        Simpan
      </button>
      <button type="button" className="link-btn muted-link" onClick={() => setEditingTag(false)}>
        Batal
      </button>
    </form>
  );

  const moodText = mood.pending ? 'suasana belum terbaca' : mood.label;

  return (
    <div
      id={`card-${answer.id}`}
      className={`fc ${flipped ? 'is-flipped' : ''} ${spotlighted ? 'is-spot' : ''} ${mood.light ? 'has-mood' : ''} ${isMine && phase === 'write' ? 'is-mine' : ''}`}
      style={moodStyle}
      onClick={onClick}
    >
      <div className="fc-inner">
        <div
          ref={frontRef}
          className="fc-face fc-front"
          role="button"
          tabIndex={flipped ? -1 : 0}
          aria-hidden={flipped || undefined}
          inert={flipped}
          aria-label={`Kartu ${isMine ? 'kamu' : `dari ${author}`}, suasana: ${moodText}${spotlighted ? ', sedang dibahas' : ''}. Tekan Enter untuk membuka.`}
          onKeyDown={onKey}
          data-face={flipped ? undefined : 'on'}
        >
          {(tag || spotlighted) && (
            <div className="fc-front-top">
              {spotlighted && <span className="fc-spot-k">Dibahas</span>}
              {tag && <span className="fc-tag"># {tag}</span>}
            </div>
          )}
          <div className={`fc-kao ${mood.pending ? 'is-pending' : ''}`} aria-hidden="true">
            {mood.kaomoji}
          </div>
          <div className={`fc-mood ${mood.pending ? 'is-pending' : ''}`} aria-hidden="true" title={mood.pending ? 'Suasana kartu belum terbaca' : 'Perkiraan suasana kartu'}>
            {mood.label}
          </div>
          {voteChip && <div className="fc-front-foot">{voteChip}</div>}
        </div>

        <article
          ref={backRef}
          className="fc-face fc-back"
          tabIndex={flipped ? 0 : -1}
          aria-hidden={!flipped || undefined}
          inert={!flipped}
          aria-label={`Kartu ${isMine ? 'kamu' : `dari ${author}`}. Tekan Enter untuk menutup.`}
          onKeyDown={onKey}
          data-face={flipped ? 'on' : undefined}
        >
          <header className="fc-back-h">
            <div className="fc-who">
              <span className="fc-author">{author}</span>
              {tag && !editingTag && <span className="fc-tag"># {tag}</span>}
            </div>
            <div className="fc-side">
              <span className="fc-back-kao" aria-hidden="true" title={mood.label}>
                {mood.kaomoji}
              </span>
              {ownerMenu}
            </div>
          </header>
          {tagForm}
          <div className="card-text" dangerouslySetInnerHTML={{ __html: html }} />
          {answer.gif_url && <img className="card-gif" src={answer.gif_url} alt="" loading="lazy" />}
          {(showVotes || phase === 'discuss') && (
            <footer className="fc-back-f">
              {voteChip}
              {phase === 'discuss' &&
                (voted ? (
                  <span className="voted">
                    <Check size={14} aria-hidden="true" /> Divote
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => onVote(answer)}
                    disabled={busy || votesLeft <= 0}
                    title={votesLeft <= 0 ? 'Vote kamu sudah habis' : 'Beri satu vote'}
                  >
                    Vote
                  </button>
                ))}
            </footer>
          )}
        </article>
      </div>
    </div>
  );
};
