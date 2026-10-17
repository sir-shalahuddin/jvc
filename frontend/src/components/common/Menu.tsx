import React, { useEffect, useRef, useState } from 'react';

interface MenuProps {
  /** Renders the trigger. Spread `props` onto a <button>. */
  trigger: (props: {
    onClick: () => void;
    'aria-expanded': boolean;
    'aria-haspopup': 'menu';
  }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: 'left' | 'right';
  label: string;
  className?: string;
}

// Small dropdown. Closes on outside click, Esc, or after an item runs.
export const Menu: React.FC<MenuProps> = ({ trigger, children, align = 'right', label, className = '' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className={`menu-wrap ${className}`} ref={ref}>
      {trigger({ onClick: () => setOpen((o) => !o), 'aria-expanded': open, 'aria-haspopup': 'menu' })}
      {open && (
        <div className={`menu ${align === 'left' ? 'left' : ''}`} role="menu" aria-label={label}>
          {children(close)}
        </div>
      )}
    </div>
  );
};
