import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import type { FileContent } from '@shared/types';

interface FilePreviewPanelProps {
  file: FileContent | null;
  onClose: () => void;
  onOpenInViewer: (path: string) => void;
}

/**
 * Conditional panel at the bottom of ChatPanel showing a file preview
 * when a FileReferenceCard is hovered or clicked.
 */
export const FilePreviewPanel: React.FC<FilePreviewPanelProps> = ({
  file,
  onClose,
  onOpenInViewer,
}) => {
  if (!file) return null;

  const lines = file.content.split('\n').slice(0, 20);
  const fileName = file.path.split('/').pop() ?? file.path;

  return (
    <div
      style={{
        borderTop: '1px solid var(--color-border-default)',
        backgroundColor: 'var(--color-bg-mantle)',
        maxHeight: 200,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-1) var(--space-3)',
          borderBottom: '1px solid var(--color-border-default)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)' as unknown as number }}>
            {fileName}
          </span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
            {file.language}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
          <button
            onClick={() => onOpenInViewer(file.path)}
            style={{
              padding: 'var(--space-1)',
              color: 'var(--color-text-tertiary)',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
            }}
            title="파일 뷰어에서 열기"
          >
            <ExternalLink size={12} />
          </button>
          <button
            onClick={onClose}
            style={{
              padding: 'var(--space-1)',
              color: 'var(--color-text-tertiary)',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
            }}
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Preview content */}
      <pre
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 'var(--space-2) var(--space-3)',
          margin: 0,
          fontFamily: 'var(--font-family-mono)',
          fontSize: 'var(--font-size-xs)',
          lineHeight: 'var(--line-height-normal)',
          color: 'var(--color-text-secondary)',
          whiteSpace: 'pre',
        }}
      >
        {lines.join('\n')}
        {file.content.split('\n').length > 20 && (
          <span style={{ color: 'var(--color-text-tertiary)' }}>{'\n... (truncated)'}</span>
        )}
      </pre>
    </div>
  );
};
