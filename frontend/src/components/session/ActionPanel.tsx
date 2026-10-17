import React, { useEffect, useRef, useState } from 'react';
import type { ActionItem } from '../../types/session';

export interface ActionDraft {
  text: string;
  answerId?: string;
  nonce: number;
}

interface Props {
  items: ActionItem[];
  loaded: boolean;
  canEdit: boolean;
  draft: ActionDraft | null;
  onAdd: (text: string, assignee: string, due: string, answerId?: string) => Promise<boolean>;
  onToggle: (item: ActionItem, completed: boolean) => Promise<void>;
  onDelete: (item: ActionItem) => Promise<void>;
}

// Server fills empty fields with these English defaults; don't show them.
function who(item: ActionItem) {
  const a = (item.assignee || '').trim();
  return a && a !== 'Unassigned' ? a : '';
}
function when(item: ActionItem) {
  const d = (item.due_date || '').trim();
  if (!d) return '';
  if (d === 'Next Sprint') return 'sprint berikutnya';
  return d;
}

// Inline action items for the discuss phase (read-only in `done` and for participants).
export const ActionPanel: React.FC<Props> = ({ items, loaded, canEdit, draft, onAdd, onToggle, onDelete }) => {
  const [text, setText] = useState('');
  const [assignee, setAssignee] = useState('');
  const [due, setDue] = useState('');
  const [answerId, setAnswerId] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  // A card was turned into an action: prefill the form and focus it.
  useEffect(() => {
    if (!draft) return;
    setText(draft.text);
    setAnswerId(draft.answerId);
    panelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    window.setTimeout(() => textRef.current?.focus(), 50);
  }, [draft]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || saving) return;
    setSaving(true);
    const ok = await onAdd(text.trim(), assignee.trim(), due.trim(), answerId);
    setSaving(false);
    if (ok) {
      setText('');
      setAssignee('');
      setDue('');
      setAnswerId(undefined);
      textRef.current?.focus();
    }
  };

  const open = items.filter((i) => !i.completed).length;

  return (
    <section className="panel" ref={panelRef} aria-labelledby="actions-h">
      <div className="panel-h">
        <h2 id="actions-h">Aksi</h2>
        {loaded && (
          <span className="muted num">
            {items.length === 0 ? 'belum ada' : `${open} terbuka dari ${items.length}`}
          </span>
        )}
      </div>

      {canEdit && (
        <form className="act-form" onSubmit={submit}>
          <input
            ref={textRef}
            className="inp act-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Apa yang akan dilakukan?"
            aria-label="Aksi"
            maxLength={300}
          />
          <input
            className="inp act-who"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            placeholder="Siapa"
            aria-label="Penanggung jawab"
            maxLength={60}
          />
          <input
            className="inp act-due"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            placeholder="Kapan"
            aria-label="Tenggat"
            maxLength={40}
          />
          <button type="submit" className="btn primary" disabled={saving || !text.trim()}>
            {saving ? 'Menyimpan…' : 'Tambah'}
          </button>
        </form>
      )}

      {!loaded ? (
        <p className="muted small">Memuat aksi…</p>
      ) : items.length === 0 ? (
        <p className="muted small">{canEdit ? 'Belum ada aksi. Tulis di atas, atau pilih "Jadikan aksi" di kartu.' : 'Belum ada aksi.'}</p>
      ) : (
        <ul className="act-list">
          {items.map((it) => {
            const meta = [who(it), when(it)].filter(Boolean).join(' · ');
            return (
              <li key={it.id} className={it.completed ? 'is-done' : ''}>
                {canEdit ? (
                  <input
                    type="checkbox"
                    checked={it.completed}
                    disabled={busy === it.id}
                    onChange={async (e) => {
                      setBusy(it.id);
                      await onToggle(it, e.target.checked);
                      setBusy(null);
                    }}
                    aria-label={`Tandai selesai: ${it.text}`}
                  />
                ) : (
                  <span className="act-state">{it.completed ? 'Selesai' : 'Belum'}</span>
                )}
                <div className="act-body">
                  <span className="act-t">{it.text}</span>
                  {meta && <span className="act-meta">{meta}</span>}
                </div>
                {canEdit && (
                  <button
                    type="button"
                    className="link-btn danger"
                    disabled={busy === it.id}
                    onClick={async () => {
                      if (!window.confirm('Hapus aksi ini?')) return;
                      setBusy(it.id);
                      await onDelete(it);
                      setBusy(null);
                    }}
                  >
                    Hapus
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
