import React, { useRef, useEffect, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useAgentStore } from '../../stores/agentStore';
import { useUIStore } from '../../stores/uiStore';
import { useFileStore } from '../../stores/fileStore';
import { MessageItem } from './MessageItem';
import { ChatInput } from './ChatInput';
import { DateDivider } from './DateDivider';
import { LoopWarningBanner } from './LoopWarningBanner';
import { FilePreviewPanel } from './FilePreviewPanel';
import type { FileContent } from '@shared/types';

export const ChatPanel: React.FC = () => {
  const messages = useChatStore((s) => s.messages);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const resetUnread = useChatStore((s) => s.resetUnread);
  const agents = useAgentStore((s) => s.agents);
  const isChatFullScreen = useUIStore((s) => s.isChatFullScreen);
  const toggleChatFullScreen = useUIStore((s) => s.toggleChatFullScreen);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const openFile = useFileStore((s) => s.openFile);

  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Mark as read when panel is visible
  useEffect(() => {
    resetUnread();
  }, [messages.length, resetUnread]);

  const handleSend = (content: string, files?: string[]) => {
    // Main Process parses @mentions from content to determine routing targets.
    // We only pass (content, files) -- no separate `to` array.
    sendMessage(content, files);
  };

  const [previewFile, setPreviewFile] = useState<FileContent | null>(null);

  const handleFileClick = (path: string) => {
    openFile(path);
    setActiveView('fileViewer');
  };

  const getDateKey = (date: Date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };

  let lastDateKey = '';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--color-bg-base)',
        borderLeft: '1px solid var(--color-border-default)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-2) var(--space-3)',
          borderBottom: '1px solid var(--color-border-default)',
          flexShrink: 0,
          backgroundColor: 'var(--color-bg-mantle)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)' as unknown as number,
          }}
        >
          Team Chat
        </span>
        <button
          onClick={toggleChatFullScreen}
          style={{
            padding: 'var(--space-1)',
            color: 'var(--color-text-tertiary)',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
          }}
        >
          {isChatFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      {/* Message list */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {messages.map((msg, i) => {
          const dateKey = getDateKey(msg.timestamp);
          const showDate = dateKey !== lastDateKey;
          lastDateKey = dateKey;

          const senderAgent = agents.find((a) => a.name === msg.from);
          const agentIndex = agents.findIndex((a) => a.name === msg.from);

          // Show loop warning when conversation depth is high
          const showLoopWarning = msg.conversationDepth >= 4;

          return (
            <React.Fragment key={msg.id}>
              {showDate && <DateDivider date={msg.timestamp} />}
              <MessageItem
                message={msg}
                senderAgent={senderAgent}
                agentIndex={agentIndex >= 0 ? agentIndex : undefined}
                onFileClick={handleFileClick}
              />
              {showLoopWarning && (
                <LoopWarningBanner
                  message=""
                  conversationDepth={msg.conversationDepth}
                  maxDepth={5}
                />
              )}
            </React.Fragment>
          );
        })}
        {messages.length === 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--color-text-tertiary)',
              fontSize: 'var(--font-size-sm)',
              padding: 'var(--space-4)',
              textAlign: 'center',
            }}
          >
            에이전트와 대화를 시작하세요.
            <br />
            @멘션으로 특정 에이전트에게 지시할 수 있습니다.
          </div>
        )}
      </div>

      {/* File Preview */}
      <FilePreviewPanel
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onOpenInViewer={(path) => {
          handleFileClick(path);
          setPreviewFile(null);
        }}
      />

      {/* Input */}
      <ChatInput agents={agents} onSend={handleSend} />
    </div>
  );
};
