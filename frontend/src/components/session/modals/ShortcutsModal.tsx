import React from 'react';
import { Modal } from '../../common/Modal';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  const shortcuts = [
    { key: 'C', description: 'Open Post Reflection Card dialog' },
    { key: 'Space', description: 'Flip active reflection card (front ↔ back)' },
    { key: 'T', description: 'Start or toggle countdown timer' },
    { key: 'A', description: 'Open Sprint Action Items modal' },
    { key: 'F', description: 'Jump to facilitator spotlight card' },
    { key: '← / →', description: 'Navigate to previous or next topic' },
    { key: 'Esc', description: 'Close any open modal or dropdown' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard Hotkeys" maxWidth="480px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
          Speed up your sprint retrospective workflow with native hotkey triggers:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
          {shortcuts.map((s) => (
            <div
              key={s.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-card)',
              }}
            >
              <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                {s.description}
              </span>
              <kbd
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  boxShadow: '0 2px 0 var(--border-card)',
                }}
              >
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
};
