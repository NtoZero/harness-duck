import React from 'react';
import type { AgentStatus, TokenUsage } from '@shared/types';
import { StatusIndicator } from '../common/StatusIndicator';

interface TerminalStatusBarProps {
  status: AgentStatus;
  tokenUsage: TokenUsage;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export const TerminalStatusBar: React.FC<TerminalStatusBarProps> = ({ status, tokenUsage }) => {
  return (
    <div
      style={{
        height: 24,
        backgroundColor: 'var(--color-bg-crust)',
        borderTop: '1px solid var(--color-border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-3)',
        fontSize: 'var(--font-size-xs)',
        color: 'var(--color-text-tertiary)',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <StatusIndicator status={status} size={6} showLabel />
      </div>
      <div>
        Tokens: {formatTokens(tokenUsage.input)} in / {formatTokens(tokenUsage.output)} out
      </div>
    </div>
  );
};
