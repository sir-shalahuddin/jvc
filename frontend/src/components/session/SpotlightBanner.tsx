import React from 'react';
import { Target, X } from 'lucide-react';
import type { SpotlightState } from '../../types/session';

interface SpotlightBannerProps {
  spotlight: SpotlightState;
  isModerator: boolean;
  onJumpToFocus: () => void;
  onClearSpotlight: () => void;
}

export const SpotlightBanner: React.FC<SpotlightBannerProps> = ({
  spotlight,
  isModerator,
  onJumpToFocus,
  onClearSpotlight,
}) => {
  if (!spotlight.active) return null;

  const isCard = !!spotlight.answer_id;

  return (
    <aside className="spotlight-banner" role="region" aria-label="Facilitator Spotlight Broadcast">
      <div className="spotlight-banner-left">
        <span className="spotlight-badge">
          <span className="pulse-dot" style={{ width: '6px', height: '6px', background: '#fff' }} />
          LIVE FOCUS
        </span>
        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {isCard
            ? 'Facilitator is highlighting a specific reflection card'
            : 'Facilitator focused on the current topic'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <button
          onClick={onJumpToFocus}
          className="btn btn-primary btn-sm"
          style={{ padding: '0.35rem 0.85rem' }}
          title="Scroll directly to focused reflection card"
        >
          <Target size={14} />
          <span>Jump to Focus (F)</span>
        </button>

        {isModerator && (
          <button
            onClick={onClearSpotlight}
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--danger)', padding: '0.35rem 0.6rem' }}
            title="Clear focus for all participants"
          >
            <X size={14} />
            <span>Clear</span>
          </button>
        )}
      </div>
    </aside>
  );
};
