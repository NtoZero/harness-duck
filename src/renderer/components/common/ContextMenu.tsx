import React, { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  shortcut?: string;
  onClick: () => void;
  divider?: boolean;
  disabled?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ items, position, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: position.y,
        left: position.x,
        zIndex: 'var(--z-context-menu)' as unknown as number,
        backgroundColor: 'var(--color-bg-surface0)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--border-radius-md)',
        boxShadow: 'var(--shadow-lg)',
        padding: 'var(--space-1) 0',
        minWidth: 180,
      }}
    >
      {items.map((item, i) =>
        item.divider ? (
          <div
            key={i}
            style={{
              height: 1,
              backgroundColor: 'var(--color-border-default)',
              margin: 'var(--space-1) 0',
            }}
          />
        ) : (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: 'var(--space-2) var(--space-3)',
              fontSize: 'var(--font-size-sm)',
              color: item.disabled ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
              cursor: item.disabled ? 'default' : 'pointer',
              backgroundColor: 'transparent',
              border: 'none',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) {
                (e.target as HTMLElement).style.backgroundColor = 'var(--color-bg-surface1)';
              }
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
                {item.shortcut}
              </span>
            )}
          </button>
        )
      )}
    </div>
  );
};
