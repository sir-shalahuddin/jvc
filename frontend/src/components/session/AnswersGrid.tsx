import React from 'react';
import { Sparkles, Plus } from 'lucide-react';
import type { Answer } from '../../types/session';
import { StickyCard } from './StickyCard';

interface AnswersGridProps {
  answers: Answer[];
  isModerator: boolean;
  spotlightedAnswerId?: string;
  votedAnswerIds: Set<string>;
  onVote: (answerId: string) => void;
  onSpotlight?: (answerId: string) => void;
  onOpenClusterModal: (answerId: string) => void;
  onOpenSubmitModal: () => void;
}

export const AnswersGrid: React.FC<AnswersGridProps> = ({
  answers,
  isModerator,
  spotlightedAnswerId,
  votedAnswerIds,
  onVote,
  onSpotlight,
  onOpenClusterModal,
  onOpenSubmitModal,
}) => {
  if (answers.length === 0) {
    return (
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '600px',
          margin: '3rem auto',
          textAlign: 'center',
          padding: '3rem 2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
          border: '2px dashed var(--border-card)',
          background: 'var(--bg-subtle)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--primary-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary)',
          }}
        >
          <Sparkles size={32} />
        </div>

        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.35rem' }}>
            No reflection cards yet
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px' }}>
            Be the first to share your honest thoughts, feedback, and celebration points for this sprint.
          </p>
        </div>

        <button
          onClick={onOpenSubmitModal}
          className="btn btn-primary"
          style={{ marginTop: '0.5rem' }}
        >
          <Plus size={16} />
          <span>Post First Reflection (C)</span>
        </button>
      </div>
    );
  }

  return (
    <section
      className="answers-grid-container"
      aria-label="Reflections Board Cards"
    >
      {answers.map((answer) => (
        <StickyCard
          key={answer.id}
          answer={answer}
          isModerator={isModerator}
          isSpotlighted={spotlightedAnswerId === answer.id}
          hasVoted={votedAnswerIds.has(answer.id)}
          onVote={onVote}
          onSpotlight={onSpotlight}
          onOpenClusterModal={onOpenClusterModal}
        />
      ))}
    </section>
  );
};
