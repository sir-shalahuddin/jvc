import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import type { ActionItem, PreviousActions as Prev } from '../../types/session';

interface Props {
  data: Prev;
  canEdit: boolean;
  /** Returns true when the server accepted the change (the page then updates `data`). */
  onToggle: (item: ActionItem, completed: boolean) => Promise<boolean>;
  isOpen: boolean;
  onClose: () => void;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Number of promises from last time that are still open; null when there is nothing to show. */
export function openPromises(data: Prev | null): number | null {
  if (!data?.session || data.items.length === 0) return null;
  return data.items.filter((i) => !i.completed).length;
}

// "Janji sesi lalu": open action items from the owner's previous session, in a dialog
// opened from the topic "⋯" menu.
export const PreviousActions: React.FC<Props> = ({ data, canEdit, onToggle, isOpen, onClose }) => {
  const [busy, setBusy] = useState<string | null>(null);
  if (!data.session || data.items.length === 0) return null;
  const left = data.items.filter((i) => !i.completed).length;
  const when = `${data.session.name}${fmtDate(data.session.created_at) ? `, ${fmtDate(data.session.created_at)}` : ''}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Janji sesi lalu" maxWidth="520px">
      <p className="help prev-when">
        {left} belum selesai · {when}
      </p>
      <ul className="act-list prev-list">
        {data.items.map((it) => {
          const assignee = it.assignee && it.assignee !== 'Unassigned' ? it.assignee : '';
          return (
            <li key={it.id} className={it.completed ? 'is-done' : ''}>
              {canEdit ? (
                <input
                  type="checkbox"
                  checked={it.completed}
                  disabled={busy === it.id}
                  aria-label={`Tandai selesai: ${it.text}`}
                  onChange={async (e) => {
                    setBusy(it.id);
                    await onToggle(it, e.target.checked);
                    setBusy(null);
                  }}
                />
              ) : (
                <span className="act-state">{it.completed ? 'Selesai' : 'Belum'}</span>
              )}
              <div className="act-body">
                <span className="act-t">{it.text}</span>
                {assignee && <span className="act-meta">{assignee}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
};
