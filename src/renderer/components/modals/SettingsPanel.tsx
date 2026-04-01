import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { AppSettings, TeamPreset, AgentCreateInput } from '@shared/types';

interface SettingsPanelProps {
  isOpen: boolean;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void | Promise<void>;
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

  // Sync draft when settings are loaded asynchronously
  useEffect(() => {
    setDraft(settings);
  }, [settings]);

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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {/* Team Presets */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                    <label style={labelStyle}>팀 프리셋</label>
                    <button
                      onClick={() => {
                        const newPreset: TeamPreset = {
                          id: crypto.randomUUID(),
                          name: '',
                          agents: [],
                          createdAt: new Date(),
                        };
                        updateDraft('teamPresets', [...draft.teamPresets, newPreset]);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                        padding: 'var(--space-1) var(--space-2)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-accent-blue)',
                        cursor: 'pointer',
                        background: 'none',
                        border: '1px solid var(--color-accent-blue)',
                        borderRadius: 'var(--border-radius-sm)',
                      }}
                    >
                      <Plus size={14} /> 프리셋 추가
                    </button>
                  </div>

                  {draft.teamPresets.length === 0 && (
                    <div style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)', padding: 'var(--space-3)', textAlign: 'center', border: '1px dashed var(--color-border-default)', borderRadius: 'var(--border-radius-sm)' }}>
                      등록된 프리셋이 없습니다.
                    </div>
                  )}

                  {draft.teamPresets.map((preset, pi) => (
                    <div
                      key={preset.id}
                      style={{
                        marginBottom: 'var(--space-3)',
                        padding: 'var(--space-3)',
                        border: '1px solid var(--color-border-default)',
                        borderRadius: 'var(--border-radius-sm)',
                        backgroundColor: 'var(--color-bg-surface0)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                        <input
                          placeholder="프리셋 이름"
                          value={preset.name}
                          onChange={(e) => {
                            const updated = [...draft.teamPresets];
                            updated[pi] = { ...updated[pi], name: e.target.value };
                            updateDraft('teamPresets', updated);
                          }}
                          style={{ ...inputStyle, flex: 1 }}
                        />
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>
                          에이전트 {preset.agents.length}개
                        </span>
                        <button
                          onClick={() => updateDraft('teamPresets', draft.teamPresets.filter((_, i) => i !== pi))}
                          style={{ color: 'var(--color-status-error)', cursor: 'pointer', background: 'none', border: 'none', padding: 'var(--space-1)' }}
                          title="프리셋 삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Agent list in preset */}
                      {preset.agents.map((agent, ai) => (
                        <div key={ai} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-1)', alignItems: 'center' }}>
                          <input
                            placeholder="이름"
                            value={agent.name}
                            onChange={(e) => {
                              const updated = [...draft.teamPresets];
                              const agents = [...updated[pi].agents];
                              agents[ai] = { ...agents[ai], name: e.target.value };
                              updated[pi] = { ...updated[pi], agents };
                              updateDraft('teamPresets', updated);
                            }}
                            style={{ ...inputStyle, flex: 1 }}
                          />
                          <input
                            placeholder="역할"
                            value={agent.role}
                            onChange={(e) => {
                              const updated = [...draft.teamPresets];
                              const agents = [...updated[pi].agents];
                              agents[ai] = { ...agents[ai], role: e.target.value };
                              updated[pi] = { ...updated[pi], agents };
                              updateDraft('teamPresets', updated);
                            }}
                            style={{ ...inputStyle, flex: 1 }}
                          />
                          <select
                            value={agent.model}
                            onChange={(e) => {
                              const updated = [...draft.teamPresets];
                              const agents = [...updated[pi].agents];
                              agents[ai] = { ...agents[ai], model: e.target.value as 'sonnet' | 'opus' };
                              updated[pi] = { ...updated[pi], agents };
                              updateDraft('teamPresets', updated);
                            }}
                            style={{ ...inputStyle, width: 100, flex: 'none' }}
                          >
                            <option value="sonnet">Sonnet</option>
                            <option value="opus">Opus</option>
                          </select>
                          <button
                            onClick={() => {
                              const updated = [...draft.teamPresets];
                              const agents = updated[pi].agents.filter((_, i) => i !== ai);
                              updated[pi] = { ...updated[pi], agents };
                              updateDraft('teamPresets', updated);
                            }}
                            style={{ color: 'var(--color-status-error)', cursor: 'pointer', background: 'none', border: 'none', padding: 'var(--space-1)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const updated = [...draft.teamPresets];
                          const newAgent: AgentCreateInput = { name: '', workingDirectory: '', role: '', model: 'sonnet' };
                          updated[pi] = { ...updated[pi], agents: [...updated[pi].agents, newAgent] };
                          updateDraft('teamPresets', updated);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-1)',
                          padding: 'var(--space-1) var(--space-2)',
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--color-text-secondary)',
                          cursor: 'pointer',
                          background: 'none',
                          border: '1px dashed var(--color-border-default)',
                          borderRadius: 'var(--border-radius-sm)',
                          marginTop: 'var(--space-1)',
                        }}
                      >
                        <Plus size={12} /> 에이전트 추가
                      </button>
                    </div>
                  ))}
                </div>

                {/* Shared Doc Paths */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                    <label style={labelStyle}>공유 문서 경로</label>
                    <button
                      onClick={() => updateDraft('sharedDocPaths', [...draft.sharedDocPaths, ''])}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                        padding: 'var(--space-1) var(--space-2)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-accent-blue)',
                        cursor: 'pointer',
                        background: 'none',
                        border: '1px solid var(--color-accent-blue)',
                        borderRadius: 'var(--border-radius-sm)',
                      }}
                    >
                      <Plus size={14} /> 경로 추가
                    </button>
                  </div>

                  {draft.sharedDocPaths.length === 0 && (
                    <div style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)', padding: 'var(--space-3)', textAlign: 'center', border: '1px dashed var(--color-border-default)', borderRadius: 'var(--border-radius-sm)' }}>
                      등록된 공유 경로가 없습니다.
                    </div>
                  )}

