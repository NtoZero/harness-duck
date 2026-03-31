import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
  isDiff?: boolean;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language, isDiff }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderLine = (line: string, i: number) => {
    let lineColor = 'var(--color-text-primary)';
    let lineBg = 'transparent';
    if (isDiff) {
      if (line.startsWith('+')) {
        lineColor = 'var(--color-status-running)';
        lineBg = 'rgba(166, 227, 161, 0.1)';
      } else if (line.startsWith('-')) {
        lineColor = 'var(--color-status-error)';
        lineBg = 'rgba(243, 139, 168, 0.1)';
      }
    }
    return (
      <div key={i} style={{ color: lineColor, backgroundColor: lineBg, paddingLeft: 'var(--space-2)', paddingRight: 'var(--space-2)' }}>
        {line}
      </div>
    );
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-crust)',
        borderRadius: 'var(--border-radius-md)',
        border: '1px solid var(--color-border-default)',
        overflow: 'hidden',
        marginTop: 'var(--space-2)',
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family-mono)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 'var(--space-1) var(--space-2)',
          borderBottom: '1px solid var(--color-border-default)',
          backgroundColor: 'var(--color-bg-surface0)',
        }}
      >
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
          {language || 'text'}
        </span>
        <button
          onClick={handleCopy}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            color: 'var(--color-text-tertiary)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-xs)',
            background: 'none',
            border: 'none',
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre
        style={{
          padding: 'var(--space-2)',
          overflowX: 'auto',
          margin: 0,
          lineHeight: 'var(--line-height-normal)',
        }}
      >
        {code.split('\n').map(renderLine)}
      </pre>
    </div>
  );
};
