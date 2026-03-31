import React from 'react';
import { FileText, ExternalLink } from 'lucide-react';

interface FileReferenceCardProps {
  filePath: string;
  preview?: string;
  onClick: () => void;
}

export const FileReferenceCard: React.FC<FileReferenceCardProps> = ({
  filePath,
  preview,
  onClick,
}) => {
  const fileName = filePath.split('/').pop() || filePath;
  const dirPath = filePath.split('/').slice(0, -1).join('/');

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: 'var(--color-bg-surface0)',
        border: '1px solid var(--color-accent-teal)',
        borderRadius: 'var(--border-radius-md)',
        padding: 'var(--space-2) var(--space-3)',
        cursor: 'pointer',
        marginTop: 'var(--space-2)',
        transition: `background-color var(--duration-fast)`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-surface1)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-surface0)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <FileText size={14} style={{ color: 'var(--color-accent-teal)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)' as unknown as number,
              color: 'var(--color-accent-teal)',
            }}
          >
            {fileName}
          </div>
          <div
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {dirPath}
          </div>
        </div>
        <ExternalLink size={12} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
      </div>
      {preview && (
        <pre
          style={{
            fontSize: 'var(--font-size-xs)',
            fontFamily: 'var(--font-family-mono)',
            color: 'var(--color-text-secondary)',
            marginTop: 'var(--space-1)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'pre',
            maxHeight: 60,
          }}
        >
          {preview}
        </pre>
      )}
    </div>
  );
};
