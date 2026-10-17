import React, { useState } from 'react';
import { LayoutDashboard, ShieldAlert, Plus, LogOut, Menu } from 'lucide-react';
import type { User } from '../../services/api';
import { loginUrl } from '../../services/links';
import { UI_STYLE_LABEL, useUiStyle } from '../../services/uiStyle';

export type DashboardTab = 'overview' | 'admin';

interface DashboardLayoutProps {
  user: User | null;
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  onOpenNewSessionModal: () => void;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  user,
  activeTab,
  onTabChange,
  onOpenNewSessionModal,
  children,
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);
  const [uiStyle, toggleUiStyle] = useUiStyle();

  const name = user?.email?.split('@')[0] || '';

  const go = (tab: DashboardTab) => {
    onTabChange(tab);
    setIsMobileOpen(false);
  };

  return (
    <div className="dashboard-layout">
      {isMobileOpen && (
        <div className="sidebar-backdrop" onClick={() => setIsMobileOpen(false)} aria-hidden="true" />
      )}

      <aside className={`sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <a href="/" className="brand-wrapper" title="Ke beranda">
            <div className="brand-icon">R</div>
            <span className="brand-text">Retro</span>
          </a>
        </div>

        <div className="sidebar-content">
          <ul className="nav-list">
            <li>
              <button
                className={`nav-item-btn ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => go('overview')}
              >
                <LayoutDashboard size={18} />
                <span>Sesi saya</span>
              </button>
            </li>
            {user?.is_admin && (
              <li>
                <button
                  className={`nav-item-btn ${activeTab === 'admin' ? 'active' : ''}`}
                  onClick={() => go('admin')}
                >
                  <ShieldAlert size={18} />
                  <span>Admin</span>
                </button>
              </li>
            )}
          </ul>
        </div>

        <div className="sidebar-footer">
          {user?.authenticated ? (
            <>
              <div className="user-profile-box">
                <div className="user-avatar">{(name || 'U').slice(0, 2).toUpperCase()}</div>
                <div className="user-details">
                  <span className="user-name" title={user.email}>
                    {name}
                  </span>
                </div>
              </div>
              <a
                href="/auth/logout"
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'flex-start', color: 'var(--danger)' }}
              >
                <LogOut size={16} />
                <span>Keluar</span>
              </a>
            </>
          ) : (
            <a href={loginUrl()} className="btn btn-primary btn-sm" style={{ width: '100%' }}>
              Masuk dengan Google
            </a>
          )}
        </div>
      </aside>

      <div className="main-wrapper">
        <header className="top-header">
          <div className="header-left">
            <button
              onClick={() => setIsMobileOpen(!isMobileOpen)}
              className="btn btn-ghost btn-icon"
              id="mobile-menu-btn"
              aria-label="Buka menu"
            >
              <Menu size={20} />
            </button>
            <div className="breadcrumb-trail">
              <span className="active">{activeTab === 'admin' ? 'Admin' : 'Sesi saya'}</span>
            </div>
          </div>

          <div className="header-right">
            <button
              type="button"
              onClick={toggleUiStyle}
              className="btn btn-secondary btn-sm"
              title={uiStyle === 'brutalist' ? 'Ganti tampilan ke Modern' : 'Ganti tampilan ke Brutalist'}
            >
              <span className="btn-text-desktop">Tampilan: </span>
              {UI_STYLE_LABEL[uiStyle]}
            </button>

            <button onClick={onOpenNewSessionModal} className="btn btn-primary" id="header-create-session-btn">
              <Plus size={16} />
              <span>Sesi baru</span>
            </button>
          </div>
        </header>

        <main className="page-container">{children}</main>
      </div>
    </div>
  );
};
