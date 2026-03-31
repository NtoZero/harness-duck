import React from 'react';
import type { AgentState } from '@shared/types';
import { AgentAvatar } from '../common/AgentAvatar';

interface MentionAutocompleteProps {
  query: string;
  agents: AgentState[];
  isVisible: boolean;
  onSelect: (agentName: string) => void;
}

export const MentionAutocomplete: React.FC<MentionAutocompleteProps> = ({
  query,
  agents,
  isVisible,
  onSelect,
}) => {
  if (!isVisible) return null;

  const lowerQuery = query.toLowerCase();
  const allOption = { name: 'all', label: '전체' };
  const filtered = [
    ...agents
      .filter((a) => a.name.toLowerCase().includes(lowerQuery))
      .map((a, i) => ({ name: a.name, agent: a, index: i })),
  ];
  const showAll = 'all'.includes(lowerQuery) || '전체'.includes(lowerQuery);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        right: 0,
        backgroundColor: 'var(--color-bg-surface0)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--border-radius-md)',
        boxShadow: 'var(--shadow-md)',
        zIndex: 'var(--z-dropdown)' as unknown as number,
        maxHeight: 200,
        overflowY: 'auto',
      }}
    >
      {filtered.map(({ name, agent, index }) => (
        <button
          key={name}
          onClick={() => onSelect(name)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            width: '100%',
            padding: 'var(--space-2) var(--space-3)',
            fontSize: 'var(--font-size-sm)',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            color: 'var(--color-text-primary)',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-surface1)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
          }}
        >
          <AgentAvatar name={name} status={agent.status} size="sm" colorIndex={index} />
          <span>@{name}</span>
        </button>
      ))}
      {showAll && (
        <button
          onClick={() => onSelect(allOption.name)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            width: '100%',
            padding: 'var(--space-2) var(--space-3)',
            fontSize: 'var(--font-size-sm)',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            color: 'var(--color-text-primary)',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-surface1)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
          }}
        >
          <span style={{ width: 24, textAlign: 'center', fontSize: 'var(--font-size-sm)' }}>@</span>
          <span>@all ({allOption.label})</span>
        </button>
      )}
      {filtered.length === 0 && !showAll && (
        <div style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
          일치하는 에이전트 없음
        </div>
      )}
    </div>
  );
};
