import React from 'react';

interface ImageViewerProps {
  filePath: string;
  content: string;
}

/**
 * Simple image viewer for the file viewer.
 * Displays the image centered with metadata.
 */
export const ImageViewer: React.FC<ImageViewerProps> = ({ filePath, content }) => {
  // In Electron, file:// protocol can be used for local images.
  // The `content` may be a base64 data URL or the raw path.
  const src = content.startsWith('data:') ? content : `file://${filePath}`;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'auto',
        padding: 'var(--space-4)',
        backgroundColor: 'var(--color-bg-base)',
      }}
    >
      <img
        src={src}
        alt={filePath.split('/').pop() ?? ''}
        style={{
          maxWidth: '100%',
          maxHeight: '80vh',
          objectFit: 'contain',
          borderRadius: 'var(--border-radius-md)',
          border: '1px solid var(--color-border-default)',
        }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
      <div
        style={{
          marginTop: 'var(--space-3)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-tertiary)',
        }}
      >
        {filePath}
      </div>
    </div>
  );
};
