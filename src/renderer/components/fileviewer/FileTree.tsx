import React from 'react';
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react';
import type { FileTreeNode as FileTreeNodeType } from '@shared/types';
import { useFileStore } from '../../stores/fileStore';

interface FileTreeProps {
  nodes: FileTreeNodeType[];
  selectedPath: string | null;
  onFileSelect: (path: string) => void;
  depth?: number;
}

export const FileTree: React.FC<FileTreeProps> = ({
  nodes,
  selectedPath,
  onFileSelect,
  depth = 0,
}) => {
  const fileTreeState = useFileStore((s) => s.fileTreeState);
  const toggleTreeNode = useFileStore((s) => s.toggleTreeNode);

  return (
    <div>
      {nodes.map((node) => {
        const isDir = node.type === 'directory';
        const isExpanded = fileTreeState.get(node.path) ?? false;
        const isSelected = node.path === selectedPath;

        return (
          <div key={node.path}>
            <div
              onClick={() => {
                if (isDir) {
                  toggleTreeNode(node.path);
                } else {
                  onFileSelect(node.path);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                padding: '2px var(--space-2)',
                paddingLeft: `${depth * 16 + 8}px`,
                fontSize: 'var(--font-size-sm)',
                cursor: 'pointer',
                backgroundColor: isSelected ? 'var(--color-bg-surface1)' : 'transparent',
                color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-surface0)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }
              }}
            >
              {isDir ? (
                isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
              ) : (
                <span style={{ width: 14 }} />
              )}
              {isDir ? (
                <Folder size={14} style={{ color: 'var(--color-accent-blue)', flexShrink: 0 }} />
              ) : (
                <File size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
              )}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</span>
            </div>
            {isDir && isExpanded && node.children && (
              <FileTree
                nodes={node.children}
                selectedPath={selectedPath}
                onFileSelect={onFileSelect}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
