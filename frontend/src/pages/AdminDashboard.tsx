import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { AdminStats, Session, User } from '../services/api';
import { fetchAdminSessions, fetchAdminStats, deleteAdminSession } from '../services/api';
import { boardUrl, copyInviteLink, copyText, formatDate } from '../services/links';
import { PHASE_LABEL, type Phase } from '../types/session';

import { MetricCard } from '../components/common/MetricCard';
import { Modal } from '../components/common/Modal';
import { useToast } from '../components/common/Toast';

interface AdminDashboardProps {
  user: User | null;
  onReturnToUserDashboard: () => void;
}

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d} hari ${h} jam`;
  if (h > 0) return `${h} jam ${m} menit`;
  return `${m} menit`;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onReturnToUserDashboard }) => {
  const { showToast } = useToast();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState(''); // debounced value sent to the server
  const [loading, setLoading] = useState(true);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const isAdmin = !!user?.is_admin;
  const abortRef = useRef<AbortController | null>(null);

  // Debounce the search box; a new query goes back to page 1.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setQuery(searchInput.trim());
      setPage(1);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const loadStats = useCallback(async () => {
    try {
      setStats(await fetchAdminStats());
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat statistik', 'error');
    }
  }, [showToast]);

  const loadSessions = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const res = await fetchAdminSessions({ page, pageSize: PAGE_SIZE, q: query }, ctrl.signal);
      setSessions(res.sessions);
      setTotal(res.total);
      setLoading(false);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      showToast(err.message || 'Gagal memuat daftar sesi', 'error');
      setLoading(false);
    }
  }, [page, query, showToast]);

  useEffect(() => {
    if (isAdmin) loadStats();
  }, [isAdmin, loadStats]);

  useEffect(() => {
    if (isAdmin) loadSessions();
    return () => abortRef.current?.abort();
  }, [isAdmin, loadSessions]);

  if (!isAdmin) {
    return (
      <div className="content-card login-card" style={{ margin: '3rem auto' }}>
        <h1 className="content-card-title">Akses ditolak</h1>
        <p className="content-card-desc">Halaman ini hanya untuk admin.</p>
        <button onClick={onReturnToUserDashboard} className="btn btn-primary">
          Kembali ke dashboard
        </button>
      </div>
    );
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleCopyLink = async (id: string) => {
    const ok = await copyInviteLink(id);
    showToast(ok ? 'Link undangan disalin' : 'Gagal menyalin link', ok ? 'success' : 'error');
  };

  const handleCopyId = async (id: string) => {
    const ok = await copyText(id);
    showToast(ok ? 'ID sesi disalin' : 'Gagal menyalin ID', ok ? 'success' : 'error');
  };

  const handleDeleteConfirm = async () => {
    if (!sessionToDelete) return;
    try {
      setIsDeleting(true);
      await deleteAdminSession(sessionToDelete.id);
      showToast(`Sesi "${sessionToDelete.name}" dihapus`, 'success');
      setSessionToDelete(null);
      if (sessions.length === 1 && page > 1) setPage(page - 1);
      else loadSessions();
      loadStats();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus sesi', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const h = stats?.health;
  const healthValue = !h ? '-' : h.status === 'ok' ? 'Normal' : 'Terganggu';
  const healthSub = !h
    ? 'Belum ada data'
    : h.firestore_ok
      ? `Firestore ${h.firestore_ms} ms. Aktif ${formatUptime(h.uptime_seconds)}.`
      : `Firestore gagal dibaca. Aktif ${formatUptime(h.uptime_seconds)}.`;

  return (
    <>
      <section className="metrics-grid">
        <MetricCard label="Total sesi" value={stats?.total_sessions ?? 0} />
        <MetricCard label="Pengguna" value={stats?.total_users ?? 0} />
        <MetricCard label="Kuota dibagikan" value={stats?.total_revenue ?? 0} subtext="Jumlah kuota yang pernah diberikan" />
        <MetricCard
          label="Status server"
          value={healthValue}
          subtext={healthSub}
          tone={h ? (h.status === 'ok' ? 'ok' : 'danger') : undefined}
        />
      </section>

      <section className="content-card">
        <div className="content-card-header">
          <div>
            <h1 className="content-card-title">Semua sesi</h1>
            <p className="content-card-desc">{total} sesi{query ? ` cocok dengan "${query}"` : ''}</p>
          </div>
          <div className="content-card-actions">
            <input
              type="search"
              className="form-input"
              style={{ width: '260px', maxWidth: '100%' }}
              placeholder="Cari nama sesi atau pemilik"
              aria-label="Cari sesi"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button
              onClick={() => {
                loadStats();
                loadSessions();
              }}
              className="btn btn-secondary btn-sm"
              disabled={loading}
            >
              Muat ulang
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Pemilik</th>
                <th>Sesi</th>
                <th>Fase</th>
                <th>Dibuat</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && sessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-empty">
                    Memuat...
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-empty">
                    {query ? `Tidak ada sesi yang cocok dengan "${query}".` : 'Belum ada sesi.'}
                  </td>
                </tr>
              ) : (
                sessions.map((s) => {
                  const host = s.owner_email || s.creator_email || '-';
                  return (
                    <tr key={s.id} style={loading ? { opacity: 0.6 } : undefined}>
                      <td style={{ maxWidth: '240px' }}>
                        <span className="cell-clip" title={host}>
                          {host}
                        </span>
                      </td>
                      <td style={{ maxWidth: '280px' }}>
                        <span className="cell-clip" style={{ fontWeight: 600 }} title={s.name}>
                          {s.name}
                        </span>
                      </td>
                      <td>{s.phase && PHASE_LABEL[s.phase as Phase] ? PHASE_LABEL[s.phase as Phase] : '-'}</td>
                      <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(s.created_at, true)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button onClick={() => handleCopyId(s.id)} className="btn btn-ghost btn-sm" title={s.id}>
                            ID
                          </button>
                          <button onClick={() => handleCopyLink(s.id)} className="btn btn-ghost btn-sm">
                            Salin link
                          </button>
                          <a href={boardUrl(s.id)} className="btn btn-secondary btn-sm">
                            Buka
                          </a>
                          <button onClick={() => setSessionToDelete(s)} className="btn btn-danger btn-sm">
                            Hapus
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

        {total > PAGE_SIZE && (
          <div className="pager">
            <button className="btn btn-secondary btn-sm" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
              Sebelumnya
            </button>
            <span>
              Halaman {page} dari {pageCount}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page >= pageCount || loading}
              onClick={() => setPage(page + 1)}
            >
              Berikutnya
            </button>
          </div>
        )}
      </section>

      <Modal
        isOpen={!!sessionToDelete}
        onClose={() => setSessionToDelete(null)}
        title="Hapus sesi"
        footer={
          <>
            <button onClick={() => setSessionToDelete(null)} className="btn btn-secondary" disabled={isDeleting}>
              Batal
            </button>
            <button onClick={handleDeleteConfirm} className="btn btn-danger" disabled={isDeleting}>
              {isDeleting ? 'Menghapus...' : 'Hapus permanen'}
            </button>
          </>
        }
      >
        <p style={{ lineHeight: 1.55 }}>
          Sesi <strong>"{sessionToDelete?.name}"</strong> akan dihapus bersama semua kartu, topik, vote, dan item aksi di
          dalamnya. Tindakan ini tidak bisa dibatalkan.
        </p>
      </Modal>
    </>
  );
};
