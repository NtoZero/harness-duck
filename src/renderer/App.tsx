import React from 'react';
import { ElectronTitleBar } from './components/layout/ElectronTitleBar';
import { MainLayout } from './components/layout/MainLayout';
import { NotificationStack } from './components/common/NotificationStack';
import { AgentCreateDialog } from './components/modals/AgentCreateDialog';
import { ApprovalDashboard } from './components/modals/ApprovalDashboard';
import { SettingsPanel } from './components/modals/SettingsPanel';
import { QuickOpenDialog } from './components/fileviewer/QuickOpenDialog';
import { useIpcListeners } from './hooks/useIpcListeners';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useUIStore } from './stores/uiStore';
import { useAgentStore } from './stores/agentStore';
import { useApprovalStore } from './stores/approvalStore';
import { useFileStore } from './stores/fileStore';
import type { AppSettings } from '@shared/types';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'ko',
  defaultModel: 'sonnet',
  routerPort: 7632,
  maxConversationDepth: 5,
  tokenWarningThreshold: 100000,
  writeScope: 'own_repo',
  killAllShortcut: 'Cmd+Shift+K',
  teamPresets: [],
  sharedDocPaths: [],
  allowedReadPaths: [],
};

export const App: React.FC = () => {
  useIpcListeners();
  useKeyboardShortcuts();

  const openModals = useUIStore((s) => s.openModals);
  const closeModal = useUIStore((s) => s.closeModal);
  const createAgent = useAgentStore((s) => s.createAgent);
  const approvalStore = useApprovalStore();
  const openFile = useFileStore((s) => s.openFile);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <ElectronTitleBar />
      <MainLayout />
      <NotificationStack />

      {/* Modals */}
      <AgentCreateDialog
        isOpen={openModals.has('agentCreate')}
        onClose={() => closeModal('agentCreate')}
        onSubmit={createAgent}
      />

      <ApprovalDashboard
        isOpen={openModals.has('approvalDashboard')}
        approvals={{ pending: approvalStore.pending, history: approvalStore.history }}
        autoApproveRules={approvalStore.autoRules}
        onApprove={approvalStore.approve}
        onDeny={approvalStore.deny}
        onRuleChange={approvalStore.setAutoRules}
        onClose={() => closeModal('approvalDashboard')}
      />

      <SettingsPanel
        isOpen={openModals.has('settings')}
        settings={DEFAULT_SETTINGS}
        onSave={(settings) => {
          // TODO: persist via IPC
          console.log('save settings', settings);
        }}
        onClose={() => closeModal('settings')}
      />

      <QuickOpenDialog
        isOpen={openModals.has('quickOpen')}
        onSelect={openFile}
        onClose={() => closeModal('quickOpen')}
      />
    </div>
  );
};
