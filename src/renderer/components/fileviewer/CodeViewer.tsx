import React from 'react';
import type { FileContent } from '@shared/types';

interface CodeViewerProps {
  file: FileContent;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({ file }) => {
  const lines = file.content.split('\n');

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'auto', fontFamily: 'var(--font-family-mono)', fontSize: 'var(--font-size-sm)' }}>
      {/* Line numbers */}
      <div
        style={{
          padding: 'var(--space-2) var(--space-2)',
          textAlign: 'right',
          color: 'var(--color-text-tertiary)',
          userSelect: 'none',
          borderRight: '1px solid var(--color-border-default)',
          backgroundColor: 'var(--color-bg-mantle)',
          flexShrink: 0,
          minWidth: 48,
        }}
      >
        {lines.map((_, i) => (
          <div key={i} style={{ lineHeight: 'var(--line-height-normal)' }}>
            {i + 1}
          </div>
        ))}
      </div>
      {/* Code content */}
      <pre
        style={{
          flex: 1,
          padding: 'var(--space-2) var(--space-3)',
          margin: 0,
          lineHeight: 'var(--line-height-normal)',
          overflow: 'auto',
          whiteSpace: 'pre',
        }}
      >
        {file.content}
      </pre>
    </div>
  );
};
