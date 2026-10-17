import React from 'react';
import { ArrowLeft, MoreHorizontal } from 'lucide-react';
import { Menu } from '../common/Menu';
import { PhasePicker, PhaseStepper } from './PhaseStepper';
import { SessionTimer } from './SessionTimer';
import type { Phase, Presence, TimerState } from '../../types/session';
import { useUiStyle } from '../../services/uiStyle';

interface Props {
  isMobile: boolean;
  title: string;
  phase: Phase;
  isOwner: boolean;
  phaseBusy: boolean;
  onPhase: (p: Phase) => void;
  timer: TimerState;
  timerSeconds: number;
  onTimerStart: (s: number) => void;
  onTimerStop: () => void;
  presence: Presence;
  onOpenPresence: () => void;
  onInvite: () => void;
  canExport: boolean;
  onExport: () => void;
  summaryHref: string | null;
  onShortcuts: () => void;
  offline: boolean;
}

function PresenceList({ presence }: { presence: Presence }) {
  const list = presence.participants || [];
  return (
    <>
      <div className="menu-label">{presence.count} orang di sesi ini</div>
      {list.length === 0 ? (
        <div className="menu-item muted">Belum ada data</div>
      ) : (
        <ul className="presence-list">
          {list.map((p) => (
            <li key={p.id}>
              <span>{p.name || 'Tanpa nama'}</span>
              {p.role === 'moderator' && <span className="muted">fasilitator</span>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export { PresenceList };

export const SessionHeader: React.FC<Props> = (p) => {
  const people = `${p.presence.count || 1} orang`;
  const [uiStyle, toggleUiStyle] = useUiStyle();

  const moreMenu = (
    <Menu
      label="Menu sesi"
      trigger={(t) => (
        <button type="button" {...t} className="icon-btn" aria-label="Menu lainnya" title="Menu lainnya">
          <MoreHorizontal size={18} />
        </button>
      )}
    >
      {(close) => (
        <>
          {p.isMobile && (
            <>
              <button type="button" role="menuitem" className="menu-item" onClick={() => (close(), p.onInvite())}>
                Undang
                <span className="hint">salin link</span>
              </button>
              <button type="button" role="menuitem" className="menu-item" onClick={() => (close(), p.onOpenPresence())}>
                {people}
              </button>
              <div className="menu-sep" />
            </>
          )}
          {p.canExport && (
            <button type="button" role="menuitem" className="menu-item" onClick={() => (close(), p.onExport())}>
              Export PDF
            </button>
          )}
          {p.summaryHref ? (
            <a role="menuitem" className="menu-item" href={p.summaryHref} target="_blank" rel="noopener" onClick={close}>
              Ringkasan
              <span className="hint">tab baru</span>
            </a>
          ) : (
            <button type="button" role="menuitem" className="menu-item" disabled title="Ringkasan tersedia setelah fase Tulis">
              Ringkasan
              <span className="hint">setelah Tulis</span>
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => (close(), toggleUiStyle())}
            title={uiStyle === 'brutalist' ? 'Ganti ke tampilan Modern' : 'Ganti ke tampilan Brutalist'}
          >
            <span>
              Tampilan:{' '}
              {uiStyle === 'brutalist' ? (
                <>
                  <b>Brutalist</b> / Modern
                </>
              ) : (
                <>
                  Brutalist / <b>Modern</b>
                </>
              )}
            </span>
          </button>
          {!p.isMobile && (
            <button type="button" role="menuitem" className="menu-item" onClick={() => (close(), p.onShortcuts())}>
              Shortcut
              <kbd>?</kbd>
            </button>
          )}
        </>
      )}
    </Menu>
  );

  const timer = (
    <SessionTimer
      timer={p.timer}
      seconds={p.timerSeconds}
      isOwner={p.isOwner}
      onStart={p.onTimerStart}
      onStop={p.onTimerStop}
    />
  );

  if (p.isMobile) {
    return (
      <header className="sh sh-m">
        <a href="/dashboard" className="icon-btn" aria-label="Kembali ke dashboard">
          <ArrowLeft size={18} />
        </a>
        <h1 className="sh-title" title={p.title}>
          {p.title}
        </h1>
        <PhasePicker phase={p.phase} isOwner={p.isOwner} busy={p.phaseBusy} onChange={p.onPhase} />
        {timer}
        {moreMenu}
        {p.offline && <p className="sh-offline">Koneksi terputus, mencoba lagi…</p>}
      </header>
    );
  }

  return (
    <header className="sh">
      <a href="/dashboard" className="icon-btn sh-back" aria-label="Kembali ke dashboard" title="Kembali ke dashboard">
        <ArrowLeft size={18} />
      </a>
      <div className="sh-name">
        <h1 className="sh-title" title={p.title}>
          {p.title}
        </h1>
        <Menu
          label="Peserta"
          align="left"
          trigger={(t) => (
            <button type="button" {...t} className="sh-people">
              {people}
            </button>
          )}
        >
          {() => <PresenceList presence={p.presence} />}
        </Menu>
        {p.offline && <span className="sh-offline">Koneksi terputus, mencoba lagi…</span>}
      </div>
      <div className="sh-steps">
        <PhaseStepper phase={p.phase} isOwner={p.isOwner} busy={p.phaseBusy} onChange={p.onPhase} />
      </div>
      <div className="sh-tools">
        {timer}
        <button type="button" className="btn sm" onClick={p.onInvite} title="Salin link undangan">
          Undang
        </button>
        {moreMenu}
      </div>
    </header>
  );
};
