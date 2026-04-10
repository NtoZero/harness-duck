import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { api } from '../../ipc/api';

interface TerminalPaneProps {
  agentId: string;
}

export const TerminalPane: React.FC<TerminalPaneProps> = ({ agentId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, Consolas, monospace',
      fontSize: 13,
      theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
        cursorAccent: '#1e1e2e',
        selectionBackground: 'rgba(137, 180, 250, 0.3)',
        black: '#45475a',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#89b4fa',
        magenta: '#cba6f7',
        cyan: '#94e2d5',
        white: '#bac2de',
        brightBlack: '#585b70',
        brightRed: '#f38ba8',
        brightGreen: '#a6e3a1',
        brightYellow: '#f9e2af',
        brightBlue: '#89b4fa',
        brightMagenta: '#cba6f7',
        brightCyan: '#94e2d5',
        brightWhite: '#a6adc8',
      },
      cursorBlink: true,
      scrollback: 10000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.open(containerRef.current);
    fitAddon.fit();

    termRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Send terminal input to main process
    terminal.onData((data) => {
      api.terminal.write(agentId, data);
    });

    // Receive terminal data from main process
    const unsubData = api.terminal.onData((id, data) => {
      if (id === agentId) {
        terminal.write(data);
      }
    });

    // Handle resize
    terminal.onResize(({ cols, rows }) => {
      api.terminal.resize(agentId, cols, rows);
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      unsubData();
      resizeObserver.disconnect();
      terminal.dispose();
      termRef.current = null;
    };
  }, [agentId]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: 'hidden',
        backgroundColor: 'var(--color-bg-base)',
      }}
    />
  );
};
