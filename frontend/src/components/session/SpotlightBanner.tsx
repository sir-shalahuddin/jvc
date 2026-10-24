import React from 'react';
import { cardPlainText } from '../../lib/cardHtml';
import type { Answer, Question } from '../../types/session';

interface Props {
  card: Answer | null;
  topic: Question | null;
  isOwner: boolean;
  onJump: () => void;
  onClear: () => void;
}

// One slim line: "Sedang dibahas: <text>   Lihat · Lepas".
export const SpotlightBanner: React.FC<Props> = ({ card, topic, isOwner, onJump, onClear }) => {
  if (!card) return null;
  const text = cardPlainText(card.text) || '(kartu tanpa teks)';
  return (
    <section className="spot" aria-live="polite" aria-label="Kartu yang sedang dibahas">
      <p className="spot-line" title={topic ? `${topic.text}: ${text}` : text}>
        <span className="spot-k">Sedang dibahas:</span> <span className="spot-text">{text}</span>
      </p>
      <div className="spot-acts">
        <button type="button" className="link-btn" onClick={onJump} title="Lihat kartu yang sedang dibahas (F)">
          Lihat
        </button>
        {isOwner && (
          <button type="button" className="link-btn" onClick={onClear} title="Lepas sorotan">
            Lepas
          </button>
        )}
      </div>
    </section>
  );
};
