import React, { useState } from 'react';
import type { ChatMessage, AgentState } from '@shared/types';
import { AgentAvatar } from '../common/AgentAvatar';
import { StatusIndicator } from '../common/StatusIndicator';
import { CodeBlock } from './CodeBlock';
import { FileReferenceCard } from './FileReferenceCard';
import { MessageActions } from './MessageActions';

interface MessageItemProps {
  message: ChatMessage;
  senderAgent?: AgentState;
  agentIndex?: number;
  onFileClick: (filePath: string) => void;
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  senderAgent,
  agentIndex = 0,
  onFileClick,
}) => {
  const isHuman = message.from === 'human';
  const senderName = isHuman ? 'Human' : message.from;
  const status = senderAgent?.status ?? 'idle';

  // Parse content for @mentions, code blocks, and inline code
  const renderContent = (content: string) => {
    const parts: React.ReactNode[] = [];
    const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(renderInlineContent(content.slice(lastIndex, match.index), parts.length));
      }
      parts.push(
        <CodeBlock key={`code-${parts.length}`} code={match[2].trim()} language={match[1] || undefined} />
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push(renderInlineContent(content.slice(lastIndex), parts.length));
    }

    return parts;
  };

  const renderInlineContent = (text: string, keyBase: number) => {
    const mentionRegex = /@(\S+)/g;
    const segments: React.ReactNode[] = [];
    let lastIdx = 0;
    let m;

    while ((m = mentionRegex.exec(text)) !== null) {
      if (m.index > lastIdx) {
        segments.push(text.slice(lastIdx, m.index));
      }
      segments.push(
        <span
          key={`mention-${keyBase}-${m.index}`}
          style={{
            color: 'var(--color-accent-blue)',
            fontWeight: 'var(--font-weight-medium)' as unknown as number,
          }}
        >
          @{m[1]}
        </span>
      );
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx < text.length) {
      segments.push(text.slice(lastIdx));
    }

    return <span key={`inline-${keyBase}`}>{segments}</span>;
  };

  const [isHovered, setIsHovered] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
  };

  const handleReply = () => {
    // Focus chat input with @mention pre-filled (handled by parent)
  };

  return (
    <div
      style={{ padding: 'var(--space-2) var(--space-4)', position: 'relative' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Hover actions */}
      {isHovered && (
        <div style={{ position: 'absolute', top: 'var(--space-1)', right: 'var(--space-4)', zIndex: 1 }}>
          <MessageActions onCopy={handleCopy} onReply={handleReply} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
        <AgentAvatar
          name={senderName}
          status={isHuman ? 'idle' : status}
          size="sm"
          colorIndex={isHuman ? 3 : agentIndex}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
            <span
              style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-medium)' as unknown as number,
                color: isHuman ? 'var(--color-accent-mauve)' : 'var(--color-text-primary)',
              }}
            >
              {senderName}
            </span>
            {!isHuman && <StatusIndicator status={status} size={6} />}
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
              {formatTime(message.timestamp)}
            </span>
          </div>

          {/* Body */}
          <div
            style={{
              fontSize: 'var(--font-size-md)',
              lineHeight: 'var(--line-height-relaxed)',
              color: 'var(--color-text-primary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {renderContent(message.content)}
          </div>

          {/* File references */}
          {message.files.length > 0 && (
            <div style={{ marginTop: 'var(--space-1)' }}>
              {message.files.map((file) => (
                <FileReferenceCard
                  key={file}
                  filePath={file}
                  onClick={() => onFileClick(file)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
