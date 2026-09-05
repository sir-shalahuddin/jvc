import React from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  Tag,
  ArrowUpDown,
} from 'lucide-react';
import type { Question, SortMode, MoodFilter } from '../../types/session';

interface QuestionHeaderProps {
  question: Question | null;
  topicIndex: number;
  totalTopics: number;
  answersCount: number;
  isModerator: boolean;
  sortMode: SortMode;
  onChangeSortMode: (mode: SortMode) => void;
  moodFilter: MoodFilter;
  onChangeMoodFilter: (filter: MoodFilter) => void;
  clusters: string[];
  selectedCluster: string;
  onSelectCluster: (cluster: string) => void;
  onOpenSubmitModal: () => void;
  onEditTopic: () => void;
  onDeleteTopic: () => void;
}

export const QuestionHeader: React.FC<QuestionHeaderProps> = ({
  question,
  topicIndex,
  totalTopics,
  answersCount,
  isModerator,
  sortMode,
  onChangeSortMode,
  moodFilter,
  onChangeMoodFilter,
  clusters,
  selectedCluster,
  onSelectCluster,
  onOpenSubmitModal,
  onEditTopic,
  onDeleteTopic,
}) => {
  if (!question) {
    return (
      <div className="topic-container">
        <div className="topic-header-box" style={{ padding: '3rem 1rem' }}>
          <h2 className="topic-title-text" style={{ fontSize: '1.5rem', color: 'var(--text-muted)' }}>
            No topics available in this retrospective session yet.
          </h2>
          {isModerator && (
            <button onClick={onEditTopic} className="btn btn-primary" style={{ marginTop: '1rem' }}>
              <Plus size={16} />
              <span>Create First Topic</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const moodPills: { id: MoodFilter; label: string; icon: string }[] = [
    { id: 'all', label: 'All Moods', icon: '✨' },
    { id: 'positive', label: 'Positive', icon: '😄' },
    { id: 'negative', label: 'Pains & Frustrations', icon: '😤' },
    { id: 'ideas', label: 'Ideas & Wishes', icon: '💡' },
    { id: 'action', label: 'Actionable', icon: '🚀' },
  ];

  return (
    <section className="topic-container" aria-label="Current Retrospective Topic">
      {/* Optional Topic Cover GIF or Image */}
      {question.gif_url && (
        <div className="topic-media-cover">
          <img
            src={question.gif_url}
            alt={question.text}
            className="topic-media-img"
            loading="lazy"
          />
        </div>
      )}

      {/* Topic Title and Action Header */}
      <div className="topic-header-box">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span className="badge badge-primary" style={{ fontSize: '0.75rem', fontWeight: 800 }}>
            TOPIC {topicIndex + 1} OF {Math.max(1, totalTopics)}
          </span>
          <span className="topic-answers-pill">
            • {answersCount} {answersCount === 1 ? 'Reflection' : 'Reflections'}
          </span>
        </div>

        <h1 className="topic-title-text" title={question.text}>
          {question.text}
        </h1>

        {/* Action Toolbar */}
        <div className="topic-action-toolbar">
          <button
            onClick={onOpenSubmitModal}
            className="btn btn-primary"
            style={{
              padding: '0.65rem 1.4rem',
              fontSize: '0.95rem',
              boxShadow: '0 4px 14px var(--primary-glow)',
            }}
            title="Submit your anonymous reflection card (Shortcut: C)"
          >
            <Plus size={18} />
            <span>Add Reflection (C)</span>
          </button>

          {isModerator && (
            <>
              <button
                onClick={onEditTopic}
                className="btn btn-ghost btn-sm"
                title="Edit topic prompt or reaction cover"
              >
                <Edit3 size={15} />
                <span>Edit Topic</span>
              </button>
              <button
                onClick={onDeleteTopic}
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--danger)' }}
                title="Delete this topic"
              >
                <Trash2 size={15} />
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Board Filters & Sorting Bar */}
      <div className="board-filters-bar">
        {/* Mood Emotion Filters */}
        <div className="filter-pills-group" role="group" aria-label="Filter reflections by mood">
          {moodPills.map((pill) => (
            <button
              key={pill.id}
              className={`filter-pill ${moodFilter === pill.id ? 'active' : ''}`}
              onClick={() => onChangeMoodFilter(pill.id)}
            >
              <span>{pill.icon}</span>
              <span>{pill.label}</span>
            </button>
          ))}
        </div>

        {/* Sorting & Cluster Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {clusters.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Tag size={14} style={{ color: 'var(--text-muted)' }} />
              <select
                className="input"
                style={{
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.75rem',
                  height: 'auto',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--bg-subtle)',
                }}
                value={selectedCluster}
                onChange={(e) => onSelectCluster(e.target.value)}
                aria-label="Filter by cluster tag"
              >
                <option value="all">All Clusters ({clusters.length})</option>
                {clusters.map((c) => (
                  <option key={c} value={c}>
                    #{c}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sort Mode Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <ArrowUpDown size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              className="input"
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.75rem',
                height: 'auto',
                borderRadius: 'var(--radius-full)',
                background: 'var(--bg-subtle)',
              }}
              value={sortMode}
              onChange={(e) => onChangeSortMode(e.target.value as SortMode)}
              aria-label="Sort reflections"
            >
              <option value="votes">🔥 Most Votes</option>
              <option value="newest">🕒 Newest First</option>
              <option value="oldest">🕰️ Oldest First</option>
            </select>
          </div>
        </div>
      </div>
    </section>
  );
};
