import React from 'react';
import { X } from 'lucide-react';
import type { AgentState } from '@shared/types';
import { StatusIndicator } from '../common/StatusIndicator';

interface TerminalTabBarProps {
  agents: AgentState[];
  activeAgentId: string | null;
  onTabSelect: (agentId: string) => void;
  onTabClose: (agentId: string) => void;
}

export const TerminalTabBar: React.FC<TerminalTabBarProps> = ({
  agents,
  activeAgentId,
  onTabSelect,
  onTabClose,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        height: 'var(--tab-height)',
        backgroundColor: 'var(--color-bg-crust)',
        borderBottom: '1px solid var(--color-border-default)',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {agents.map((agent) => {
        const isActive = agent.id === activeAgentId;
        return (
          <div
            key={agent.id}
            onClick={() => onTabSelect(agent.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              padding: '0 var(--space-3)',
              minWidth: 'var(--tab-min-width)',
              maxWidth: 'var(--tab-max-width)',
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer',
              backgroundColor: isActive ? 'var(--color-bg-base)' : 'transparent',
              borderRight: '1px solid var(--color-border-default)',
              color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              position: 'relative',
            }}
          >
            <StatusIndicator status={agent.status} size={6} />
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}
            >
              {agent.name}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(agent.id);
              }}
              style={{
                padding: 2,
                color: 'var(--color-text-tertiary)',
                cursor: 'pointer',
                opacity: 0,
                transition: `opacity var(--duration-fast)`,
                background: 'none',
                border: 'none',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = '0';
              }}
            >
              <X size={12} />
            </button>
            {isActive && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  backgroundColor: 'var(--color-accent-blue)',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
