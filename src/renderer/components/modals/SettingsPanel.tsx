import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { AppSettings } from '@shared/types';

interface SettingsPanelProps {
  isOpen: boolean;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
}

type SettingsTab = 'general' | 'team' | 'safeguards' | 'advanced';

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  settings,
  onSave,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [draft, setDraft] = useState<AppSettings>(settings);

  if (!isOpen) return null;

  const updateDraft = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  const tabs: { key: SettingsTab; label: string }[] = [
    { key: 'general', label: '일반' },
    { key: 'team', label: '팀' },
    { key: 'safeguards', label: '안전장치' },
    { key: 'advanced', label: '고급' },
  ];

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
          width: 'var(--modal-width-lg)',
          maxHeight: 'var(--modal-max-height)',
          backgroundColor: 'var(--color-bg-base)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--border-radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        {/* Left nav */}
        <div
          style={{
            width: 160,
            backgroundColor: 'var(--color-bg-mantle)',
            borderRight: '1px solid var(--color-border-default)',
            padding: 'var(--space-4) 0',
          }}
        >
          <div style={{ padding: '0 var(--space-4) var(--space-4)', fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)' as unknown as number }}>
            설정
          </div>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'block',
                width: '100%',
                padding: 'var(--space-2) var(--space-4)',
                textAlign: 'left',
                fontSize: 'var(--font-size-sm)',
                color: activeTab === tab.key ? 'var(--color-accent-blue)' : 'var(--color-text-secondary)',
                backgroundColor: activeTab === tab.key ? 'var(--color-bg-surface0)' : 'transparent',
                cursor: 'pointer',
                background: activeTab === tab.key ? 'var(--color-bg-surface0)' : 'none',
                border: 'none',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 'var(--space-2) var(--space-4)' }}>
            <button onClick={onClose} style={{ color: 'var(--color-text-tertiary)', cursor: 'pointer', background: 'none', border: 'none' }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 var(--space-4) var(--space-4)' }}>
            {activeTab === 'general' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                  <label style={labelStyle}>앱 테마</label>
                  {(['system', 'dark', 'light'] as const).map((t) => (
                    <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>
                      <input type="radio" checked={draft.theme === t} onChange={() => updateDraft('theme', t)} style={{ accentColor: 'var(--color-accent-blue)' }} />
                      {t === 'system' ? '시스템 기본' : t === 'dark' ? '다크' : '라이트'}
                    </label>
                  ))}
                </div>
                <div>
                  <label style={labelStyle}>기본 모델</label>
                  <select
                    value={draft.defaultModel}
                    onChange={(e) => updateDraft('defaultModel', e.target.value as 'sonnet' | 'opus')}
                    style={inputStyle}
                  >
                    <option value="sonnet">Claude Sonnet</option>
                    <option value="opus">Claude Opus</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Message Router 포트</label>
                  <input
                    type="number"
                    value={draft.routerPort}
                    onChange={(e) => updateDraft('routerPort', parseInt(e.target.value, 10))}
                    style={inputStyle}
                  />
                </div>
              </div>
            )}

            {activeTab === 'safeguards' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                  <label style={labelStyle}>메시지 왕복 최대 횟수</label>
                  <input
                    type="number"
                    value={draft.maxConversationDepth}
                    onChange={(e) => updateDraft('maxConversationDepth', parseInt(e.target.value, 10))}
                    min={1}
                    max={20}
                    style={{ ...inputStyle, width: 80 }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>토큰 사용량 경고 임계치</label>
                  <input
                    type="number"
                    value={draft.tokenWarningThreshold}
                    onChange={(e) => updateDraft('tokenWarningThreshold', parseInt(e.target.value, 10))}
                    style={{ ...inputStyle, width: 120 }}
                  />
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginLeft: 'var(--space-2)' }}>토큰</span>
                </div>
                <div>
                  <label style={labelStyle}>파일 쓰기 범위 제한</label>
                  {([
                    { value: 'own_repo' as const, label: '자기 레포만 쓰기 가능 (기본)' },
                    { value: 'allowed_paths' as const, label: '허용 경로 내 쓰기 가능' },
                    { value: 'unrestricted' as const, label: '제한 없음 (주의)' },
                  ]).map(({ value, label }) => (
                    <label key={value} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>
                      <input type="radio" checked={draft.writeScope === value} onChange={() => updateDraft('writeScope', value)} style={{ accentColor: 'var(--color-accent-blue)' }} />
                      {label}
                    </label>
                  ))}
                </div>
                <div>
                  <label style={labelStyle}>긴급 정지 단축키</label>
                  <input
                    value={draft.killAllShortcut}
                    onChange={(e) => updateDraft('killAllShortcut', e.target.value)}
                    style={{ ...inputStyle, width: 160 }}
                  />
                </div>
              </div>
            )}

            {activeTab === 'team' && (
              <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                팀 프리셋 및 공유 문서 경로 관리 (구현 예정)
              </div>
            )}

            {activeTab === 'advanced' && (
              <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                고급 설정 (구현 예정)
              </div>
            )}
          </div>

          {/* Save button */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 'var(--space-2)',
              padding: 'var(--space-3) var(--space-4)',
              borderTop: '1px solid var(--color-border-default)',
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--border-radius-sm)',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-sm)',
                cursor: 'pointer',
                background: 'none',
              }}
            >
              취소
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                backgroundColor: 'var(--color-accent-blue)',
                color: 'var(--color-text-inverse)',
                borderRadius: 'var(--border-radius-sm)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)' as unknown as number,
                cursor: 'pointer',
                border: 'none',
              }}
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
