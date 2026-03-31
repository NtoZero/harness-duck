import React from 'react';
import { Copy, Reply, MoreHorizontal } from 'lucide-react';

interface MessageActionsProps {
  onCopy: () => void;
  onReply: () => void;
}

/**
 * Hover-only action buttons shown on the right side of a message.
 * Appears on mouse hover via parent CSS.
 */
export const MessageActions: React.FC<MessageActionsProps> = ({ onCopy, onReply }) => {
  const buttonStyle: React.CSSProperties = {
    padding: 'var(--space-1)',
    color: 'var(--color-text-tertiary)',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    borderRadius: 'var(--border-radius-sm)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-1)',
        backgroundColor: 'var(--color-bg-surface0)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--border-radius-sm)',
        padding: '1px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <button
        onClick={onReply}
        style={buttonStyle}
        title="답장"
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-surface1)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
        }}
      >
        <Reply size={12} />
      </button>
      <button
        onClick={onCopy}
        style={buttonStyle}
        title="복사"
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-surface1)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
        }}
      >
        <Copy size={12} />
      </button>
    </div>
  );
};
