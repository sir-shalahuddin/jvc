import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ActionItem, PreviousActions as Prev, Phase } from '../../types/session';

interface Props {
  data: Prev;
  canEdit: boolean;
  onToggle: (item: ActionItem, completed: boolean) => Promise<boolean>;
  phase: Phase;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

// "Janji sesi lalu": open action items from the owner's previous session.
export const PreviousActions: React.FC<Props> = ({ data, canEdit, onToggle, phase }) => {
  const defaultOpen = phase === 'write';
  const [open, setOpen] = useState(defaultOpen);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  // Reset open state when phase changes
  useEffect(() => {
    setOpen(defaultOpen);
  }, [phase]);

  if (!data.session || data.items.length === 0) return null;
  const left = data.items.filter((i) => !(done[i.id] ?? i.completed)).length;
  const toggle = () => {
    setOpen((o) => !o);
  };

  return (
    <section className="prev" aria-label="Janji sesi lalu">
      <button type="button" className="prev-h" onClick={toggle} aria-expanded={open}>
        {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        <span className="prev-title">Janji sesi lalu</span>
        <span className="muted num">
          {left} belum selesai · {data.session.name}
          {fmtDate(data.session.created_at) && `, ${fmtDate(data.session.created_at)}`}
        </span>
      </button>
      {open && (
        <ul className="act-list prev-list">
          {data.items.map((it) => {
            const checked = done[it.id] ?? it.completed;
            const assignee = it.assignee && it.assignee !== 'Unassigned' ? it.assignee : '';
            return (
              <li key={it.id} className={checked ? 'is-done' : ''}>
                {canEdit ? (
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={busy === it.id}
                    aria-label={`Tandai selesai: ${it.text}`}
                    onChange={async (e) => {
                      const next = e.target.checked;
                      setBusy(it.id);
                      const ok = await onToggle(it, next);
                      setBusy(null);
                      if (ok) setDone((d) => ({ ...d, [it.id]: next }));
                    }}
                  />
                ) : (
                  <span className="act-state">{checked ? 'Selesai' : 'Belum'}</span>
                )}
                <div className="act-body">
                  <span className="act-t">{it.text}</span>
                  {assignee && <span className="act-meta">{assignee}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
