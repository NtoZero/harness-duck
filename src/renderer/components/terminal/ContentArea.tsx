import React from 'react';
import { Monitor, Folder } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useAgentStore } from '../../stores/agentStore';
import { TerminalTabBar } from './TerminalTabBar';
import { TerminalPane } from './TerminalPane';
import { TerminalStatusBar } from './TerminalStatusBar';
import { ApprovalBanner } from './ApprovalBanner';
import { FileViewerView } from '../fileviewer/FileViewerView';

export const ContentArea: React.FC = () => {
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const agents = useAgentStore((s) => s.agents);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent);

  const activeAgent = agents.find((a) => a.id === activeAgentId);

  const viewTabs = [
    { key: 'terminal' as const, icon: Monitor, label: '터미널' },
    { key: 'fileViewer' as const, icon: Folder, label: '파일뷰어' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Content view switcher */}
      <div
        style={{
          display: 'flex',
          backgroundColor: 'var(--color-bg-mantle)',
          borderBottom: '1px solid var(--color-border-default)',
          flexShrink: 0,
        }}
      >
        {activeView === 'terminal' && (
          <div style={{ flex: 1 }}>
            <TerminalTabBar
              agents={agents}
              activeAgentId={activeAgentId}
              onTabSelect={setActiveAgent}
              onTabClose={() => {}}
            />
          </div>
        )}
        <div style={{ display: 'flex', marginLeft: 'auto' }}>
          {viewTabs.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setActiveView(key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                padding: 'var(--space-1) var(--space-3)',
                fontSize: 'var(--font-size-xs)',
                color: activeView === key ? 'var(--color-accent-blue)' : 'var(--color-text-tertiary)',
                cursor: 'pointer',
                borderBottom: activeView === key ? '2px solid var(--color-accent-blue)' : '2px solid transparent',
                background: 'none',
                border: 'none',
                borderBottomStyle: 'solid',
                borderBottomWidth: 2,
                borderBottomColor: activeView === key ? 'var(--color-accent-blue)' : 'transparent',
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeView === 'terminal' ? (
          <>
            {activeAgent ? (
              <>
                <TerminalPane agentId={activeAgent.id} />
                <TerminalStatusBar
                  status={activeAgent.status}
                  tokenUsage={activeAgent.tokenUsage}
                />
              </>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-text-tertiary)',
                  fontSize: 'var(--font-size-lg)',
                }}
              >
                에이전트를 선택하거나 생성하세요
              </div>
            )}
            <ApprovalBanner />
          </>
        ) : (
          <FileViewerView />
        )}
      </div>
    </div>
  );
};
