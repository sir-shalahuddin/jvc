import React, { useState, useEffect, useRef } from 'react';
import type { Answer } from '../../types/session';
import { getRetroEmoticonData } from '../../services/sentimentEngine';
import { SoundFX } from '../../services/soundEngine';
import { Confetti } from '../../services/confettiEngine';

interface StickyCardProps {
  answer: Answer;
  isModerator: boolean;
  isSpotlighted: boolean;
  isTopVoted?: boolean;
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
  isTopVoted = false,
  hasVoted,
  onVote,
  onSpotlight,
  onOpenClusterModal,
  onConvertToAction,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const emoticon = getRetroEmoticonData(
    answer.sentiment_emoji,
    answer.sentiment_emotion,
    answer.id
  );

  const moodColor = emoticon.color || answer.sentiment_color || 'var(--border-card)';

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('click', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [isDropdownOpen]);

  const handleCardClick = (e: React.MouseEvent) => {
    // If text was selected (e.g. copying reflection text), do not flip
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      return;
    }

    // Prevent flipping if clicked on buttons, links, inputs, or badges
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('.card-cluster-badge') ||
      target.closest('.card-vote-btn') ||
      target.closest('.back-cluster-pill') ||
      target.closest('.card-actions-dropdown')
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
          const target = e.target as HTMLElement;
          if (target.tagName === 'BUTTON' || target.tagName === 'A' || target.tagName === 'INPUT') {
            return;
          }
          e.preventDefault();
          SoundFX.playFlip();
          setIsFlipped((prev) => !prev);
        }
      }}
      title="Click or press Space to flip reflection card"
      style={{ '--mood-color': moodColor } as React.CSSProperties}
    >
      {/* Front Face: Kaomoji and Sentiment */}
      <div className="card-face card-front">
        {isTopVoted && (
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

        {answer.sentiment_color === '#ef4444' && (
          <div className="warning-overlay">
            <span>⚠️ Critical</span>
          </div>
        )}

        <div className={`emoji-main emot-${emoticon.type}`} style={{ color: emoticon.color }}>
          {emoticon.text}
        </div>

        <div className="emoji-sub">
          {answer.sentiment_emotion || emoticon.type}
        </div>

        <div style={{ position: 'absolute', bottom: '1rem', right: '1rem' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span className="card-author-alias">
              🎭 {answer.author_name || 'Anonymous'}
            </span>
            {isTopVoted && <span className="top-voted-pill">🔥 Top</span>}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
            <div
              style={{
                background: moodColor,
                width: '10px',
                height: '10px',
                border: '1.5px solid var(--border-card)',
              }}
            />
          </div>
        </div>

        {/* Content Body */}
        <div
          className="card-content-body"
          dangerouslySetInnerHTML={{ __html: answer.text }}
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

        {/* Back Actions Dropdown */}
        <div className="card-actions-dropdown" ref={dropdownRef}>
          <button
            type="button"
            className={`card-dropdown-toggle ${isDropdownOpen ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsDropdownOpen((prev) => !prev);
            }}
            title="Actions menu"
          >
            <span>⚡ Actions</span> <span className="dropdown-arrow">{isDropdownOpen ? '▴' : '▾'}</span>
          </button>

          {isDropdownOpen && (
            <div className="card-dropdown-menu show" onClick={(e) => e.stopPropagation()}>
              {onConvertToAction && (
                <button
                  type="button"
                  className="card-dropdown-item"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onConvertToAction(answer);
                  }}
                  title="Turn this reflection into an action item"
                >
                  <span>⚡ Action Item</span>
                </button>
              )}

              <button
                type="button"
                className="card-dropdown-item"
                onClick={() => {
                  setIsDropdownOpen(false);
                  onOpenClusterModal(answer.id);
                }}
                title="Categorize or cluster this reflection"
              >
                <span>🏷️ {answer.cluster_tag ? `#${answer.cluster_tag}` : 'Cluster'}</span>
              </button>

              {isModerator && onSpotlight && (
                <button
                  type="button"
                  className={`card-dropdown-item ${isSpotlighted ? 'active' : ''}`}
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onSpotlight(answer.id);
                  }}
                  title={isSpotlighted ? 'Remove spotlight focus' : 'Spotlight focus this card for all participants'}
                >
                  <span>{isSpotlighted ? '🔦 Remove Focus' : '🔦 Spotlight Focus'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

