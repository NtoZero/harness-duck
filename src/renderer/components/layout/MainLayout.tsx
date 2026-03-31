import React, { useCallback } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { Sidebar } from '../sidebar/Sidebar';
import { ContentArea } from '../terminal/ContentArea';
import { ChatPanel } from '../chat/ChatPanel';
import { ResizeHandle } from '../common/ResizeHandle';

export const MainLayout: React.FC = () => {
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const chatPanelWidth = useUIStore((s) => s.chatPanelWidth);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);
  const setChatPanelWidth = useUIStore((s) => s.setChatPanelWidth);

  const handleSidebarResize = useCallback(
    (delta: number) => setSidebarWidth(sidebarWidth + delta),
    [sidebarWidth, setSidebarWidth]
  );

  const handleChatResize = useCallback(
    (delta: number) => setChatPanelWidth(chatPanelWidth - delta),
    [chatPanelWidth, setChatPanelWidth]
  );

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <div style={{ width: sidebarWidth, flexShrink: 0, overflow: 'hidden' }}>
        <Sidebar />
      </div>

      <ResizeHandle direction="horizontal" onResize={handleSidebarResize} />

      <div style={{ flex: 1, minWidth: 'var(--content-min-width)', overflow: 'hidden' }}>
        <ContentArea />
      </div>

      <ResizeHandle direction="horizontal" onResize={handleChatResize} />

      <div style={{ width: chatPanelWidth, flexShrink: 0, overflow: 'hidden' }}>
        <ChatPanel />
      </div>
    </div>
  );
};
