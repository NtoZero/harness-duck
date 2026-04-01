import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          style={{
            padding: 'var(--space-4)',
            color: 'var(--color-status-error)',
            backgroundColor: 'var(--color-bg-surface0)',
            borderRadius: 'var(--border-radius-md)',
            margin: 'var(--space-2)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>렌더링 오류</div>
          <code style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            {this.state.error?.message}
          </code>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              display: 'block',
              marginTop: 'var(--space-2)',
              padding: 'var(--space-1) var(--space-3)',
              borderRadius: 'var(--border-radius-sm)',
              border: '1px solid var(--color-border-default)',
              color: 'var(--color-text-secondary)',
              background: 'none',
              cursor: 'pointer',
              fontSize: 'var(--font-size-xs)',
            }}
          >
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
