import React, { useState } from 'react';
import {
  Tag,
  Focus,
  RotateCcw,
  CheckSquare,
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
  onConvertToAction?: (answer: Answer) => void;
}

export const StickyCard: React.FC<StickyCardProps> = ({
  answer,
  isModerator,
  isSpotlighted,
  hasVoted,
  onVote,
  onSpotlight,
  onOpenClusterModal,
  onConvertToAction,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const emoticon = getRetroEmoticonData(
    answer.sentiment_emoji,
    answer.sentiment_emotion,
    answer.id
  );

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent flipping if clicked on buttons, links, inputs, or badges
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('input') ||
      target.closest('.card-cluster-badge') ||
      target.closest('.card-vote-btn') ||
      target.closest('.back-cluster-pill') ||
      target.closest('.card-action-btn')
    ) {
      return;
    }
    SoundFX.playFlip();
    setIsFlipped((prev) => !prev);
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

  return (
    <div
      className={`answer-card ${isFlipped ? 'flipped' : ''} ${
        isSpotlighted ? 'spotlight-active' : ''
      }`}
      onClick={handleCardClick}
      data-id={answer.id}
      id={`card-${answer.id}`}
      tabIndex={0}
      role="button"
      aria-label={`Reflection card by ${answer.author_name || 'Anonymous'}. Click to flip.`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          SoundFX.playFlip();
          setIsFlipped((prev) => !prev);
        }
      }}
      title="Click or press Space to flip reflection card"
    >
      {/* Front Face: Kaomoji and Mystery Sentiment */}
      <div className="card-face card-front">
        {answer.votes >= 5 && (
          <div className="top-voted-badge">🔥 TOP VOTED</div>
        )}

        {answer.cluster_tag && (
          <div
            className="card-cluster-badge"
            onClick={(e) => {
              e.stopPropagation();
              onOpenClusterModal(answer.id);
            }}
            title="Cluster tag"
          >
            🏷️ #{answer.cluster_tag}
          </div>
        )}

        <div className={`emoji-main emot-${emoticon.type}`} style={{ color: emoticon.color }}>
          {emoticon.text}
        </div>

        <div className="emoji-sub">
          {answer.sentiment_emotion || emoticon.type}
        </div>

        <div className="card-front-bottom">
          <span className="card-reveal-hint">Flip to reveal ↵</span>
          <button
            type="button"
            className={`card-vote-btn ${hasVoted ? 'has-voted' : ''}`}
            onClick={handleVoteClick}
            title={hasVoted ? 'Retract vote' : 'Vote for this reflection'}
          >
            ▲ <span>{answer.votes}</span>
          </button>
        </div>
      </div>

      {/* Back Face: Revealed Content and Actions */}
      <div className="card-face card-back">
        <div className="card-back-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span className="card-author-alias">
              🎭 {answer.author_name || 'Anonymous'}
            </span>
            {answer.cluster_tag && (
              <span
                className="back-cluster-pill"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenClusterModal(answer.id);
                }}
                title="Edit cluster tag"
              >
                🏷️ #{answer.cluster_tag}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              className={`card-vote-btn ${hasVoted ? 'has-voted' : ''}`}
              onClick={handleVoteClick}
              title={hasVoted ? 'Retract vote' : 'Vote for this reflection'}
            >
              ▲ <span>{answer.votes}</span>
            </button>
            <span className="back-emot-pill" style={{ color: emoticon.color }}>
              {emoticon.text}
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div
          className="card-content-body"
          dangerouslySetInnerHTML={{ __html: answer.text }}
          onClick={(e) => e.stopPropagation()}
        />

        {/* Attached Reaction GIF / Image */}
        {answer.gif_url && (
          <div className="card-media-wrapper">
            <img
              src={answer.gif_url}
              alt="Reaction media"
              className="card-attached-media"
              loading="lazy"
            />
          </div>
        )}

        {/* Back Footer Action Toolbar */}
        <div className="card-back-footer" onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            {onConvertToAction && (
              <button
                type="button"
                className="btn btn-secondary btn-sm card-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onConvertToAction(answer);
                }}
                title="Turn this reflection into a commitment/action item"
              >
                <CheckSquare size={13} />
                <span>Action</span>
              </button>
            )}

            <button
              type="button"
              className="btn btn-secondary btn-sm card-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                onOpenClusterModal(answer.id);
              }}
              title="Tag / group this card"
            >
              <Tag size={13} />
              <span>Tag</span>
            </button>

            {isModerator && (
              <button
                type="button"
                className={`btn btn-secondary btn-sm card-action-btn ${
                  isSpotlighted ? 'active-spotlight' : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSpotlight) onSpotlight(answer.id);
                }}
                title="Spotlight focus this card for all participants"
              >
                <Focus size={13} />
                <span>Focus</span>
              </button>
            )}
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm card-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              SoundFX.playFlip();
              setIsFlipped(false);
            }}
            title="Flip back to front"
          >
            <RotateCcw size={13} />
            <span>Flip</span>
          </button>
        </div>
      </div>
    </div>
  );
};
