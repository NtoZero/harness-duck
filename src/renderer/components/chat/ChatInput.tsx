import React, { useState, useRef, useCallback } from 'react';
import { Send, Paperclip } from 'lucide-react';
import type { AgentState } from '@shared/types';
import { MentionAutocomplete } from './MentionAutocomplete';

interface ChatInputProps {
  agents: AgentState[];
  onSend: (content: string, files?: string[]) => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ agents, onSend, disabled }) => {
  const [value, setValue] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setValue(text);

    // Check for @mention
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = text.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\S*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const handleMentionSelect = useCallback(
    (name: string) => {
      const cursorPos = textareaRef.current?.selectionStart ?? value.length;
      const textBeforeCursor = value.slice(0, cursorPos);
      const mentionMatch = textBeforeCursor.match(/@(\S*)$/);

      if (mentionMatch) {
        const beforeMention = textBeforeCursor.slice(0, mentionMatch.index);
        const afterCursor = value.slice(cursorPos);
        const newValue = `${beforeMention}@${name} ${afterCursor}`;
        setValue(newValue);
      }
      setShowMentions(false);
      textareaRef.current?.focus();
    },
    [value]
  );

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
    setShowMentions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      setShowMentions(false);
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        borderTop: '1px solid var(--color-border-default)',
        padding: 'var(--space-2) var(--space-3)',
        backgroundColor: 'var(--color-bg-mantle)',
      }}
    >
      <MentionAutocomplete
        query={mentionQuery}
        agents={agents}
        isVisible={showMentions}
        onSelect={handleMentionSelect}
      />
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="메시지를 입력하세요... (Cmd+Enter 전송)"
          rows={2}
          style={{
            flex: 1,
            resize: 'none',
            backgroundColor: 'var(--color-bg-surface0)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--border-radius-md)',
            padding: 'var(--space-2)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-family-ui)',
            lineHeight: 'var(--line-height-normal)',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <button
            disabled
            title="파일 첨부 (준비 중)"
            style={{
              padding: 'var(--space-2)',
              color: 'var(--color-text-tertiary)',
              cursor: 'not-allowed',
              borderRadius: 'var(--border-radius-sm)',
              background: 'none',
              border: 'none',
              opacity: 0.4,
            }}
          >
            <Paperclip size={16} />
          </button>
          <button
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            style={{
              padding: 'var(--space-2)',
              color: value.trim() ? 'var(--color-accent-blue)' : 'var(--color-text-tertiary)',
              cursor: value.trim() ? 'pointer' : 'default',
              borderRadius: 'var(--border-radius-sm)',
              background: 'none',
              border: 'none',
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
