import React from 'react';

interface DateDividerProps {
  date: Date;
}

/**
 * Visual divider between message groups of different dates.
 */
export const DateDivider: React.FC<DateDividerProps> = ({ date }) => {
  const label = new Date(date).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-4)',
      }}
    >
      <div
        style={{
          flex: 1,
          height: 1,
          backgroundColor: 'var(--color-border-default)',
        }}
      />
      <span
        style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-tertiary)',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: 1,
          backgroundColor: 'var(--color-border-default)',
        }}
      />
    </div>
  );
};
