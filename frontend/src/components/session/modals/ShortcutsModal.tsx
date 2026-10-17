import React from 'react';
import { Modal } from '../../common/Modal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isOwner: boolean;
}

// Only keys that the board actually handles (see SessionBoardPage keydown handler).
export const ShortcutsModal: React.FC<Props> = ({ isOpen, onClose, isOwner }) => {
  const rows: Array<[string, string]> = [
    ['?', 'Buka daftar ini'],
    ['Esc', 'Tutup jendela atau menu'],
    ['C', 'Tulis kartu di topik aktif (fase Tulis)'],
    ['Ctrl + Enter', 'Kirim kartu dari jendela tulis'],
    ['← / →', 'Pindah topik'],
    ['F', 'Lompat ke kartu yang sedang dibahas'],
  ];
  if (isOwner) rows.push(['T', 'Mulai atau hentikan timer (5 menit)']);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Shortcut" maxWidth="440px">
      <dl className="keys">
        {rows.map(([k, d]) => (
          <div key={k} className="keys-row">
            <dt>
              <kbd>{k}</kbd>
            </dt>
            <dd>{d}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
};
