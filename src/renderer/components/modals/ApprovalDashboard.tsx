import React, { useState } from 'react';
import { X, CheckCircle, XCircle, Eye } from 'lucide-react';
import type { ApprovalRequest, AutoApproveRule } from '@shared/types';
import { AgentAvatar } from '../common/AgentAvatar';
import { CodeBlock } from '../chat/CodeBlock';

interface ApprovalDashboardProps {
  isOpen: boolean;
  approvals: { pending: ApprovalRequest[]; history: ApprovalRequest[] };
  autoApproveRules: AutoApproveRule[];
  onApprove: (ids: string[]) => void;
  onDeny: (ids: string[]) => void;
  onRuleChange: (rules: AutoApproveRule[]) => void;
  onClose: () => void;
}

type Tab = 'pending' | 'approved' | 'denied';

export const ApprovalDashboard: React.FC<ApprovalDashboardProps> = ({
  isOpen,
  approvals,
  autoApproveRules,
  onApprove,
  onDeny,
  onRuleChange,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const approved = approvals.history.filter((r) => r.status === 'approved');
  const denied = approvals.history.filter((r) => r.status === 'denied');

  const currentList =
    activeTab === 'pending' ? approvals.pending
    : activeTab === 'approved' ? approved
    : denied;

  const toggleSelected = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === currentList.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentList.map((r) => r.id)));
    }
  };

  const handleBulkApprove = () => {
    onApprove(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleBulkDeny = () => {
    onDeny(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'pending', label: '대기 중', count: approvals.pending.length },
    { key: 'approved', label: '승인됨', count: approved.length },
    { key: 'denied', label: '거부됨', count: denied.length },
  ];

  const formatTimeAgo = (date: Date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금 전';
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    return `${hours}시간 전`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--color-bg-overlay)',
        zIndex: 'var(--z-overlay)' as unknown as number,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'var(--modal-width-lg)',
          maxHeight: 'var(--modal-max-height)',
          backgroundColor: 'var(--color-bg-base)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--border-radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-4)',
            borderBottom: '1px solid var(--color-border-default)',
          }}
        >
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)' as unknown as number, margin: 0 }}>
            권한 승인 대시보드
          </h2>
          <button onClick={onClose} style={{ color: 'var(--color-text-tertiary)', cursor: 'pointer', background: 'none', border: 'none' }}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-default)', padding: '0 var(--space-4)' }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSelectedIds(new Set()); }}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                fontSize: 'var(--font-size-sm)',
                color: activeTab === tab.key ? 'var(--color-accent-blue)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                borderBottom: activeTab === tab.key ? '2px solid var(--color-accent-blue)' : '2px solid transparent',
                background: 'none',
                border: 'none',
                borderBottomWidth: 2,
                borderBottomStyle: 'solid',
                borderBottomColor: activeTab === tab.key ? 'var(--color-accent-blue)' : 'transparent',
              }}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Bulk actions */}
        {activeTab === 'pending' && approvals.pending.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-2) var(--space-4)',
              borderBottom: '1px solid var(--color-border-default)',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}>
              <input
                type="checkbox"
                checked={selectedIds.size === currentList.length && currentList.length > 0}
                onChange={toggleAll}
                style={{ accentColor: 'var(--color-accent-blue)' }}
              />
              전체 선택
            </label>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-2)' }}>
              <button
                onClick={handleBulkApprove}
                disabled={selectedIds.size === 0}
                style={{
                  padding: 'var(--space-1) var(--space-3)',
                  backgroundColor: selectedIds.size > 0 ? 'var(--color-status-running)' : 'var(--color-bg-surface1)',
                  color: selectedIds.size > 0 ? 'var(--color-text-inverse)' : 'var(--color-text-tertiary)',
                  borderRadius: 'var(--border-radius-sm)',
                  fontSize: 'var(--font-size-xs)',
                  cursor: selectedIds.size > 0 ? 'pointer' : 'default',
                  border: 'none',
                }}
              >
                일괄 승인
              </button>
              <button
                onClick={handleBulkDeny}
                disabled={selectedIds.size === 0}
                style={{
                  padding: 'var(--space-1) var(--space-3)',
                  backgroundColor: selectedIds.size > 0 ? 'var(--color-status-error)' : 'var(--color-bg-surface1)',
                  color: selectedIds.size > 0 ? 'var(--color-text-inverse)' : 'var(--color-text-tertiary)',
                  borderRadius: 'var(--border-radius-sm)',
                  fontSize: 'var(--font-size-xs)',
                  cursor: selectedIds.size > 0 ? 'pointer' : 'default',
                  border: 'none',
                }}
              >
                일괄 거부
              </button>
            </div>
          </div>
        )}

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-2) var(--space-4)' }}>
          {currentList.map((request) => (
            <div
              key={request.id}
              style={{
                padding: 'var(--space-3)',
                borderBottom: '1px solid var(--color-border-default)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                {activeTab === 'pending' && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(request.id)}
                    onChange={() => toggleSelected(request.id)}
                    style={{ marginTop: 4, accentColor: 'var(--color-accent-blue)' }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' as unknown as number }}>
                      {request.agentName}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                      {formatTimeAgo(request.timestamp)}
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-secondary)' }}>
                    {request.action} {request.target}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)' }}>
                    {request.description}
                  </div>
                  {request.diff && (
                    <CodeBlock code={request.diff} language="diff" isDiff />
                  )}
                </div>
                {activeTab === 'pending' && (
                  <div style={{ display: 'flex', gap: 'var(--space-1)', flexShrink: 0 }}>
                    <button
                      onClick={() => onApprove([request.id])}
                      style={{
                        padding: 'var(--space-1) var(--space-2)',
                        backgroundColor: 'var(--color-status-running)',
                        color: 'var(--color-text-inverse)',
                        borderRadius: 'var(--border-radius-sm)',
                        fontSize: 'var(--font-size-xs)',
                        cursor: 'pointer',
                        border: 'none',
                      }}
                    >
                      승인
                    </button>
                    <button
                      onClick={() => onDeny([request.id])}
                      style={{
                        padding: 'var(--space-1) var(--space-2)',
                        backgroundColor: 'var(--color-status-error)',
                        color: 'var(--color-text-inverse)',
                        borderRadius: 'var(--border-radius-sm)',
                        fontSize: 'var(--font-size-xs)',
                        cursor: 'pointer',
                        border: 'none',
                      }}
                    >
                      거부
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {currentList.length === 0 && (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
              {activeTab === 'pending' ? '대기 중인 승인 요청이 없습니다' : '기록이 없습니다'}
            </div>
          )}
        </div>

        {/* Auto-approve rules */}
        <div style={{ borderTop: '1px solid var(--color-border-default)', padding: 'var(--space-3) var(--space-4)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)' as unknown as number, color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-2)' }}>
            자동 승인 규칙
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)' }}>
            {autoApproveRules.map((rule) => (
              <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-1) 0' }}>
                <span style={{ width: 80, color: 'var(--color-text-secondary)' }}>
                  {rule.agentName === '*' ? '전체' : rule.agentName}
                </span>
                <span style={{ flex: 1, fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-primary)' }}>
                  {rule.pattern}
                </span>
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={() => {
                    const updated = autoApproveRules.map((r) =>
                      r.id === rule.id ? { ...r, enabled: !r.enabled } : r
                    );
                    onRuleChange(updated);
                  }}
                  style={{ accentColor: 'var(--color-accent-blue)' }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
