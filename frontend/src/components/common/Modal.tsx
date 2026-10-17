import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

// Plain dialog. Esc and the backdrop close it; focus moves into the dialog on open
// and back to the previously focused element on close.
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, maxWidth = '520px' }) => {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    // Focus the first form field if there is one, else the dialog itself.
    const t = window.setTimeout(() => {
      const el = dialogRef.current;
      if (!el) return;
      const field = el.querySelector<HTMLElement>('[data-autofocus], textarea, input:not([type=hidden])');
      (field || el).focus();
    }, 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
      if (prev && typeof prev.focus === 'function') prev.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className="dialog"
        style={{ maxWidth }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="dialog-h">
          <h2 id={titleId}>{title}</h2>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="Tutup">
            <X size={18} />
          </button>
        </div>
        <div className="dialog-b">{children}</div>
        {footer && <div className="dialog-f">{footer}</div>}
      </div>
    </div>
  );
};
