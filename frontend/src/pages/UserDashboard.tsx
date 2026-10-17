import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Session, User } from '../services/api';
import { boardUrl, copyInviteLink, formatDate, topUpUrl } from '../services/links';
import { PHASE_LABEL, type Phase } from '../types/session';
import { useToast } from '../components/common/Toast';

interface UserDashboardProps {
  user: User | null;
  sessions: Session[];
  quota: number;
  onOpenNewSession: () => void;
}

const FILTER_FROM = 6; // show the local filter once the list is long enough to need it

export const UserDashboard: React.FC<UserDashboardProps> = ({ user, sessions, quota, onOpenNewSession }) => {
  const { showToast } = useToast();
  const [filter, setFilter] = useState('');

  const q = filter.trim().toLowerCase();
  const shown = q ? sessions.filter((s) => s.name.toLowerCase().includes(q)) : sessions;

  const share = async (id: string) => {
    const ok = await copyInviteLink(id);
    showToast(ok ? 'Link undangan disalin' : 'Gagal menyalin link', ok ? 'success' : 'error');
  };

  return (
    <section className="content-card">
      <div className="content-card-header">
        <div>
          <h1 className="content-card-title">Sesi saya</h1>
          <p className="content-card-desc">
            Sisa kuota: <strong>{quota}</strong>.{' '}
            <a href={topUpUrl(user?.email)} target="_blank" rel="noopener noreferrer" className="inline-link">
              Tambah kuota lewat WhatsApp
            </a>
          </p>
        </div>
        {sessions.length >= FILTER_FROM && (
          <div className="content-card-actions">
            <input
              type="search"
              className="form-input"
              style={{ width: '240px', maxWidth: '100%' }}
              placeholder="Cari sesi"
              aria-label="Cari sesi"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="empty-state">
          <h2>Belum ada sesi</h2>
          <p>Buat sesi pertama, lalu bagikan link-nya ke tim.</p>
          <button onClick={onOpenNewSession} className="btn btn-primary">
            <Plus size={16} />
            <span>Buat sesi</span>
          </button>
        </div>
      ) : shown.length === 0 ? (
        <div className="empty-state">
          <p>Tidak ada sesi yang cocok dengan "{filter}".</p>
        </div>
      ) : (
        <ul className="sess-list">
          {shown.map((s) => (
            <li key={s.id} className="sess-row">
              <div className="sess-main">
                <a href={boardUrl(s.id)} className="sess-name" title={s.name}>
                  {s.name}
                </a>
                <span className="sess-meta">
                  {formatDate(s.created_at)}
                  {s.phase && PHASE_LABEL[s.phase as Phase] ? ` · ${PHASE_LABEL[s.phase as Phase]}` : ''}
                </span>
              </div>
              <div className="sess-actions">
                <button onClick={() => share(s.id)} className="btn btn-secondary btn-sm">
                  Bagikan
                </button>
                <a href={boardUrl(s.id)} className="btn btn-primary btn-sm">
                  Buka
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
