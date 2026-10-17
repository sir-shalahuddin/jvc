import React, { useEffect, useState } from 'react';
import { Menu } from '../common/Menu';
import type { TimerState } from '../../types/session';

const PRESETS = [3, 5, 10, 15];

export function formatClock(total: number): string {
  const s = Math.max(0, Math.floor(total));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Seconds left, computed from the server end time and the server clock offset. */
export function useTimerSeconds(timer: TimerState, clockOffset: number): number {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!timer.running) return;
    const id = window.setInterval(() => tick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [timer.running]);
  if (!timer.running || !timer.end_time_unix_ms) return timer.remaining_seconds;
  return Math.max(0, Math.ceil((timer.end_time_unix_ms - (Date.now() + clockOffset)) / 1000));
}

interface Props {
  timer: TimerState;
  seconds: number;
  isOwner: boolean;
  onStart: (seconds: number) => void;
  onStop: () => void;
}

// Visible while running, or always to the owner. The owner gets a compact menu.
export const SessionTimer: React.FC<Props> = ({ timer, seconds, isOwner, onStart, onStop }) => {
  if (!timer.running && !isOwner) return null;
  const ending = timer.running && seconds <= 10;
  const label = timer.running ? `Sisa waktu ${formatClock(seconds)}` : 'Timer';

  if (!isOwner) {
    return (
      <span className={`timer ${ending ? 'is-ending' : ''}`} aria-label={label} role="timer">
        {formatClock(seconds)}
      </span>
    );
  }

  return (
    <Menu
      label="Timer"
      trigger={(p) => (
        <button
          type="button"
          {...p}
          className={`timer timer-btn ${timer.running ? 'is-running' : ''} ${ending ? 'is-ending' : ''}`}
          aria-label={`${label}, atur timer`}
          title="Atur timer (T)"
        >
          {formatClock(seconds)}
        </button>
      )}
    >
      {(close) =>
        timer.running ? (
          <>
            <button
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => {
                close();
                onStop();
              }}
            >
              Hentikan timer
            </button>
            <div className="menu-sep" />
            <div className="menu-label">Mulai ulang</div>
            {PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                role="menuitem"
                className="menu-item"
                onClick={() => {
                  close();
                  onStart(m * 60);
                }}
              >
                {m} menit
              </button>
            ))}
          </>
        ) : (
          <>
            <div className="menu-label">Mulai timer</div>
            {PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                role="menuitem"
                className="menu-item"
                onClick={() => {
                  close();
                  onStart(m * 60);
                }}
              >
                {m} menit
              </button>
            ))}
          </>
        )
      }
    </Menu>
  );
};
