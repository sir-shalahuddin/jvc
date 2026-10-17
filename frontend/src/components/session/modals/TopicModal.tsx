import React, { useEffect, useState } from 'react';
import { Modal } from '../../common/Modal';
import type { Question } from '../../../types/session';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  questionToEdit: Question | null;
  onSave: (text: string) => Promise<boolean>;
}

const SUGGESTIONS = ['Apa yang berjalan baik?', 'Apa yang perlu diperbaiki?', 'Ide untuk sprint berikutnya'];

export const TopicModal: React.FC<Props> = ({ isOpen, onClose, questionToEdit, onSave }) => {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setText(questionToEdit?.text || '');
  }, [isOpen, questionToEdit]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || saving) return;
    setSaving(true);
    const ok = await onSave(text.trim());
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={questionToEdit ? 'Ubah topik' : 'Tambah topik'}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Batal
          </button>
          <button type="button" className="btn primary" onClick={() => void submit()} disabled={saving || !text.trim()}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        <div className="fgroup">
          <label htmlFor="topic-text">Pertanyaan atau judul kolom</label>
          <input
            id="topic-text"
            className="inp"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Apa yang berjalan baik?"
            maxLength={200}
          />
        </div>
        {!questionToEdit && (
          <div className="chips">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="chip" aria-pressed={text === s} onClick={() => setText(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
      </form>
    </Modal>
  );
};
