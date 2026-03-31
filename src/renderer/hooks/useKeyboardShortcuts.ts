import { useEffect } from 'react';
import { useAgentStore } from '../stores/agentStore';
import { useUIStore } from '../stores/uiStore';

/**
 * Global keyboard shortcuts.
 */
export function useKeyboardShortcuts() {
  const agents = useAgentStore((s) => s.agents);
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent);
  const killAll = useAgentStore((s) => s.killAll);
  const openModal = useUIStore((s) => s.openModal);
  const toggleChatFullScreen = useUIStore((s) => s.toggleChatFullScreen);
  const setActiveView = useUIStore((s) => s.setActiveView);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;

      // Cmd+1~9: Switch agent tabs
      if (isMeta && !isShift && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key, 10) - 1;
        if (agents[index]) {
          setActiveAgent(agents[index].id);
          setActiveView('terminal');
        }
        return;
      }

      // Cmd+P: Quick Open
      if (isMeta && e.key === 'p' && !isShift) {
        e.preventDefault();
        openModal('quickOpen');
        return;
      }

      // Cmd+Shift+C: Toggle Chat
      if (isMeta && isShift && e.key === 'C') {
        e.preventDefault();
        toggleChatFullScreen();
        return;
      }

      // Cmd+Shift+F: File Viewer
      if (isMeta && isShift && e.key === 'F') {
        e.preventDefault();
        setActiveView('fileViewer');
        return;
      }

      // Cmd+Shift+K: Kill All
      if (isMeta && isShift && e.key === 'K') {
        e.preventDefault();
        killAll();
        return;
      }

      // Cmd+,: Settings
      if (isMeta && e.key === ',') {
        e.preventDefault();
        openModal('settings');
        return;
      }

      // Cmd+Shift+A: Approval Dashboard
      if (isMeta && isShift && e.key === 'A') {
        e.preventDefault();
        openModal('approvalDashboard');
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [agents, setActiveAgent, killAll, openModal, toggleChatFullScreen, setActiveView]);
}
