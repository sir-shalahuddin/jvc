import React, { useState, useEffect } from 'react';
import {
  Server,
  Users,
  KanbanSquare,
  Zap,
  Trash2,
  ExternalLink,
  Copy,
  AlertTriangle,
  RefreshCw,
  Search,
  Check,
} from 'lucide-react';
import type { AdminStats, Session, User } from '../services/api';
import { fetchAdminStats, deleteAdminSession } from '../services/api';

import { MetricCard } from '../components/common/MetricCard';
import { Modal } from '../components/common/Modal';
import { useToast } from '../components/common/Toast';

interface AdminDashboardProps {
  user: User | null;
  onReturnToUserDashboard: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  user,
  onReturnToUserDashboard,
}) => {
  const { showToast } = useToast();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchAdminStats();
      setStats(data);
      setSessions(data.recent_sessions || []);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to load admin statistics', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.is_admin) {
      loadData();
    }
  }, [user]);

  if (!user?.is_admin) {
    return (
      <div
        className="content-card"
        style={{
          maxWidth: '600px',
          margin: '4rem auto',
          textAlign: 'center',
          padding: '3rem 2rem',
          gap: '1.25rem',
        }}
      >
        <div
          style={{
            width: '60px',
            height: '60px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--danger-bg)',
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
          }}
        >
          <AlertTriangle size={32} />
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Access Denied</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          This command center is reserved exclusively for the platform superadministrator.
          Your current account does not have sufficient privileges.
        </p>
        <div style={{ marginTop: '0.5rem' }}>
          <button onClick={onReturnToUserDashboard} className="btn btn-primary">
            Return to User Dashboard
          </button>
        </div>
      </div>
    );
  }

  const filteredSessions = sessions.filter((s) => {
    const q = searchTerm.toLowerCase();
    const host = (s.owner_email || s.creator_email || '').toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      host.includes(q)
    );
  });

  const handleCopyLink = (sessionId: string) => {
    const url = `${window.location.origin}/session/?id=${encodeURIComponent(sessionId)}`;
    navigator.clipboard.writeText(url);
    showToast('Participant join link copied!', 'success');
  };

  const handleCopyId = (sessionId: string) => {
    navigator.clipboard.writeText(sessionId);
    setCopiedId(sessionId);
    showToast(`Session ID #${sessionId.slice(0, 8)} copied!`, 'info');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDeleteConfirm = async () => {
    if (!sessionToDelete) return;
    try {
      setIsDeleting(true);
      await deleteAdminSession(sessionToDelete.id);
      setSessions((prev) => prev.filter((s) => s.id !== sessionToDelete.id));
      if (stats) {
        setStats({
          ...stats,
          total_sessions: Math.max(0, stats.total_sessions - 1),
        });
      }
      showToast(`Session "${sessionToDelete.name}" successfully deleted!`, 'success');
      setSessionToDelete(null);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to delete session', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* Superadmin Header Banner */}
      <section className="welcome-banner" style={{ borderColor: 'var(--primary)' }}>
        <div className="welcome-text">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span className="badge badge-primary">COMMAND CENTER</span>
            <span className="badge badge-success">Live Monitoring</span>
          </div>
          <h1>Platform Superadmin Console</h1>
          <p>
            Global telemetry, retrospective orchestration, user quota oversight, and platform resource management.
          </p>
        </div>
        <button
          onClick={loadData}
          className="btn btn-secondary"
          disabled={loading}
          style={{ gap: '0.5rem' }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Data</span>
        </button>
      </section>

      {/* Global Platform KPIs */}
      <section className="metrics-grid">
        <MetricCard
          label="Total Global Sessions"
          value={stats?.total_sessions ?? 0}
          subtext="Retrospective instances in Firestore"
          icon={<KanbanSquare size={22} color="var(--primary)" />}
          trendBadge={{ text: 'System Wide', type: 'primary' }}
        />
        <MetricCard
          label="Registered Users"
          value={stats?.total_users ?? 0}
          subtext="Active accounts with quota allocation"
          icon={<Users size={22} color="var(--info)" />}
          trendBadge={{ text: 'Global', type: 'info' }}
        />
        <MetricCard
          label="Units Claimed"
          value={stats?.total_revenue ?? 0}
          subtext="Cumulative session quota granted"
          icon={<Zap size={22} color="var(--warning)" />}
        />
        <MetricCard
          label="System Health"
          value="100% OK"
          subtext="Firestore & Cloud Run active"
          icon={<Server size={22} color="var(--success)" />}
          trendBadge={{ text: 'Operational', type: 'success' }}
        />
      </section>

      {/* Global Sessions Management Table */}
      <section className="content-card">
        <div className="content-card-header">
          <div>
            <h2 className="content-card-title">All Retrospective Sessions</h2>
            <p className="content-card-desc">
              Inspect, join as Scrum Master, or prune any active session across all platform workspaces.
            </p>
          </div>
          <div className="content-card-actions">
            <div className="header-search" style={{ width: '260px' }}>
              <Search size={16} className="header-search-icon" />
              <input
                type="text"
                placeholder="Filter host, topic, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Host Email</th>
                <th>Topic / Title</th>
                <th>Session ID</th>
                <th>Created At</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    Loading platform telemetry...
                  </td>
                </tr>
              ) : filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    {searchTerm ? `No sessions match "${searchTerm}"` : 'No sessions currently in the database.'}
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => {
                  const host = session.owner_email || session.creator_email || 'System';
                  return (
                    <tr key={session.id}>
                      <td style={{ maxWidth: '240px' }}>
                        <span
                          style={{
                            fontWeight: 600,
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={host}
                        >
                          {host}
                        </span>
                      </td>
                      <td style={{ maxWidth: '280px' }}>
                        <span
                          style={{
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={session.name}
                        >
                          {session.name}
                        </span>
                      </td>
                      <td>
                        <span
                          className="session-id-pill"
                          onClick={() => handleCopyId(session.id)}
                          title="Click to copy ID"
                        >
                          {copiedId === session.id ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Check size={11} /> Copied
                            </span>
                          ) : (
                            `#${session.id.substring(0, 8)}`
                          )}
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
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            onClick={() => handleCopyLink(session.id)}
                            className="btn btn-ghost btn-sm"
                            title="Copy participant link"
                          >
                            <Copy size={14} />
                          </button>
                          <a
                            href={`/session/?id=${encodeURIComponent(session.id)}&role=sm`}
                            className="btn btn-secondary btn-sm"
                            title="Open session board as Scrum Master"
                          >
                            <ExternalLink size={14} />
                            <span>Manage</span>
                          </a>
                          <button
                            onClick={() => setSessionToDelete(session)}
                            className="btn btn-danger btn-sm"
                            title="Delete session"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!sessionToDelete}
        onClose={() => setSessionToDelete(null)}
        title="Confirm Session Deletion"
        footer={
          <>
            <button
              onClick={() => setSessionToDelete(null)}
              className="btn btn-secondary"
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              className="btn btn-danger"
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Permanently Delete'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <div
            style={{
              padding: '0.75rem',
              borderRadius: 'var(--radius-full)',
              background: 'var(--danger-bg)',
              color: 'var(--danger)',
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={24} />
          </div>
          <div>
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Are you sure you want to delete this session?
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              This will permanently delete session{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                "{sessionToDelete?.name}"
              </strong>{' '}
              (<code>#{sessionToDelete?.id.slice(0, 8)}</code>) along with all associated questions, answers, sentiments, and action items. This action cannot be undone.
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
};
