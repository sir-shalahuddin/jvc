import React, { useId, useState } from 'react';
import { Check } from 'lucide-react';
import type { Answer, Phase } from '../../types/session';

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
  onVote: (a: Answer) => void;
  onSetCluster: (a: Answer, tag: string) => Promise<boolean>;
  onSpotlight: (a: Answer) => void;
  onMakeAction: (a: Answer) => void;
}

// Vote counts are visible from discuss on (voting and discussing happen together).
const SHOW_VOTES: Phase[] = ['discuss', 'done'];

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
  onVote,
  onSetCluster,
  onSpotlight,
  onMakeAction,
}) => {
  const [editingTag, setEditingTag] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const listId = useId();
  const tag = answer.cluster_tag || '';
  const sentiment = (answer.sentiment_emotion || '').trim().toLowerCase();
  const canTag = isOwner && phase === 'discuss';

  const saveTag = async () => {
    const next = tagDraft.trim();
    if (next === tag) {
      setEditingTag(false);
      return;
    }
    const ok = await onSetCluster(answer, next);
    if (ok) setEditingTag(false);
  };

  let tagNode: React.ReactNode = null;
  if (canTag && editingTag) {
    tagNode = (
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
  } else if (canTag) {
    tagNode = (
      <button
        type="button"
        className={`tag-btn ${tag ? '' : 'qa'}`}
        onClick={() => {
          setTagDraft(tag);
          setEditingTag(true);
        }}
        title="Atur kelompok"
      >
        {tag ? `# ${tag}` : '+ kelompok'}
      </button>
    );
  } else if (tag && phase !== 'write') {
    tagNode = <span className="tag"># {tag}</span>;
  }

  const showTop = tagNode || sentiment;

  return (
    <article
      id={`card-${answer.id}`}
      className={`card ${spotlighted ? 'is-spot' : ''} ${isMine && phase === 'write' ? 'is-mine' : ''}`}
      aria-label={spotlighted ? 'Kartu yang sedang dibahas' : undefined}
    >
      {showTop && (
        <div className="card-top">
          <div className="card-tag">{tagNode}</div>
          {sentiment && (
            <span className="card-sent" title="Perkiraan suasana kartu">
              {sentiment}
            </span>
          )}
        </div>
      )}
      <div className="card-text" dangerouslySetInnerHTML={{ __html: answer.text }} />
      {answer.gif_url && <img className="card-gif" src={answer.gif_url} alt="" loading="lazy" />}
      <div className="card-foot">
        <span className="card-meta">
          {isMine ? 'Kamu' : answer.author_name || 'Anonim'}
          {SHOW_VOTES.includes(phase) && (
            <>
              {' · '}
              <b className="num">{answer.votes || 0}</b> vote
            </>
          )}
        </span>
        <span className="card-acts">
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
        </span>
        {phase === 'discuss' && isOwner && (
          <span className="card-qa">
            <button type="button" className={`link-btn ${spotlighted ? '' : 'qa'}`} onClick={() => onSpotlight(answer)} disabled={busy}>
              {spotlighted ? 'Lepas sorotan' : 'Sorot'}
            </button>
            <button type="button" className="link-btn qa" onClick={() => onMakeAction(answer)}>
              Jadikan aksi
            </button>
          </span>
        )}
      </div>
    </article>
  );
};
