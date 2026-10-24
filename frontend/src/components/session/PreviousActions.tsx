import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Modal } from '../common/Modal';
import type { ActionItem, PreviousActions as Prev, Phase } from '../../types/session';

interface Props {
  data: Prev;
  canEdit: boolean;
  onToggle: (item: ActionItem, completed: boolean) => Promise<boolean>;
  phase: Phase;
  /** 'section': collapsible box (all-columns view). 'link': small link that opens a dialog (focus view). */
  variant?: 'section' | 'link';
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

// "Janji sesi lalu": open action items from the owner's previous session.
export const PreviousActions: React.FC<Props> = ({ data, canEdit, onToggle, phase, variant = 'section' }) => {
  const defaultOpen = variant === 'section' && phase === 'write';
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

  const list = (
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
  );

  const when = `${data.session.name}${fmtDate(data.session.created_at) ? `, ${fmtDate(data.session.created_at)}` : ''}`;

  if (variant === 'link') {
    return (
      <>
        <button
          type="button"
          className="link-btn prev-link"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          title={`${left} belum selesai dari ${data.items.length}`}
        >
          Janji sesi lalu ({left})
        </button>
        <Modal isOpen={open} onClose={() => setOpen(false)} title="Janji sesi lalu" maxWidth="520px">
          <p className="help prev-when">
            {left} belum selesai · {when}
          </p>
          {list}
        </Modal>
      </>
    );
  }

  return (
    <section className="prev" aria-label="Janji sesi lalu">
      <button type="button" className="prev-h" onClick={toggle} aria-expanded={open}>
        {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        <span className="prev-title">Janji sesi lalu</span>
        <span className="muted num">
          {left} belum selesai · {when}
        </span>
      </button>
      {open && list}
    </section>
  );
};
