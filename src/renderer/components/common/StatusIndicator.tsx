import React from 'react';
import type { AgentStatus } from '@shared/types';

interface StatusIndicatorProps {
  status: AgentStatus;
  size?: number;
  showLabel?: boolean;
}

const STATUS_COLORS: Record<AgentStatus, string> = {
  running: 'var(--color-status-running)',
  idle: 'var(--color-status-idle)',
  waiting_approval: 'var(--color-status-waiting)',
  error: 'var(--color-status-error)',
};

const STATUS_LABELS: Record<AgentStatus, string> = {
  running: 'Running',
  idle: 'Idle',
  waiting_approval: 'Waiting',
  error: 'Error',
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  size = 8,
  showLabel = false,
}) => {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
      <span
        style={{
          width: size,
          height: size,
          borderRadius: 'var(--border-radius-full)',
          backgroundColor: STATUS_COLORS[status],
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
      {showLabel && (
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
          {STATUS_LABELS[status]}
        </span>
      )}
    </span>
  );
};
