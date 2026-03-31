import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

const TYPE_COLORS = {
  approval: 'var(--color-notify-warning)',
  message: 'var(--color-notify-info)',
  warning: 'var(--color-notify-warning)',
  error: 'var(--color-notify-error)',
} as const;

export const NotificationStack: React.FC = () => {
  const notifications = useUIStore((s) => s.notifications);
  const removeNotification = useUIStore((s) => s.removeNotification);

  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(var(--titlebar-height) + var(--space-2))',
        right: 'var(--space-4)',
        zIndex: 'var(--z-toast)' as unknown as number,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        maxWidth: 320,
      }}
    >
      {notifications.map((n) => (
        <NotificationToast
          key={n.id}
          id={n.id}
          type={n.type}
          title={n.title}
          body={n.body}
          actions={n.actions}
          autoHideMs={n.autoHideMs}
          onDismiss={() => removeNotification(n.id)}
        />
      ))}
    </div>
  );
};

interface ToastProps {
  id: string;
  type: 'approval' | 'message' | 'warning' | 'error';
  title: string;
  body: string;
  actions?: { label: string; onClick: () => void }[];
  autoHideMs?: number;
  onDismiss: () => void;
}

const NotificationToast: React.FC<ToastProps> = ({
  type,
  title,
  body,
  actions,
  autoHideMs = 5000,
  onDismiss,
}) => {
  useEffect(() => {
    if (autoHideMs > 0) {
      const timer = setTimeout(onDismiss, autoHideMs);
      return () => clearTimeout(timer);
    }
  }, [autoHideMs, onDismiss]);

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-surface0)',
        border: '1px solid var(--color-border-default)',
        borderLeft: `3px solid ${TYPE_COLORS[type]}`,
        borderRadius: 'var(--border-radius-xl)',
        padding: 'var(--space-3)',
        boxShadow: 'var(--shadow-md)',
        animation: `slideIn var(--duration-slow) var(--easing-spring)`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontWeight: 'var(--font-weight-semibold)' as unknown as number, fontSize: 'var(--font-size-sm)' }}>
          {title}
        </div>
        <button
          onClick={onDismiss}
          style={{
            padding: 'var(--space-1)',
            color: 'var(--color-text-tertiary)',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
          }}
        >
          <X size={14} />
        </button>
      </div>
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
        {body}
      </div>
      {actions && actions.length > 0 && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-accent-blue)',
                padding: 'var(--space-1) var(--space-2)',
                border: '1px solid var(--color-accent-blue)',
                borderRadius: 'var(--border-radius-sm)',
                cursor: 'pointer',
                background: 'none',
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
