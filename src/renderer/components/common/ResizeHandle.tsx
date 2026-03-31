import React, { useCallback, useRef } from 'react';

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({ direction, onResize }) => {
  const startPos = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startPos.current = direction === 'horizontal' ? e.clientX : e.clientY;

      const handleMouseMove = (ev: MouseEvent) => {
        const current = direction === 'horizontal' ? ev.clientX : ev.clientY;
        const delta = current - startPos.current;
        startPos.current = current;
        onResize(delta);
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [direction, onResize]
  );

  const isHorizontal = direction === 'horizontal';

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        width: isHorizontal ? '4px' : '100%',
        height: isHorizontal ? '100%' : '4px',
        cursor: isHorizontal ? 'col-resize' : 'row-resize',
        backgroundColor: 'transparent',
        position: 'relative',
        flexShrink: 0,
        zIndex: 'var(--z-panel)' as unknown as number,
      }}
    >
      <div
        style={{
          position: 'absolute',
          ...(isHorizontal
            ? { top: 0, bottom: 0, left: '1px', width: '2px' }
            : { left: 0, right: 0, top: '1px', height: '2px' }),
          backgroundColor: 'var(--color-border-default)',
          transition: `background-color var(--duration-fast) var(--easing-default)`,
        }}
      />
    </div>
  );
};
