import React, { useState } from 'react';
import {
  Plus,
  AlertTriangle,
  MessageSquare,
  Folder,
  Settings,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { useAgentStore } from '../../stores/agentStore';
import { useApprovalStore } from '../../stores/approvalStore';
import { useUIStore } from '../../stores/uiStore';
import { AgentAvatar } from '../common/AgentAvatar';
import { StatusIndicator } from '../common/StatusIndicator';
import { ContextMenu, type ContextMenuItem } from '../common/ContextMenu';
import type { AgentState, SidebarNavTarget } from '@shared/types';

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export const Sidebar: React.FC = () => {
  const agents = useAgentStore((s) => s.agents);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent);
  const killAll = useAgentStore((s) => s.killAll);
  const stopAgent = useAgentStore((s) => s.stopAgent);
  const restartAgent = useAgentStore((s) => s.restartAgent);
  const pendingCount = useApprovalStore((s) => s.pending.length);
  const openModal = useUIStore((s) => s.openModal);
  const setActiveView = useUIStore((s) => s.setActiveView);

  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);
  const [hoveredNavTarget, setHoveredNavTarget] = useState<string | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    agent: AgentState;
    position: { x: number; y: number };
  } | null>(null);

  const totalTokens = agents.reduce((sum, a) => sum + (a.tokenUsage?.input ?? 0) + (a.tokenUsage?.output ?? 0), 0);
  const activeCount = agents.filter((a) => a.status === 'running').length;

  const handleContextMenu = (e: React.MouseEvent, agent: AgentState) => {
    e.preventDefault();
    setContextMenu({ agent, position: { x: e.clientX, y: e.clientY } });
  };

  const getContextMenuItems = (agent: AgentState): ContextMenuItem[] => [
    { label: '터미널 열기', onClick: () => { setActiveAgent(agent.id); setActiveView('terminal'); } },
    { label: '재시작', onClick: () => restartAgent(agent.id) },
    { label: '중지', onClick: () => stopAgent(agent.id) },
    { label: '', onClick: () => {}, divider: true },
    { label: '작업 디렉토리 열기', onClick: () => {} },
    { label: '', onClick: () => {}, divider: true },
    { label: '삭제', onClick: () => {} },
  ];

  const navItems: { target: SidebarNavTarget; icon: React.ElementType; label: string }[] = [
    { target: 'approvals', icon: ShieldAlert, label: '승인 대시보드' },
    { target: 'chat', icon: MessageSquare, label: '팀 채팅' },
    { target: 'files', icon: Folder, label: '파일 탐색기' },
    { target: 'settings', icon: Settings, label: '설정' },
  ];

  const handleNav = (target: SidebarNavTarget) => {
    if (target === 'approvals') openModal('approvalDashboard');
    else if (target === 'chat') { /* chat is always visible */ }
    else if (target === 'files') setActiveView('fileViewer');
    else if (target === 'settings') openModal('settings');
  };

  return (
    <div
      style={{
        height: '100%',
        backgroundColor: 'var(--color-bg-mantle)',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--color-border-default)',
        overflow: 'hidden',
      }}
    >
      {/* Agent List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-3)' }}>
        <div
          style={{
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-semibold)' as unknown as number,
            color: 'var(--color-text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 'var(--space-2)',
          }}
        >
          Agents
        </div>

        {agents.map((agent, index) => (
          <div
            key={agent.id}
            onClick={() => {
              setActiveAgent(agent.id);
              setActiveView('terminal');
            }}
            onContextMenu={(e) => handleContextMenu(e, agent)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-2)',
              borderRadius: 'var(--border-radius-sm)',
              cursor: 'pointer',
              backgroundColor:
                activeAgentId === agent.id
                  ? 'var(--color-bg-surface1)'
                  : hoveredAgentId === agent.id
                    ? 'var(--color-bg-surface0)'
                    : 'transparent',
              marginBottom: 'var(--space-1)',
            }}
            onMouseEnter={() => setHoveredAgentId(agent.id)}
            onMouseLeave={() => setHoveredAgentId(null)}
          >
            <AgentAvatar name={agent.name} status={agent.status} size="sm" colorIndex={index} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-medium)' as unknown as number,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {agent.name}
              </div>
              <div
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {agent.workingDirectory.split('/').pop()}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              <StatusIndicator status={agent.status} size={6} />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                {formatTokens(agent.tokenUsage?.input ?? 0)}
              </span>
            </div>
          </div>
        ))}

        <button
          onClick={() => openModal('agentCreate')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            width: '100%',
            padding: 'var(--space-2)',
            borderRadius: 'var(--border-radius-sm)',
            border: '1px dashed var(--color-border-default)',
            color: 'var(--color-text-tertiary)',
            fontSize: 'var(--font-size-sm)',
            cursor: 'pointer',
            marginTop: 'var(--space-2)',
            background: 'none',
          }}
        >
          <Plus size={14} />
          에이전트 추가
        </button>
      </div>

      {/* Status Panel */}
      <div
        style={{
          padding: 'var(--space-3)',
          borderTop: '1px solid var(--color-border-default)',
        }}
      >
        <div
          style={{
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-semibold)' as unknown as number,
            color: 'var(--color-text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 'var(--space-2)',
          }}
        >
          Status
        </div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 'var(--line-height-relaxed)' }}>
          <div>Total: {formatTokens(totalTokens)} tok</div>
          <div>Active: {activeCount}/{agents.length}</div>
          {pendingCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', color: 'var(--color-notify-warning)' }}>
              <AlertTriangle size={12} />
              Alerts: {pendingCount}
            </div>
          )}
        </div>
        <button
          onClick={killAll}
          style={{
            width: '100%',
            marginTop: 'var(--space-2)',
            padding: 'var(--space-1) var(--space-2)',
            borderRadius: 'var(--border-radius-sm)',
            border: '1px solid var(--color-status-error)',
            color: 'var(--color-status-error)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-medium)' as unknown as number,
            cursor: 'pointer',
            background: 'none',
          }}
        >
          <Zap size={12} style={{ display: 'inline', marginRight: 4 }} />
          Kill All
        </button>
      </div>

      {/* Navigation */}
      <div style={{ borderTop: '1px solid var(--color-border-default)', padding: 'var(--space-1)' }}>
        {navItems.map(({ target, icon: Icon, label }) => (
          <button
            key={target}
            onClick={() => handleNav(target)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              width: '100%',
              padding: 'var(--space-2) var(--space-3)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              borderRadius: 'var(--border-radius-sm)',
              background: 'none',
              border: 'none',
              backgroundColor: hoveredNavTarget === target ? 'var(--color-bg-surface0)' : 'transparent',
            }}
            onMouseEnter={() => setHoveredNavTarget(target)}
            onMouseLeave={() => setHoveredNavTarget(null)}
          >
            <Icon size={16} />
            {label}
            {target === 'approvals' && pendingCount > 0 && (
              <span
                style={{
                  marginLeft: 'auto',
                  backgroundColor: 'var(--color-notify-warning)',
                  color: 'var(--color-text-inverse)',
                  borderRadius: 'var(--border-radius-full)',
                  padding: '0 var(--space-1)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 'var(--font-weight-semibold)' as unknown as number,
                  lineHeight: 'var(--line-height-tight)',
                  minWidth: 18,
                  textAlign: 'center',
                }}
              >
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          items={getContextMenuItems(contextMenu.agent)}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};
