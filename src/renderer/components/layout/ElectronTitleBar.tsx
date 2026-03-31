import React from 'react';
import { Minus, Square, X } from 'lucide-react';
import { api } from '../../ipc/api';

export const ElectronTitleBar: React.FC = () => {
  return (
    <div
      style={{
        height: 'var(--titlebar-height)',
        backgroundColor: 'var(--color-bg-mantle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        // @ts-expect-error Electron-specific CSS property
        WebkitAppRegion: 'drag',
        borderBottom: '1px solid var(--color-border-default)',
        flexShrink: 0,
        paddingLeft: 80, // macOS traffic lights
      }}
    >
      <div
        style={{
          fontSize: 'var(--font-size-sm)',
          fontWeight: 'var(--font-weight-semibold)' as unknown as number,
          color: 'var(--color-text-secondary)',
          userSelect: 'none',
        }}
      >
        ClaudeTeam
      </div>
      <div
        style={{
          display: 'flex',
          // @ts-expect-error Electron-specific CSS property
          WebkitAppRegion: 'no-drag',
        }}
      >
        {[
          { icon: Minus, action: () => api.window.minimize() },
          { icon: Square, action: () => api.window.maximize() },
          { icon: X, action: () => api.window.close(), isClose: true },
        ].map(({ icon: Icon, action, isClose }, i) => (
          <button
            key={i}
            onClick={action}
            style={{
              width: 'var(--titlebar-button-width)',
              height: 'var(--titlebar-height)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = isClose
                ? 'var(--color-status-error)'
                : 'var(--color-bg-surface1)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>
    </div>
  );
};
