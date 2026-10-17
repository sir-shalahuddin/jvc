import React, { useState, useEffect } from 'react';
import type { User, Session } from './services/api';
import { fetchCurrentUser, fetchHistory, createSession } from './services/api';
import { boardUrl, loginUrl } from './services/links';
import { ToastProvider, useToast } from './components/common/Toast';

import { DashboardLayout, type DashboardTab } from './components/layout/DashboardLayout';
import { UserDashboard } from './pages/UserDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { SessionBoardPage } from './pages/SessionBoardPage';
import { Modal } from './components/common/Modal';
import { ErrorBoundary } from './components/common/ErrorBoundary';

const PRESETS = ['Retro sprint', 'Review proyek', 'Mulai / Berhenti / Lanjut'];

function DashboardApp() {
  const { showToast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [quota, setQuota] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState<boolean>(false);
  const [sessionTopic, setSessionTopic] = useState<string>(PRESETS[0]);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Keep the tab in sync with the URL (/admin or /dashboard).
  useEffect(() => {
    const syncWithUrl = () => {
      setActiveTab(window.location.pathname.startsWith('/admin') ? 'admin' : 'overview');
    };
    syncWithUrl();
    window.addEventListener('popstate', syncWithUrl);
    return () => window.removeEventListener('popstate', syncWithUrl);
  }, []);

  const handleTabChange = (tab: DashboardTab) => {
    setActiveTab(tab);
    window.history.pushState({}, '', tab === 'admin' ? '/admin' : '/dashboard');
  };

  useEffect(() => {
    (async () => {
      try {
        const userData = await fetchCurrentUser();
        setUser(userData);
        if (userData.authenticated) {
          setQuota(userData.quota ?? 0);
          try {
            const hist = await fetchHistory();
            setSessions(hist.sessions || []);
            if (hist.quota !== undefined) setQuota(hist.quota);
          } catch (e) {
            console.error('Gagal memuat riwayat sesi:', e);
            showToast('Gagal memuat riwayat sesi', 'error');
          }
        }
      } catch (err) {
        console.error('Gagal memeriksa login:', err);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateSessionSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const topic = sessionTopic.trim() || PRESETS[0];
    try {
      setIsCreating(true);
      const res = await createSession(topic);
      window.location.href = boardUrl(res.id);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Gagal membuat sesi. Cek kuota kamu.', 'error');
      setIsCreating(false);
    }
  };

  if (loading) {
    return <div className="center-screen">Memuat...</div>;
  }

  if (!user?.authenticated) {
    return (
      <div className="center-screen">
        <div className="content-card login-card">
          <div className="brand-icon" style={{ width: 48, height: 48, fontSize: '1.5rem' }}>
            R
          </div>
          <h1 className="content-card-title">Masuk ke Retro</h1>
          <p className="content-card-desc">Masuk untuk membuat dan mengelola sesi retro.</p>
          <a href={loginUrl()} className="btn btn-primary" style={{ width: '100%', padding: '0.7rem' }}>
            Masuk dengan Google
          </a>
          <a href="/" className="inline-link">
            Kembali ke beranda
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
    >
      {activeTab === 'admin' ? (
        <AdminDashboard user={user} onReturnToUserDashboard={() => handleTabChange('overview')} />
      ) : (
        <UserDashboard
          user={user}
          sessions={sessions}
          quota={quota}
          onOpenNewSession={() => setIsNewSessionModalOpen(true)}
        />
      )}

      <Modal
        isOpen={isNewSessionModalOpen}
        onClose={() => setIsNewSessionModalOpen(false)}
        title="Sesi baru"
        footer={
          <>
            <button onClick={() => setIsNewSessionModalOpen(false)} className="btn btn-secondary" disabled={isCreating}>
              Batal
            </button>
            <button onClick={handleCreateSessionSubmit} className="btn btn-primary" disabled={isCreating}>
              {isCreating ? 'Membuat...' : 'Buat dan buka papan'}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateSessionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="session-name-input">
              Nama sesi
            </label>
            <input
              id="session-name-input"
              type="text"
              className="form-input"
              placeholder="Contoh: Retro Sprint 42"
              value={sessionTopic}
              onChange={(e) => setSessionTopic(e.target.value)}
              required
            />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setSessionTopic(preset)}
                className={`quick-chip ${sessionTopic === preset ? 'selected' : ''}`}
              >
                {preset}
              </button>
            ))}
          </div>
          <p className="content-card-desc">Satu sesi memakai 1 kuota.</p>
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
    <ErrorBoundary>
      <ToastProvider>{isSessionRoute ? <SessionBoardPage /> : <DashboardApp />}</ToastProvider>
    </ErrorBoundary>
  );
}
