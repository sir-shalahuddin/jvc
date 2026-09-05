import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Users,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  FileDown,
  CheckSquare,
  Keyboard,
  Share2,
  Sun,
  Moon,
  ChevronDown,
  Wrench,
  Palette,
} from 'lucide-react';
import type { PresenceUser } from '../../types/session';
import { SoundFX } from '../../services/soundEngine';
import { useToast } from '../common/Toast';

interface SessionTopbarProps {
  sessionName: string;
  isModerator: boolean;
  participants: PresenceUser[];
  presenceCount: number;
  timerSeconds: number;
  timerRunning: boolean;
  onStartTimer: (seconds: number) => void;
  onResetTimer: () => void;
  remainingVotes: number;
  onOpenActionItems: () => void;
  onOpenShortcuts: () => void;
  onExportPdf: () => void;
  sessionId: string;
}

export const SessionTopbar: React.FC<SessionTopbarProps> = ({
  sessionName,
  isModerator,
  participants,
  presenceCount,
  timerSeconds,
  timerRunning,
  onStartTimer,
  onResetTimer,
  remainingVotes,
  onOpenActionItems,
  onOpenShortcuts,
  onExportPdf,
  sessionId,
}) => {
  const { showToast } = useToast();
  const [isPresenceOpen, setIsPresenceOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isSoundMuted, setIsSoundMuted] = useState(SoundFX.muted);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [uiStyle, setUiStyle] = useState<'brutalist' | 'modern'>('brutalist');

  // Input fields for MM:SS
  const [minutesInput, setMinutesInput] = useState('05');
  const [secondsInput, setSecondsInput] = useState('00');

  useEffect(() => {
    const saved =
      (localStorage.getItem('theme') as 'light' | 'dark') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(saved);

    const savedStyle =
      (localStorage.getItem('ui_theme_style') as 'brutalist' | 'modern') || 'brutalist';
    setUiStyle(savedStyle);
  }, []);

  useEffect(() => {
    if (timerRunning) {
      const m = Math.floor(Math.max(0, timerSeconds) / 60);
      const s = Math.max(0, timerSeconds) % 60;
      setMinutesInput(String(m).padStart(2, '0'));
      setSecondsInput(String(s).padStart(2, '0'));
    }
  }, [timerSeconds, timerRunning]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const toggleUiStyle = () => {
    const next = uiStyle === 'brutalist' ? 'modern' : 'brutalist';
    setUiStyle(next);
    localStorage.setItem('ui_theme_style', next);
    document.documentElement.setAttribute('data-ui-style', next);
    showToast(`Switched theme to ${next === 'brutalist' ? 'Neo-Brutalist' : 'Modern SaaS'}`, 'info');
  };

  const handleCopyInvite = () => {
    const url = `${window.location.origin}/session/?id=${encodeURIComponent(sessionId)}`;
    navigator.clipboard.writeText(url);
    showToast('Participant invite link copied to clipboard!', 'success');
  };

  const handleTimerStartClick = () => {
    const m = parseInt(minutesInput, 10) || 0;
    const s = parseInt(secondsInput, 10) || 0;
    const total = m * 60 + s;
    onStartTimer(total > 0 ? total : 300);
  };

  const handleSoundToggle = () => {
    const muted = SoundFX.toggle();
    setIsSoundMuted(muted);
    showToast(muted ? 'Sound FX Muted' : 'Sound FX Enabled', 'info');
  };

  const isPanic = timerRunning && timerSeconds <= 10 && timerSeconds > 0;

  return (
    <header className="session-topbar">
      {/* Topbar Left: Exit, Title, Role, Presence */}
      <div className="session-topbar-left">
        <a href="/dashboard" className="topbar-exit-btn" title="Return to Dashboard">
          <ArrowLeft size={14} />
          <span className="topbar-text-desktop">Exit</span>
        </a>

        <div className="topbar-title-box">
          <h1 className="session-name-title" title={sessionName}>
            {sessionName || 'Loading Session...'}
          </h1>
          <span className={`role-pill ${isModerator ? 'moderator' : 'participant'}`}>
            {isModerator ? 'Facilitator' : 'Participant'}
          </span>
        </div>

        {/* Presence Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="presence-btn"
            onClick={() => setIsPresenceOpen(!isPresenceOpen)}
            title="Active participants online"
          >
            <span className="pulse-dot" />
            <Users size={14} />
            <span className="presence-count-text">{presenceCount}</span>
            <span className="topbar-text-desktop">Online</span>
            <ChevronDown size={12} />
          </button>

          {isPresenceOpen && (
            <div className="presence-dropdown-menu">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  paddingBottom: '0.4rem',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <span>ONLINE PARTICIPANTS</span>
                <span className="badge badge-success">{presenceCount}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '200px', overflowY: 'auto' }}>
                {participants.length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Connecting...</span>
                ) : (
                  participants.map((p) => (
                    <div key={p.id} className="presence-user-row">
                      <span>{p.name}</span>
                      <span className={`role-pill ${p.role === 'moderator' ? 'moderator' : 'participant'}`}>
                        {p.role === 'moderator' ? 'HOST' : 'MEMBER'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Topbar Right: Timer, Votes, Tools, Theme, Invite */}
      <div className="session-topbar-right">
        {/* Countdown Timer Widget */}
        <div className={`timer-widget ${isPanic ? 'panic-mode' : ''}`}>
          <span>⏱</span>
          <div className="timer-digits-wrapper">
            <input
              type="text"
              className="timer-input"
              maxLength={2}
              value={minutesInput}
              readOnly={!isModerator || timerRunning}
              onChange={(e) => setMinutesInput(e.target.value)}
              title={isModerator ? 'Minutes (MM)' : 'Remaining Minutes'}
            />
            <span>:</span>
            <input
              type="text"
              className="timer-input"
              maxLength={2}
              value={secondsInput}
              readOnly={!isModerator || timerRunning}
              onChange={(e) => setSecondsInput(e.target.value)}
              title={isModerator ? 'Seconds (SS)' : 'Remaining Seconds'}
            />
          </div>

          {isModerator && !timerRunning && (
            <button
              onClick={handleTimerStartClick}
              className="btn btn-ghost btn-sm"
              style={{ padding: '2px 6px', color: 'var(--primary)' }}
              title="Start Timer Countdown"
            >
              <Play size={12} fill="currentColor" />
            </button>
          )}

          {isModerator && timerRunning && (
            <button
              onClick={onResetTimer}
              className="btn btn-ghost btn-sm"
              style={{ padding: '2px 6px', color: 'var(--danger)' }}
              title="Reset Timer"
            >
              <RotateCcw size={12} />
            </button>
          )}
        </div>

        {/* Remaining Vote Budget Badge */}
        <div className="vote-budget-badge" title="Remaining dot-voting budget for this session">
          <span>🎯</span>
          <span>
            {remainingVotes}/5<span className="topbar-text-desktop"> Votes</span>
          </span>
        </div>

        {/* Tools Dropdown Menu */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setIsToolsOpen(!isToolsOpen)}
            title="Session Tools & Utilities"
          >
            <Wrench size={14} />
            <span className="topbar-text-desktop">Tools</span>
            <ChevronDown size={12} />
          </button>

          {isToolsOpen && (
            <div
              className="presence-dropdown-menu"
              style={{ right: 0, left: 'auto', width: '220px' }}
              onClick={() => setIsToolsOpen(false)}
            >
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'flex-start', width: '100%', gap: '0.6rem' }}
                onClick={onOpenActionItems}
              >
                <CheckSquare size={16} color="var(--primary)" />
                <span>Action Items</span>
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'flex-start', width: '100%', gap: '0.6rem' }}
                onClick={onExportPdf}
              >
                <FileDown size={16} color="var(--info)" />
                <span>Export PDF Summary</span>
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'flex-start', width: '100%', gap: '0.6rem' }}
                onClick={toggleUiStyle}
                title="Toggle between Neo-Brutalist and Modern SaaS design"
              >
                <Palette size={16} color="var(--primary)" />
                <span>Theme: {uiStyle === 'brutalist' ? 'Neo-Brutalist' : 'Modern SaaS'}</span>
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'flex-start', width: '100%', gap: '0.6rem' }}
                onClick={handleSoundToggle}
              >
                {isSoundMuted ? <VolumeX size={16} color="var(--danger)" /> : <Volume2 size={16} color="var(--success)" />}
                <span>{isSoundMuted ? 'Sound FX (Muted)' : 'Sound FX (On)'}</span>
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'flex-start', width: '100%', gap: '0.6rem' }}
                onClick={onOpenShortcuts}
              >
                <Keyboard size={16} color="var(--text-muted)" />
                <span>Keyboard Hotkeys (?)</span>
              </button>
            </div>
          )}
        </div>

        {/* UI Style Selector (Desktop only, mobile users can access via Tools menu) */}
        <button
          type="button"
          onClick={toggleUiStyle}
          className="btn btn-secondary btn-sm topbar-desktop-only"
          title={`Switch Design Theme: Neo-Brutalist or Modern SaaS (Current: ${
            uiStyle === 'brutalist' ? 'Neo-Brutalist' : 'Modern SaaS'
          })`}
          style={{ gap: '0.45rem', fontSize: '0.78rem' }}
        >
          <Palette size={14} />
          <span>{uiStyle === 'brutalist' ? 'Neo-Brutalist' : 'Modern SaaS'}</span>
        </button>

        {/* Theme Switcher Button */}
        <button
          onClick={toggleTheme}
          className="btn btn-ghost btn-icon btn-sm"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Copy Invite Link */}
        <button onClick={handleCopyInvite} className="btn btn-primary btn-sm" title="Share invite link with your team">
          <Share2 size={14} />
          <span className="topbar-text-desktop">Invite</span>
        </button>
      </div>
    </header>
  );
};
