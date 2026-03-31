import React from 'react';
import type { AgentStatus } from '@shared/types';
import { StatusIndicator } from './StatusIndicator';

interface AgentAvatarProps {
  name: string;
  status: AgentStatus;
  size?: 'sm' | 'md' | 'lg';
  colorIndex?: number;
}

const SIZES = { sm: 24, md: 32, lg: 40 } as const;

export const AgentAvatar: React.FC<AgentAvatarProps> = ({
  name,
  status,
  size = 'md',
  colorIndex = 0,
}) => {
  const px = SIZES[size];
  const initial = name.charAt(0).toUpperCase();
  const agentColor = `var(--color-agent-${colorIndex % 8})`;

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <div
        style={{
          width: px,
          height: px,
          borderRadius: 'var(--border-radius-full)',
          backgroundColor: agentColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: px * 0.4,
          fontWeight: 'var(--font-weight-semibold)' as unknown as number,
          color: 'var(--color-text-inverse)',
        }}
      >
        {initial}
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: -1,
          right: -1,
        }}
      >
        <StatusIndicator status={status} size={size === 'sm' ? 6 : 8} />
      </div>
    </div>
  );
};
