import React, { useState } from 'react';
import {
  KanbanSquare,
  Zap,
  Clock,
  ExternalLink,
  Copy,
  Plus,
  LayoutGrid,
  Table as TableIcon,
  Check,
  Sparkles,
} from 'lucide-react';
import type { Session, User } from '../services/api';
import { MetricCard } from '../components/common/MetricCard';

import { useToast } from '../components/common/Toast';

interface UserDashboardProps {
  user: User | null;
  sessions: Session[];
  quota: number;
  searchQuery: string;
  onOpenNewSession: () => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  user,
  sessions,
  quota,
  searchQuery,
  onOpenNewSession,
}) => {
  const { showToast } = useToast();
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredSessions = sessions.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q)
    );
  });

  const handleCopyLink = (sessionId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const url = `${window.location.origin}/session/?id=${encodeURIComponent(sessionId)}`;
    navigator.clipboard.writeText(url);
    setCopiedId(sessionId);
    showToast('Participant join link copied to clipboard!', 'success');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCopyId = (sessionId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(sessionId);
    setCopiedId(sessionId);
    showToast(`Session ID #${sessionId.slice(0, 8)} copied!`, 'info');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const latestSessionDate = sessions.length > 0
    ? new Date(sessions[0].created_at).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'No activity yet';

  const userName = user?.email?.split('@')[0] || 'Team Member';

  return (
    <>
      {/* Welcome Banner */}
      <section className="welcome-banner">
        <div className="welcome-text">
          <h1>Welcome back, {userName}! 👋</h1>
          <p>
            Facilitate agile sprint syncs, gather anonymous feedback, and empower continuous team improvement.
          </p>
        </div>
        <button
          onClick={onOpenNewSession}
          className="btn btn-primary"
          style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}
        >
          <Plus size={18} />
          <span>Start Retrospective</span>
        </button>
      </section>

      {/* KPI Metric Widgets */}
      <section className="metrics-grid">
        <MetricCard
          label="Total Hosted Sessions"
          value={sessions.length}
          subtext="All-time retrospectives conducted"
          icon={<KanbanSquare size={22} />}
          trendBadge={{ text: 'Active Host', type: 'primary' }}
        />
        <MetricCard
          label="Remaining Quota"
          value={`${quota} Units`}
          subtext="Available credits for hosting sessions"
          icon={<Zap size={22} color="var(--primary)" />}
          trendBadge={{
            text: quota > 0 ? 'Quota Ready' : 'Exhausted',
            type: quota > 0 ? 'success' : 'warning',
          }}
        />
        <MetricCard
          label="Latest Retrospective"
          value={latestSessionDate}
          subtext="Most recent session created"
          icon={<Clock size={22} />}
        />
      </section>

      {/* Retrospectives Explorer */}
      <section className="content-card">
        <div className="content-card-header">
          <div>
            <h2 className="content-card-title">My Retrospectives</h2>
            <p className="content-card-desc">
              Browse, launch, or distribute your sprint retro boards to participants.
            </p>
          </div>
          <div className="content-card-actions">
            <div
              style={{
                display: 'flex',
                background: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '3px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <button
                onClick={() => setViewMode('grid')}
                className={`btn btn-ghost btn-sm ${viewMode === 'grid' ? 'btn-secondary' : ''}`}
                style={{ padding: '0.35rem 0.6rem' }}
                title="Grid Cards View"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`btn btn-ghost btn-sm ${viewMode === 'table' ? 'btn-secondary' : ''}`}
                style={{ padding: '0.35rem 0.6rem' }}
                title="Data Table View"
              >
                <TableIcon size={16} />
              </button>
            </div>
            <button onClick={onOpenNewSession} className="btn btn-primary btn-sm">
              <Plus size={14} />
              <span>Create</span>
            </button>
          </div>
        </div>

        {/* Sessions Content */}
        {filteredSessions.length === 0 ? (
          <div
            style={{
              padding: '4rem 2rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: '1rem',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--bg-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <Sparkles size={28} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                {searchQuery ? 'No matching retrospectives' : 'No retrospectives yet'}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '400px' }}>
                {searchQuery
                  ? `No sessions found matching "${searchQuery}". Try a different keyword.`
                  : 'Get started by creating your very first team retrospective session!'}
              </p>
            </div>
            {!searchQuery && (
              <button onClick={onOpenNewSession} className="btn btn-primary btn-sm">
                <Plus size={14} />
                <span>Create First Session</span>
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="sessions-grid">
            {filteredSessions.map((session) => (
              <div key={session.id} className="session-box">
                <div className="session-box-header">
                  <div>
                    <h3 className="session-box-title">{session.name}</h3>
                    <div className="session-box-meta">
                      <Clock size={12} />
                      <span>
                        {new Date(session.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                  <button
                    className="session-id-pill"
                    onClick={(e) => handleCopyId(session.id, e)}
                    title="Click to copy ID"
                  >
                    {copiedId === session.id ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Check size={11} /> Copied
                      </span>
                    ) : (
                      `#${session.id.substring(0, 8)}`
                    )}
                  </button>
                </div>

                <div className="session-box-actions">
                  <a
                    href={`/session/?id=${encodeURIComponent(session.id)}&role=sm`}
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1 }}
                  >
                    <ExternalLink size={14} />
                    <span>Open Board</span>
                  </a>
                  <button
                    onClick={(e) => handleCopyLink(session.id, e)}
                    className="btn btn-secondary btn-sm"
                    title="Copy participant invite link"
                  >
                    <Copy size={14} />
                    <span>Share</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Topic</th>
                  <th>Session ID</th>
                  <th>Created Date</th>
                  <th>Role</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((session) => (
                  <tr key={session.id}>
                    <td style={{ fontWeight: 600 }}>{session.name}</td>
                    <td>
                      <span
                        className="session-id-pill"
                        onClick={(e) => handleCopyId(session.id, e)}
                        title="Click to copy ID"
                      >
                        #{session.id.substring(0, 8)}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.825rem' }}>
                      {new Date(session.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td>
                      <span className="badge badge-primary">Scrum Master</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button
                          onClick={(e) => handleCopyLink(session.id, e)}
                          className="btn btn-ghost btn-sm"
                          title="Copy Share Link"
                        >
                          <Copy size={14} />
                        </button>
                        <a
                          href={`/session/?id=${encodeURIComponent(session.id)}&role=sm`}
                          className="btn btn-secondary btn-sm"
                        >
                          <ExternalLink size={14} />
                          <span>Open</span>
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
};
