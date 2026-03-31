import React from 'react';

interface MarkdownViewerProps {
  content: string;
}

/**
 * Simple markdown renderer. Handles headings, bold, italic, code, lists, links.
 * For full fidelity, swap in react-markdown later.
 */
export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content }) => {
  const lines = content.split('\n');

  const renderLine = (line: string, i: number): React.ReactNode => {
    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const sizes = ['var(--font-size-2xl)', 'var(--font-size-xl)', 'var(--font-size-lg)', 'var(--font-size-md)', 'var(--font-size-sm)', 'var(--font-size-sm)'];
      return (
        <div
          key={i}
          style={{
            fontSize: sizes[level - 1],
            fontWeight: 'var(--font-weight-bold)' as unknown as number,
            marginTop: level <= 2 ? 'var(--space-6)' : 'var(--space-4)',
            marginBottom: 'var(--space-2)',
            borderBottom: level <= 2 ? '1px solid var(--color-border-default)' : undefined,
            paddingBottom: level <= 2 ? 'var(--space-2)' : undefined,
          }}
        >
          {renderInline(headingMatch[2])}
        </div>
      );
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      return <hr key={i} style={{ border: 'none', borderTop: '1px solid var(--color-border-default)', margin: 'var(--space-4) 0' }} />;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const text = line.replace(/^\s*[-*]\s+/, '');
      const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
      return (
        <div key={i} style={{ paddingLeft: `${indent * 8 + 16}px`, marginBottom: 'var(--space-1)' }}>
          <span style={{ color: 'var(--color-text-tertiary)', marginRight: 'var(--space-2)' }}>&#x2022;</span>
          {renderInline(text)}
        </div>
      );
    }

    // Ordered list
    const olMatch = line.match(/^\s*(\d+)\.\s+(.*)/);
    if (olMatch) {
      return (
        <div key={i} style={{ paddingLeft: 16, marginBottom: 'var(--space-1)' }}>
          <span style={{ color: 'var(--color-text-tertiary)', marginRight: 'var(--space-2)' }}>{olMatch[1]}.</span>
          {renderInline(olMatch[2])}
        </div>
      );
    }

    // Empty line
    if (!line.trim()) {
      return <div key={i} style={{ height: 'var(--space-3)' }} />;
    }

    // Regular paragraph
    return (
      <div key={i} style={{ marginBottom: 'var(--space-1)', lineHeight: 'var(--line-height-relaxed)' }}>
        {renderInline(line)}
      </div>
    );
  };

  const renderInline = (text: string): React.ReactNode => {
    // Process bold, italic, inline code, links
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      // Inline code
      const codeMatch = remaining.match(/`([^`]+)`/);
      // Bold
      const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
      // Italic
      const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/);
      // Link
      const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);

      const matches = [
        codeMatch ? { type: 'code', match: codeMatch } : null,
        boldMatch ? { type: 'bold', match: boldMatch } : null,
        italicMatch ? { type: 'italic', match: italicMatch } : null,
        linkMatch ? { type: 'link', match: linkMatch } : null,
      ]
        .filter(Boolean)
        .sort((a, b) => (a!.match.index ?? 0) - (b!.match.index ?? 0));

      if (matches.length === 0) {
        parts.push(remaining);
        break;
      }

      const first = matches[0]!;
      const idx = first.match.index ?? 0;

      if (idx > 0) {
        parts.push(remaining.slice(0, idx));
      }

      if (first.type === 'code') {
        parts.push(
          <code
            key={key++}
            style={{
              backgroundColor: 'var(--color-bg-surface0)',
              padding: '1px 4px',
              borderRadius: 'var(--border-radius-sm)',
              fontFamily: 'var(--font-family-mono)',
              fontSize: '0.9em',
            }}
          >
            {first.match[1]}
          </code>
        );
      } else if (first.type === 'bold') {
        parts.push(<strong key={key++}>{first.match[1]}</strong>);
      } else if (first.type === 'italic') {
        parts.push(<em key={key++}>{first.match[1]}</em>);
      } else if (first.type === 'link') {
        parts.push(
          <a key={key++} href={first.match[2]} style={{ color: 'var(--color-accent-blue)' }}>
            {first.match[1]}
          </a>
        );
      }

      remaining = remaining.slice(idx + first.match[0].length);
    }

    return <>{parts}</>;
  };

  // Handle code blocks by splitting content
  const blocks: { type: 'text' | 'code'; content: string; language?: string }[] = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }
    blocks.push({ type: 'code', content: match[2].trim(), language: match[1] || undefined });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    blocks.push({ type: 'text', content: content.slice(lastIndex) });
  }

  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        padding: 'var(--space-4) var(--space-6)',
        fontSize: 'var(--font-size-md)',
        color: 'var(--color-text-primary)',
        lineHeight: 'var(--line-height-relaxed)',
      }}
    >
      {blocks.map((block, i) => {
        if (block.type === 'code') {
          return (
            <pre
              key={i}
              style={{
                backgroundColor: 'var(--color-bg-crust)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--border-radius-md)',
                padding: 'var(--space-3)',
                fontFamily: 'var(--font-family-mono)',
                fontSize: 'var(--font-size-sm)',
                overflow: 'auto',
                margin: 'var(--space-2) 0',
              }}
            >
              {block.content}
            </pre>
          );
        }
        return <div key={i}>{block.content.split('\n').map(renderLine)}</div>;
      })}
    </div>
  );
};
