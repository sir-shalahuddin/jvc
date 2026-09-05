import React, { useState } from 'react';
import {
  ThumbsUp,
  Tag,
  Focus,
  RotateCcw,
} from 'lucide-react';
import type { Answer } from '../../types/session';
import { getRetroEmoticonData } from '../../services/sentimentEngine';
import { SoundFX } from '../../services/soundEngine';
import { Confetti } from '../../services/confettiEngine';

interface StickyCardProps {
  answer: Answer;
  isModerator: boolean;
  isSpotlighted: boolean;
  hasVoted: boolean;
  onVote: (answerId: string) => void;
  onSpotlight?: (answerId: string) => void;
  onOpenClusterModal: (answerId: string) => void;
}

export const StickyCard: React.FC<StickyCardProps> = ({
  answer,
  isModerator,
  isSpotlighted,
  hasVoted,
  onVote,
  onSpotlight,
  onOpenClusterModal,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const emoticon = getRetroEmoticonData(
    answer.sentiment_emoji,
    answer.sentiment_emotion,
    answer.id
  );

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent flipping if clicked on buttons or links inside the card
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('input')) {
      return;
    }
    SoundFX.playFlip();
    setIsFlipped(!isFlipped);
  };

  const handleVoteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    SoundFX.playVote();
    Confetti.fire({
      x: e.clientX,
      y: e.clientY,
      particleCount: 25,
      spread: 0.8,
    });
    onVote(answer.id);
  };

  const handleSpotlightClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSpotlight) {
      onSpotlight(answer.id);
    }
  };

  const handleClusterClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenClusterModal(answer.id);
  };

  return (
    <div
      className={`tactile-card-wrapper ${isFlipped ? 'flipped' : ''} ${
        isSpotlighted ? 'spotlight-active' : ''
      }`}
      onClick={handleCardClick}
      data-id={answer.id}
      id={`card-${answer.id}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          SoundFX.playFlip();
          setIsFlipped(!isFlipped);
        }
      }}
      title="Click or press Space to flip reflection card"
    >
      <div className="tactile-card-inner">
        {/* Front Face: Mystery Kaomoji & Sentiment */}
        <div className="tactile-card-front">
          <div className="card-kaomoji-face" style={{ color: emoticon.color }}>
            {emoticon.text}
          </div>

          <span
            className="card-emotion-label"
            style={{
              backgroundColor: `${emoticon.color}15`,
              color: emoticon.color,
              border: `1px solid ${emoticon.color}35`,
            }}
          >
            {answer.sentiment_emotion || emoticon.type}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'auto' }}>
            <span
              className="badge"
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                background: answer.votes > 0 ? 'var(--primary-light)' : 'var(--bg-subtle)',
                color: answer.votes > 0 ? 'var(--primary)' : 'var(--text-muted)',
              }}
            >
              👍 {answer.votes} Votes
            </span>
            <span className="card-reveal-hint">Flip to reveal ↵</span>
          </div>
        </div>

        {/* Back Face: Content & Reaction Media */}
        <div className="tactile-card-back">
          <div className="card-back-header">
            <span className="card-author-alias">
              <span>🎭</span>
              <span>{answer.author_name || 'Anonymous Guest'}</span>
            </span>

            {answer.cluster_tag && (
              <span
                className="badge badge-primary"
                style={{ cursor: 'pointer', fontSize: '0.7rem' }}
                onClick={handleClusterClick}
                title="Thematic cluster tag"
              >
                #{answer.cluster_tag}
              </span>
            )}
          </div>

          {/* Formatted Text Content */}
          <div
            className="card-content-body"
            dangerouslySetInnerHTML={{ __html: answer.text }}
          />

          {/* Attached Reaction GIF / Meme */}
          {answer.gif_url && (
            <img
              src={answer.gif_url}
              alt="Reaction media"
              className="card-attached-media"
              loading="lazy"
            />
          )}

          {/* Action Toolbar */}
          <div className="card-back-footer">
            <button
              type="button"
              className={`card-vote-btn ${hasVoted ? 'voted' : ''}`}
              onClick={handleVoteClick}
              title={hasVoted ? 'Retract vote' : 'Vote for this reflection'}
            >
              <ThumbsUp size={13} fill={hasVoted ? 'currentColor' : 'none'} />
              <span>{answer.votes}</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding: '4px', color: 'var(--text-muted)' }}
                onClick={handleClusterClick}
                title="Tag / group this card"
              >
                <Tag size={13} />
              </button>

              {isModerator && (
                <button
                  type="button"
                  className={`btn btn-ghost btn-sm ${isSpotlighted ? 'btn-primary' : ''}`}
                  style={{ padding: '4px' }}
                  onClick={handleSpotlightClick}
                  title="Spotlight this reflection for everyone"
                >
                  <Focus size={13} />
                </button>
              )}

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding: '4px', color: 'var(--text-muted)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  SoundFX.playFlip();
                  setIsFlipped(false);
                }}
                title="Flip back"
              >
                <RotateCcw size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