                  {draft.sharedDocPaths.map((p, i) => (
                    <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-1)', alignItems: 'center' }}>
                      <input
                        placeholder="/path/to/shared/docs"
                        value={p}
                        onChange={(e) => {
                          const updated = [...draft.sharedDocPaths];
                          updated[i] = e.target.value;
                          updateDraft('sharedDocPaths', updated);
                        }}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <button
                        onClick={() => updateDraft('sharedDocPaths', draft.sharedDocPaths.filter((_, idx) => idx !== i))}
                        style={{ color: 'var(--color-status-error)', cursor: 'pointer', background: 'none', border: 'none', padding: 'var(--space-1)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'advanced' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                  <label style={labelStyle}>Router HTTP 포트</label>
                  <input
                    type="number"
                    value={draft.routerPort}
                    onChange={(e) => updateDraft('routerPort', parseInt(e.target.value, 10))}
                    min={1024}
                    max={65535}
                    style={{ ...inputStyle, width: 120 }}
                  />
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginLeft: 'var(--space-2)' }}>1024-65535</span>
                </div>
                <div>
                  <label style={labelStyle}>최대 대화 깊이</label>
                  <input
                    type="number"
                    value={draft.maxConversationDepth}
                    onChange={(e) => updateDraft('maxConversationDepth', parseInt(e.target.value, 10))}
                    min={1}
                    max={50}
                    style={{ ...inputStyle, width: 80 }}
                  />
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginLeft: 'var(--space-2)' }}>왕복 횟수</span>
                </div>
                <div>
                  <label style={labelStyle}>토큰 경고 임계값</label>
                  <input
                    type="number"
                    value={draft.tokenWarningThreshold}
                    onChange={(e) => updateDraft('tokenWarningThreshold', parseInt(e.target.value, 10))}
                    min={1000}
                    step={10000}
                    style={{ ...inputStyle, width: 140 }}
                  />
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginLeft: 'var(--space-2)' }}>토큰</span>
                </div>
                <div>
                  <label style={labelStyle}>쓰기 범위</label>
                  <select
                    value={draft.writeScope}
                    onChange={(e) => updateDraft('writeScope', e.target.value as AppSettings['writeScope'])}
                    style={inputStyle}
                  >
                    <option value="own_repo">자기 레포만 (own_repo)</option>
                    <option value="allowed_paths">허용 경로 내 (allowed_paths)</option>
                    <option value="unrestricted">제한 없음 (unrestricted)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Kill All 단축키</label>
                  <input
                    value={draft.killAllShortcut}
                    onChange={(e) => updateDraft('killAllShortcut', e.target.value)}
                    placeholder="Cmd+Shift+K"
                    style={{ ...inputStyle, width: 200 }}
                  />
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)' }}>
                    모든 에이전트를 즉시 중지하는 긴급 단축키
                  </div>
                </div>
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
