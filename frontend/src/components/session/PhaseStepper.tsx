import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Menu } from '../common/Menu';
import { PHASES, PHASE_LABEL, type Phase } from '../../types/session';

interface Props {
  phase: Phase;
  isOwner: boolean;
  busy?: boolean;
  onChange: (p: Phase) => void;
}

// Desktop: the six phases in a row. Clickable for the owner, read-only progress for others.
export const PhaseStepper: React.FC<Props> = ({ phase, isOwner, busy, onChange }) => {
  const cur = PHASES.indexOf(phase);
  return (
    <nav className="stepper" aria-label="Fase sesi">
      <ol>
        {PHASES.map((p, i) => {
          const state = i === cur ? 'current' : i < cur ? 'past' : 'next';
          return (
            <li key={p} className={`step is-${state}`}>
              {isOwner ? (
                <button
                  type="button"
                  aria-current={i === cur ? 'step' : undefined}
                  disabled={busy || i === cur}
                  onClick={() => onChange(p)}
                  title={i === cur ? 'Fase sekarang' : `Pindah ke fase ${PHASE_LABEL[p]}`}
                >
                  {PHASE_LABEL[p]}
                </button>
              ) : (
                <span aria-current={i === cur ? 'step' : undefined}>{PHASE_LABEL[p]}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

// Mobile: just the current phase name. The owner taps it to pick another phase.
export const PhasePicker: React.FC<Props> = ({ phase, isOwner, busy, onChange }) => {
  if (!isOwner) {
    return (
      <span className="phase-name" aria-label={`Fase: ${PHASE_LABEL[phase]}`}>
        {PHASE_LABEL[phase]}
      </span>
    );
  }
  return (
    <Menu
      label="Pilih fase"
      trigger={(p) => (
        <button type="button" {...p} className="phase-name phase-btn" disabled={busy} aria-label={`Fase: ${PHASE_LABEL[phase]}, ganti fase`}>
          {PHASE_LABEL[phase]}
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="menu-label">Ganti fase</div>
          {PHASES.map((p, i) => (
            <button
              key={p}
              type="button"
              role="menuitem"
              className="menu-item"
              aria-current={p === phase ? 'true' : undefined}
              onClick={() => {
                close();
                if (p !== phase) onChange(p);
              }}
            >
              <span>{PHASE_LABEL[p]}</span>
              <span className="hint">{p === phase ? 'sekarang' : `${i + 1}`}</span>
            </button>
          ))}
        </>
      )}
    </Menu>
  );
};
