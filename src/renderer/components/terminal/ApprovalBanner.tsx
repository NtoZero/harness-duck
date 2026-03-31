import React from 'react';
import { CheckCircle, XCircle, List } from 'lucide-react';
import { useApprovalStore } from '../../stores/approvalStore';
import { useUIStore } from '../../stores/uiStore';

export const ApprovalBanner: React.FC = () => {
  const pending = useApprovalStore((s) => s.pending);
  const approve = useApprovalStore((s) => s.approve);
  const deny = useApprovalStore((s) => s.deny);
  const openModal = useUIStore((s) => s.openModal);

  if (pending.length === 0) return null;

  const latest = pending[pending.length - 1];

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-surface0)',
        borderTop: '1px solid var(--color-status-waiting)',
        padding: 'var(--space-2) var(--space-3)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        flexShrink: 0,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' as unknown as number }}>
          승인 대기: {latest.agentName}
        </div>
        <div
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {latest.action} {latest.target}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button
          onClick={() => approve([latest.id])}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            padding: 'var(--space-1) var(--space-2)',
            backgroundColor: 'var(--color-status-running)',
            color: 'var(--color-text-inverse)',
            borderRadius: 'var(--border-radius-sm)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-medium)' as unknown as number,
            cursor: 'pointer',
            border: 'none',
          }}
        >
          <CheckCircle size={12} />
          승인
        </button>
        <button
          onClick={() => deny([latest.id])}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            padding: 'var(--space-1) var(--space-2)',
            backgroundColor: 'var(--color-status-error)',
            color: 'var(--color-text-inverse)',
            borderRadius: 'var(--border-radius-sm)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-medium)' as unknown as number,
            cursor: 'pointer',
            border: 'none',
          }}
        >
          <XCircle size={12} />
          거부
        </button>
        {pending.length > 1 && (
          <button
            onClick={() => openModal('approvalDashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              padding: 'var(--space-1) var(--space-2)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--border-radius-sm)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              background: 'none',
            }}
          >
            <List size={12} />
            전체 ({pending.length})
          </button>
        )}
      </div>
    </div>
  );
};
