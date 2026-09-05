import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  KanbanSquare,
  ShieldAlert,
  Plus,
  Search,
  Sun,
  Moon,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  Zap,
  MessageCircle,
} from 'lucide-react';
import type { User } from '../../services/api';


interface DashboardLayoutProps {
  user: User | null;
  activeTab: 'overview' | 'sessions' | 'admin';
  onTabChange: (tab: 'overview' | 'sessions' | 'admin') => void;
  onOpenNewSessionModal: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  user,
  activeTab,
  onTabChange,
  onOpenNewSessionModal,
  searchQuery,
  onSearchChange,
  children,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const saved =
      (localStorage.getItem('theme') as 'light' | 'dark') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const getWhatsAppLink = () => {
    const email = user?.email || 'User';
    const message = encodeURIComponent(
      `Halo Admin Retro, saya ingin request penambahan kuota sesi untuk akun ${email}. Terima kasih!`
    );
    return `https://wa.me/6285640390800?text=${message}`;
  };

  const getInitials = (email?: string) => {
    if (!email) return 'U';
    const name = email.split('@')[0];
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar Navigation */}
      <aside
        className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${
          isMobileOpen ? 'mobile-open' : ''
        }`}
      >
        <div className="sidebar-header">
          <a href="/" className="brand-wrapper" title="Back to Landing">
            <div className="brand-icon">R</div>
            {!isCollapsed && (
              <>
                <span className="brand-text">Retro</span>
                <span className="brand-badge">SaaS</span>
              </>
            )}
          </a>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="btn btn-ghost btn-icon btn-sm"
            style={{ display: isMobileOpen ? 'none' : 'flex' }}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <div className="sidebar-content">
          <div>
            {!isCollapsed && <div className="nav-section-title">Workspace</div>}
            <ul className="nav-list">
              <li>
                <button
                  className={`nav-item-btn ${activeTab === 'overview' ? 'active' : ''}`}
                  onClick={() => {
                    onTabChange('overview');
                    setIsMobileOpen(false);
                  }}
                  title="Dashboard Overview"
                >
                  <LayoutDashboard size={18} />
                  {!isCollapsed && <span>Overview</span>}
                </button>
              </li>
              <li>
                <button
                  className={`nav-item-btn ${activeTab === 'sessions' ? 'active' : ''}`}
                  onClick={() => {
                    onTabChange('sessions');
                    setIsMobileOpen(false);
                  }}
                  title="My Retrospectives"
                >
                  <KanbanSquare size={18} />
                  {!isCollapsed && <span>My Sessions</span>}
                </button>
              </li>
            </ul>
          </div>

          {user?.is_admin && (
            <div>
              {!isCollapsed && <div className="nav-section-title">Administration</div>}
              <ul className="nav-list">
                <li>
                  <button
                    className={`nav-item-btn ${activeTab === 'admin' ? 'active' : ''}`}
                    onClick={() => {
                      onTabChange('admin');
                      setIsMobileOpen(false);
                    }}
                    title="Superadmin Command Center"
                    style={{ color: activeTab === 'admin' ? 'var(--primary)' : undefined }}
                  >
                    <ShieldAlert size={18} />
                    {!isCollapsed && (
                      <>
                        <span>Admin Center</span>
                        <span className="nav-badge badge-primary">PRO</span>
                      </>
                    )}
                  </button>
                </li>
              </ul>
            </div>
          )}

          {!isCollapsed && (
            <div style={{ marginTop: 'auto' }}>
              <div
                style={{
                  background: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  <Zap size={14} color="var(--primary)" />
                  <span>SESSION QUOTA</span>
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                  {user?.quota ?? 0} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>Units</span>
                </div>
                <a
                  href={getWhatsAppLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', fontSize: '0.75rem', justifyContent: 'center', gap: '0.4rem' }}
                >
                  <MessageCircle size={14} color="#25D366" />
                  Top Up Kuota (WA)
                </a>
              </div>
            </div>
          )}
        </div>

        {/* User profile footer */}
        <div className="sidebar-footer">
          {user?.authenticated ? (
            <>
              <div className="user-profile-box">
                <div className="user-avatar">{getInitials(user.email)}</div>
                {!isCollapsed && (
                  <div className="user-details">
                    <span className="user-name" title={user.email}>
                      {user.email?.split('@')[0]}
                    </span>
                    <span className="user-quota-badge">
                      <Zap size={12} /> {user.quota ?? 0} Kuota
                    </span>
                  </div>
                )}
              </div>
              {!isCollapsed && (
                <a
                  href="/auth/logout"
                  className="btn btn-ghost btn-sm"
                  style={{ justifyContent: 'flex-start', color: 'var(--danger)' }}
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </a>
              )}
            </>
          ) : (
            <a href="/auth/google/login" className="btn btn-primary btn-sm" style={{ width: '100%' }}>
              {!isCollapsed ? 'Sign In with Google' : 'Login'}
            </a>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-wrapper">
        {/* Sticky Top Header */}
        <header className="top-header">
          <div className="header-left">
            <button
              onClick={() => setIsMobileOpen(!isMobileOpen)}
              className="btn btn-ghost btn-icon"
              style={{ display: 'none' }}
              id="mobile-menu-btn"
            >
              <Menu size={20} />
            </button>
            <div className="breadcrumb-trail">
              <span>Workspace</span>
              <span>/</span>
              <span className="active">
                {activeTab === 'overview' && 'Dashboard Overview'}
                {activeTab === 'sessions' && 'My Retrospectives'}
                {activeTab === 'admin' && 'Superadmin Command Center'}
              </span>
            </div>
          </div>

          <div className="header-search">
            <Search size={16} className="header-search-icon" />
            <input
              type="text"
              placeholder="Search sessions or ID..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>

          <div className="header-right">
            <button
              onClick={toggleTheme}
              className="btn btn-ghost btn-icon"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              onClick={onOpenNewSessionModal}
              className="btn btn-primary"
              id="header-create-session-btn"
            >
              <Plus size={16} />
              <span>New Session</span>
            </button>
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="page-container">{children}</main>
      </div>
    </div>
  );
};
