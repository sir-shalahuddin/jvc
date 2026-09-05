import React from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { Question } from '../../types/session';

interface TopicNavigationProps {
  questions: Question[];
  activeIndex: number;
  onSelectTopic: (index: number) => void;
  isModerator: boolean;
  onAddNewTopic: () => void;
}

export const TopicNavigation: React.FC<TopicNavigationProps> = ({
  questions,
  activeIndex,
  onSelectTopic,
  isModerator,
  onAddNewTopic,
}) => {
  if (questions.length === 0) return null;

  const handlePrev = () => {
    if (activeIndex > 0) {
      onSelectTopic(activeIndex - 1);
    }
  };

  const handleNext = () => {
    if (activeIndex < questions.length - 1) {
      onSelectTopic(activeIndex + 1);
    }
  };

  return (
    <nav
      className="topic-dock-wrapper"
      role="navigation"
      aria-label="Topic Navigation"
    >
      <button
        onClick={handlePrev}
        disabled={activeIndex === 0}
        className="dock-arrow-btn"
        aria-label="Previous topic (Arrow Left)"
        title="Previous topic (←)"
        style={{ opacity: activeIndex === 0 ? 0.35 : 1, cursor: activeIndex === 0 ? 'not-allowed' : 'pointer' }}
      >
        <ChevronLeft size={18} />
      </button>

      {/* Desktop Dots Indicator */}
      <div className="dock-dots-container">
        {questions.map((q, idx) => (
          <button
            key={q.id || idx}
            onClick={() => onSelectTopic(idx)}
            className={`dock-dot ${idx === activeIndex ? 'active' : ''}`}
            title={`Topic ${idx + 1}: ${q.text.substring(0, 30)}...`}
            aria-label={`Go to topic ${idx + 1}`}
          />
        ))}
      </div>

      {/* Mobile Stepper Counter (Replaces overcrowded dots on small screens) */}
      <div className="dock-mobile-counter">
        <span className="dock-mobile-step">
          Topic {activeIndex + 1}/{questions.length}
        </span>
      </div>

      <button
        onClick={handleNext}
        disabled={activeIndex >= questions.length - 1}
        className="dock-arrow-btn"
        aria-label="Next topic (Arrow Right)"
        title="Next topic (→)"
        style={{
          opacity: activeIndex >= questions.length - 1 ? 0.35 : 1,
          cursor: activeIndex >= questions.length - 1 ? 'not-allowed' : 'pointer',
        }}
      >
        <ChevronRight size={18} />
      </button>

      {isModerator && (
        <button
          onClick={onAddNewTopic}
          className="dock-arrow-btn"
          aria-label="Add new retrospective topic"
          title="Add new topic"
          style={{
            marginLeft: '0.4rem',
            background: 'var(--primary-light)',
            color: 'var(--primary)',
          }}
        >
          <Plus size={16} />
        </button>
      )}
    </nav>
  );
};
