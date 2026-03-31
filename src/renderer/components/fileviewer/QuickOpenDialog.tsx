import React, { useState, useEffect, useRef } from 'react';
import { Search, File } from 'lucide-react';
import { api } from '../../ipc/api';

interface QuickOpenDialogProps {
  isOpen: boolean;
  onSelect: (filePath: string) => void;
  onClose: () => void;
}

import type { SearchResult as SearchResultType } from '@shared/types';

interface SearchResult {
  path: string;
  agentName: string;
}

export const QuickOpenDialog: React.FC<QuickOpenDialogProps> = ({
  isOpen,
  onSelect,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      // Main expects FileSearchRequest: { pattern, agent?, glob? }
      // Returns SearchResult[]: { file, line, content }
      const rawResults = await api.file.search({ pattern: query });
      const found: SearchResult[] = rawResults.map((r) => ({
        path: r.file,
        agentName: '',
      }));
      // Deduplicate by path
      const seen = new Set<string>();
      setResults(found.filter((r) => {
        if (seen.has(r.path)) return false;
        seen.add(r.path);
        return true;
      }));
      setSelectedIndex(0);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      onSelect(results[selectedIndex].path);
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-overlay)' as unknown as number,
        display: 'flex',
        justifyContent: 'center',
        paddingTop: '20vh',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'var(--modal-width-md)',
          maxHeight: 360,
          backgroundColor: 'var(--color-bg-surface0)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--border-radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-3)',
            borderBottom: '1px solid var(--color-border-default)',
          }}
        >
          <Search size={16} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="파일 검색..."
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              fontSize: 'var(--font-size-md)',
              color: 'var(--color-text-primary)',
              outline: 'none',
            }}
          />
        </div>
        <div style={{ overflowY: 'auto', maxHeight: 280 }}>
          {results.map((result, i) => {
            const fileName = result.path.split('/').pop() || result.path;
            const dirPath = result.path.split('/').slice(0, -1).join('/');
            return (
              <div
                key={result.path}
                onClick={() => {
                  onSelect(result.path);
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2) var(--space-3)',
                  cursor: 'pointer',
                  backgroundColor: i === selectedIndex ? 'var(--color-bg-surface1)' : 'transparent',
                }}
              >
                <File size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 'var(--font-size-sm)' }}>{fileName}</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginLeft: 'var(--space-2)' }}>
                    {dirPath}
                  </span>
                </div>
              </div>
            );
          })}
          {query && results.length === 0 && (
            <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
              결과 없음
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
