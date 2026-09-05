import React, { useState, useEffect } from 'react';
import type { User, Session } from './services/api';
import { fetchCurrentUser, fetchHistory, createSession } from './services/api';
import { ToastProvider, useToast } from './components/common/Toast';

import { DashboardLayout } from './components/layout/DashboardLayout';
import { UserDashboard } from './pages/UserDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { SessionBoardPage } from './pages/SessionBoardPage';
import { Modal } from './components/common/Modal';
import { Plus, Sparkles, LogIn, ExternalLink } from 'lucide-react';

function DashboardApp() {
  const { showToast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [quota, setQuota] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Tab State: 'overview' | 'sessions' | 'admin'
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'admin'>('overview');

  // New Session Modal State
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState<boolean>(false);
  const [sessionTopic, setSessionTopic] = useState<string>('Sprint Sync');
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Sync tab with URL
  useEffect(() => {
    const syncWithUrl = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path.includes('/admin') || hash === '#admin') {
        setActiveTab('admin');
      } else if (path.includes('/sessions') || hash === '#sessions') {
        setActiveTab('sessions');
      } else {
        setActiveTab('overview');
      }
    };

    syncWithUrl();
    window.addEventListener('popstate', syncWithUrl);
    return () => window.removeEventListener('popstate', syncWithUrl);
  }, []);

  const handleTabChange = (tab: 'overview' | 'sessions' | 'admin') => {
    setActiveTab(tab);
    if (tab === 'admin') {
      window.history.pushState({}, '', '/admin');
    } else if (tab === 'sessions') {
      window.history.pushState({}, '', '/dashboard#sessions');
    } else {
      window.history.pushState({}, '', '/dashboard');
    }
  };

  const loadUserData = async () => {
    try {
      setLoading(true);
      const userData = await fetchCurrentUser();
      setUser(userData);

      if (userData.authenticated) {
        setQuota(userData.quota ?? 0);
        try {
          const hist = await fetchHistory();
          setSessions(hist.sessions || []);
          if (hist.quota !== undefined) {
            setQuota(hist.quota);
          }
        } catch (e) {
          console.error('Failed to load user session history:', e);
        }
      }
    } catch (err: any) {
      console.error('Auth verification error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
  }, []);

  const handleCreateSessionSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const topic = sessionTopic.trim() || 'Sprint Sync';
    try {
      setIsCreating(true);
      const res = await createSession(topic);
      showToast('Session created successfully! Redirecting to board...', 'success');
      setTimeout(() => {
        window.location.href = `/session/?id=${encodeURIComponent(res.id)}&role=sm`;
      }, 500);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to create session. Please check your quota.', 'error');
      setIsCreating(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          width: '100vw',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          background: 'var(--bg-app)',
          color: 'var(--text-muted)',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-full)',
            border: '3px solid var(--border-subtle)',
            borderTopColor: 'var(--primary)',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>Initializing Workspace Dashboard...</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Not logged in screen
  if (!user?.authenticated) {
    return (
      <div
        style={{
          height: '100vh',
          width: '100vw',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-app)',
          padding: '1.5rem',
        }}
      >
        <div
          className="content-card"
          style={{
            maxWidth: '440px',
            width: '100%',
            padding: '2.5rem',
            textAlign: 'center',
            gap: '1.5rem',
          }}
        >
          <div
            className="brand-icon"
            style={{ width: '54px', height: '54px', margin: '0 auto', fontSize: '1.75rem' }}
          >
            R
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Retro Workspace
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Sign in to manage your agile sprint retrospectives, view telemetry, and collaborate in real-time.
            </p>
          </div>

          <a
            href="/auth/google/login"
            className="btn btn-primary"
            style={{ padding: '0.85rem', width: '100%', fontSize: '0.95rem' }}
          >
            <LogIn size={18} />
            <span>Continue with Google</span>
          </a>

          <a
            href="/"
            style={{
              fontSize: '0.825rem',
              color: 'var(--text-muted)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              justifyContent: 'center',
            }}
          >
            <span>Back to Home</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout
      user={user}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      onOpenNewSessionModal={() => setIsNewSessionModalOpen(true)}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
    >
      {activeTab === 'admin' ? (
        <AdminDashboard
          user={user}
          onReturnToUserDashboard={() => handleTabChange('overview')}
        />
      ) : (
        <UserDashboard
          user={user}
          sessions={sessions}
          quota={quota}
          searchQuery={searchQuery}
          onOpenNewSession={() => setIsNewSessionModalOpen(true)}
        />
      )}

      {/* New Session Creation Modal */}
      <Modal
        isOpen={isNewSessionModalOpen}
        onClose={() => setIsNewSessionModalOpen(false)}
        title="Start New Retrospective"
        footer={
          <>
            <button
              onClick={() => setIsNewSessionModalOpen(false)}
              className="btn btn-secondary"
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateSessionSubmit}
              className="btn btn-primary"
              disabled={isCreating}
            >
              <Plus size={16} />
              <span>{isCreating ? 'Creating Session...' : 'Create & Open Board'}</span>
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateSessionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="session-name-input">
              Discussion Topic / Sprint Name
            </label>
            <input
              id="session-name-input"
              type="text"
              className="form-input"
              placeholder="e.g., Sprint 42 Retrospective"
              value={sessionTopic}
              onChange={(e) => setSessionTopic(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Quick Suggestions
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
              {['Sprint Sync', 'Q3 Project Review', 'What Went Well / Improve', 'Start / Stop / Continue'].map(
                (preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSessionTopic(preset)}
                    className="btn btn-secondary btn-sm"
                    style={{
                      fontSize: '0.75rem',
                      background: sessionTopic === preset ? 'var(--primary-light)' : undefined,
                      borderColor: sessionTopic === preset ? 'var(--primary)' : undefined,
                      color: sessionTopic === preset ? 'var(--primary)' : undefined,
                    }}
                  >
                    {preset}
                  </button>
                )
              )}
            </div>
          </div>

          <div
            style={{
              padding: '0.85rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-subtle)',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Sparkles size={16} color="var(--primary)" />
            <span>
              Creating a session consumes 1 unit of your active quota. You have{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{quota} units remaining</strong>.
            </span>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}

export default function App() {
  const isSessionRoute =
    window.location.pathname.startsWith('/session') ||
    (new URLSearchParams(window.location.search).has('id') &&
      !window.location.pathname.includes('/dashboard') &&
      !window.location.pathname.includes('/admin'));

  return (
    <ToastProvider>
      {isSessionRoute ? <SessionBoardPage /> : <DashboardApp />}
    </ToastProvider>
  );
}
