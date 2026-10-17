import React from 'react';
import type { Answer, Question } from '../../types/session';

interface Props {
  card: Answer | null;
  topic: Question | null;
  isOwner: boolean;
  onJump: () => void;
  onClear: () => void;
}

function plain(html: string) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return (d.textContent || '').trim();
}

// Quiet banner with the card the facilitator is discussing.
export const SpotlightBanner: React.FC<Props> = ({ card, topic, isOwner, onJump, onClear }) => {
  if (!card) return null;
  return (
    <section className="spot" aria-live="polite" aria-label="Kartu yang sedang dibahas">
      <div className="spot-body">
        <span className="spot-k">Sedang dibahas{topic ? ` · ${topic.text}` : ''}</span>
        <p className="spot-text">{plain(card.text) || '(kartu tanpa teks)'}</p>
      </div>
      <div className="spot-acts">
        <button type="button" className="link-btn" onClick={onJump}>
          Lihat kartu
        </button>
        {isOwner && (
          <button type="button" className="link-btn" onClick={onClear}>
            Lepas sorotan
          </button>
        )}
      </div>
    </section>
  );
};
