import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface LoopWarningBannerProps {
  message: string;
  conversationDepth: number;
  maxDepth: number;
}

/**
 * Inline banner displayed within the message list when conversation
 * depth approaches or reaches the limit.
 */
export const LoopWarningBanner: React.FC<LoopWarningBannerProps> = ({
  message,
  conversationDepth,
  maxDepth,
}) => {
  const remaining = maxDepth - conversationDepth;
  const isAtLimit = remaining <= 0;

  return (
    <div
      style={{
        margin: 'var(--space-2) var(--space-4)',
        padding: 'var(--space-2) var(--space-3)',
        backgroundColor: isAtLimit
          ? 'rgba(243, 139, 168, 0.1)'
          : 'rgba(250, 179, 135, 0.1)',
        border: `1px solid ${isAtLimit ? 'var(--color-status-error)' : 'var(--color-notify-warning)'}`,
        borderRadius: 'var(--border-radius-md)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        fontSize: 'var(--font-size-xs)',
      }}
    >
      <AlertTriangle
        size={14}
        style={{
          color: isAtLimit ? 'var(--color-status-error)' : 'var(--color-notify-warning)',
          flexShrink: 0,
        }}
      />
      <span style={{ color: isAtLimit ? 'var(--color-status-error)' : 'var(--color-notify-warning)' }}>
        {message || (isAtLimit
          ? `대화 깊이 ${conversationDepth}/${maxDepth}에 도달. 대화가 중단되었습니다.`
          : `대화 깊이 ${conversationDepth}/${maxDepth}에 도달. ${remaining}회 남음.`)}
      </span>
    </div>
  );
};
