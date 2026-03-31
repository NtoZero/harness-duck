import React, { useEffect } from 'react';
import { X, FolderTree } from 'lucide-react';
import { useFileStore } from '../../stores/fileStore';
import { useAgentStore } from '../../stores/agentStore';
import { CodeViewer } from './CodeViewer';
import { MarkdownViewer } from './MarkdownViewer';
import { ImageViewer } from './ImageViewer';

export const FileViewerView: React.FC = () => {
  const agents = useAgentStore((s) => s.agents);
  const openFiles = useFileStore((s) => s.openFiles);
  const selectedPath = useFileStore((s) => s.selectedPath);
  const fileTrees = useFileStore((s) => s.fileTrees);
  const openFile = useFileStore((s) => s.openFile);
  const closeFile = useFileStore((s) => s.closeFile);
  const selectFile = useFileStore((s) => s.selectFile);
  const loadFileTree = useFileStore((s) => s.loadFileTree);

  const selectedFile = selectedPath ? openFiles.get(selectedPath) : undefined;

  // Load file trees for each agent on mount
  useEffect(() => {
    for (const agent of agents) {
      if (!fileTrees.has(agent.name)) {
        loadFileTree(agent.name);
      }
    }
  }, [agents, fileTrees, loadFileTree]);

  const hasAnyTree = agents.some((a) => fileTrees.has(a.name));

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* File Tree Panel */}
      <div
        style={{
          width: 'var(--file-tree-width)',
          minWidth: 'var(--file-tree-min-width)',
          maxWidth: 'var(--file-tree-max-width)',
          overflowY: 'auto',
          backgroundColor: 'var(--color-bg-mantle)',
          borderRight: '1px solid var(--color-border-default)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            padding: 'var(--space-2) var(--space-3)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-semibold)' as unknown as number,
            color: 'var(--color-text-tertiary)',
            textTransform: 'uppercase',
            borderBottom: '1px solid var(--color-border-default)',
          }}
        >
          File Tree
        </div>
        {/* Main returns directory trees as plain text strings */}
        {agents.map((agent) => {
          const tree = fileTrees.get(agent.name);
          return (
            <div key={agent.id}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  padding: 'var(--space-2) var(--space-3)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-medium)' as unknown as number,
                  color: 'var(--color-accent-blue)',
                  borderBottom: '1px solid var(--color-border-default)',
                }}
              >
                <FolderTree size={14} />
                {agent.name}
              </div>
              {tree ? (
                <pre
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    fontSize: 'var(--font-size-xs)',
                    fontFamily: 'var(--font-family-mono)',
                    color: 'var(--color-text-secondary)',
                    whiteSpace: 'pre',
                    margin: 0,
                    lineHeight: 'var(--line-height-normal)',
                    cursor: 'default',
                  }}
                >
                  {tree}
                </pre>
              ) : (
                <div style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                  로딩 중...
                </div>
              )}
            </div>
          );
        })}
        {!hasAnyTree && agents.length === 0 && (
          <div style={{ padding: 'var(--space-4)', color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)', textAlign: 'center' }}>
            에이전트를 생성하면 파일 트리가 표시됩니다
          </div>
        )}
      </div>

      {/* File Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Open file tabs */}
        {openFiles.size > 0 && (
          <div
            style={{
              display: 'flex',
              height: 'var(--tab-height)',
              backgroundColor: 'var(--color-bg-crust)',
              borderBottom: '1px solid var(--color-border-default)',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {Array.from(openFiles.entries()).map(([path, file]) => {
              const isActive = path === selectedPath;
              const fileName = path.split('/').pop() || path;
              return (
                <div
                  key={path}
                  onClick={() => selectFile(path)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                    padding: '0 var(--space-3)',
                    fontSize: 'var(--font-size-sm)',
                    cursor: 'pointer',
                    backgroundColor: isActive ? 'var(--color-bg-base)' : 'transparent',
                    borderRight: '1px solid var(--color-border-default)',
                    color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  }}
                >
                  <span>{fileName}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeFile(path);
                    }}
                    style={{
                      padding: 2,
                      color: 'var(--color-text-tertiary)',
                      cursor: 'pointer',
                      background: 'none',
                      border: 'none',
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* File content */}
        {selectedFile ? (
          <>
            {selectedFile.language === 'Markdown' ? (
              <MarkdownViewer content={selectedFile.content} />
            ) : ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(
                selectedFile.path.split('.').pop()?.toLowerCase() ?? ''
              ) ? (
              <ImageViewer filePath={selectedFile.path} content={selectedFile.content} />
            ) : (
              <CodeViewer file={selectedFile} />
            )}
            <div
              style={{
                height: 24,
                backgroundColor: 'var(--color-bg-crust)',
                borderTop: '1px solid var(--color-border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 var(--space-3)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-tertiary)',
                flexShrink: 0,
              }}
            >
              <span>Language: {selectedFile.language}</span>
              <span>Agent: {selectedFile.agentName}</span>
            </div>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-tertiary)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            파일을 선택하세요 (Cmd+P: Quick Open)
          </div>
        )}
      </div>
    </div>
  );
};
