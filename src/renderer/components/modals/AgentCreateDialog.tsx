import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp, FolderOpen, Plus, Trash2 } from 'lucide-react';
import type { AgentCreateInput } from '@shared/types';

interface AgentCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (config: AgentCreateInput) => void;
}

export const AgentCreateDialog: React.FC<AgentCreateDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [workingDirectory, setWorkingDirectory] = useState('');
  const [role, setRole] = useState('');
  const [model, setModel] = useState<'sonnet' | 'opus'>('sonnet');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [autoApprovePatterns, setAutoApprovePatterns] = useState('Read(*), Grep(*), Glob(*)');
  const [sharedDocPaths, setSharedDocPaths] = useState<string[]>([]);
  const [channelPort, setChannelPort] = useState('');

  const resetForm = () => {
    setName('');
    setWorkingDirectory('');
    setRole('');
    setModel('sonnet');
    setShowAdvanced(false);
    setAutoApprovePatterns('Read(*), Grep(*), Glob(*)');
    setSharedDocPaths([]);
    setChannelPort('');
  };

  const handleSubmit = () => {
    if (!name.trim() || !workingDirectory.trim()) return;
    onSubmit({
      name: name.trim(),
      workingDirectory: workingDirectory.trim(),
      role: role.trim(),
      model,
      autoApprovePatterns: autoApprovePatterns
        ? autoApprovePatterns.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      sharedDocPaths: sharedDocPaths.length > 0 ? sharedDocPaths : undefined,
      channelPort: channelPort ? parseInt(channelPort, 10) : undefined,
    });
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 'var(--space-2) var(--space-3)',
    backgroundColor: 'var(--color-bg-surface0)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 'var(--border-radius-sm)',
    color: 'var(--color-text-primary)',
    fontSize: 'var(--font-size-sm)',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)' as unknown as number,
    color: 'var(--color-text-secondary)',
    marginBottom: 'var(--space-1)',
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
          width: 'var(--modal-width-md)',
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
            새 에이전트 생성
          </h2>
          <button
            onClick={onClose}
            style={{ color: 'var(--color-text-tertiary)', cursor: 'pointer', background: 'none', border: 'none' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 'var(--space-4)', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Name */}
            <div>
              <label style={labelStyle}>에이전트 이름 *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="백엔드"
                style={inputStyle}
              />
            </div>

            {/* Working Directory */}
            <div>
              <label style={labelStyle}>작업 디렉토리 *</label>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <input
                  value={workingDirectory}
                  onChange={(e) => setWorkingDirectory(e.target.value)}
                  placeholder="/Users/dev/repos/backend"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  style={{
                    padding: 'var(--space-2)',
                    backgroundColor: 'var(--color-bg-surface0)',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 'var(--border-radius-sm)',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  <FolderOpen size={16} />
                </button>
              </div>
            </div>

            {/* Role */}
            <div>
              <label style={labelStyle}>역할 설명 (CLAUDE.md에 주입)</label>
              <textarea
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="이 레포지토리의 백엔드 코드를 담당합니다."
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            {/* Model */}
            <div>
              <label style={labelStyle}>모델 선택</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {(['sonnet', 'opus'] as const).map((m) => (
                  <label
                    key={m}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      cursor: 'pointer',
                      fontSize: 'var(--font-size-sm)',
                    }}
                  >
                    <input
                      type="radio"
                      checked={model === m}
                      onChange={() => setModel(m)}
                      style={{ accentColor: 'var(--color-accent-blue)' }}
                    />
                    Claude {m === 'sonnet' ? 'Sonnet (기본)' : 'Opus'}
                  </label>
                ))}
              </div>
            </div>

            {/* Advanced Settings Toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-sm)',
                cursor: 'pointer',
                padding: 'var(--space-1) 0',
                borderTop: '1px solid var(--color-border-default)',
                paddingTop: 'var(--space-3)',
                background: 'none',
                border: 'none',
                borderTopStyle: 'solid',
                borderTopWidth: 1,
                borderTopColor: 'var(--color-border-default)',
              }}
            >
              고급 설정
              {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showAdvanced && (
              <>
                <div>
                  <label style={labelStyle}>자동 승인 패턴</label>
                  <input
                    value={autoApprovePatterns}
                    onChange={(e) => setAutoApprovePatterns(e.target.value)}
                    placeholder="Read(*), Grep(*), Glob(*)"
                    style={inputStyle}
                  />
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)' }}>
                    패턴 예시: Read(*), Write(src/**)
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>공유 문서 경로</label>
                  {sharedDocPaths.map((p, i) => (
                    <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                      <input
                        value={p}
                        onChange={(e) => {
                          const next = [...sharedDocPaths];
                          next[i] = e.target.value;
                          setSharedDocPaths(next);
                        }}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <button
                        onClick={() => setSharedDocPaths(sharedDocPaths.filter((_, j) => j !== i))}
                        style={{ color: 'var(--color-text-tertiary)', cursor: 'pointer', background: 'none', border: 'none' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setSharedDocPaths([...sharedDocPaths, ''])}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-1)',
                      color: 'var(--color-accent-blue)',
                      fontSize: 'var(--font-size-xs)',
                      cursor: 'pointer',
                      background: 'none',
                      border: 'none',
                    }}
                  >
                    <Plus size={12} />
                    경로 추가
                  </button>
                </div>

                <div>
                  <label style={labelStyle}>채널 포트 (자동 할당)</label>
                  <input
                    value={channelPort}
                    onChange={(e) => setChannelPort(e.target.value)}
                    placeholder="7640"
                    type="number"
                    style={inputStyle}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--space-2)',
            padding: 'var(--space-4)',
            borderTop: '1px solid var(--color-border-default)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--border-radius-sm)',
              border: '1px solid var(--color-border-default)',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer',
              background: 'none',
            }}
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !workingDirectory.trim()}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--border-radius-sm)',
              backgroundColor: !name.trim() || !workingDirectory.trim()
                ? 'var(--color-bg-surface1)'
                : 'var(--color-accent-blue)',
              color: !name.trim() || !workingDirectory.trim()
                ? 'var(--color-text-tertiary)'
                : 'var(--color-text-inverse)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)' as unknown as number,
              cursor: !name.trim() || !workingDirectory.trim() ? 'default' : 'pointer',
              border: 'none',
            }}
          >
            에이전트 생성
          </button>
        </div>
      </div>
    </div>
  );
};
