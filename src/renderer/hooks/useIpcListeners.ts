import { useEffect } from 'react';
import { api } from '../ipc/api';
import { useAgentStore } from '../stores/agentStore';
import { useChatStore } from '../stores/chatStore';
import { useApprovalStore } from '../stores/approvalStore';
import { useUIStore } from '../stores/uiStore';

/**
 * Sets up IPC event listeners from Main Process -> Renderer.
 * Call once at the App root level.
 */
export function useIpcListeners() {
  const updateAgentState = useAgentStore((s) => s.updateAgentState);
  const addMessage = useChatStore((s) => s.addMessage);
  const addApprovalRequest = useApprovalStore((s) => s.addRequest);
  const addNotification = useUIStore((s) => s.addNotification);

  useEffect(() => {
    const unsubAgent = api.agent.onStateUpdate((state) => {
      updateAgentState(state);
    });

    const unsubChat = api.chat.onMessage((message) => {
      addMessage(message);
    });

    // Main sends (message: string, conversation: string), NOT (agentId, depth)
    const unsubLoopWarning = api.chat.onLoopWarning((message, conversation) => {
      addNotification({
        id: `loop-${conversation}-${Date.now()}`,
        type: 'warning',
        title: '루프 경고',
        body: message,
        timestamp: new Date(),
        autoHideMs: 0,
      });
    });

    const unsubApproval = api.approval.onRequest((request) => {
      addApprovalRequest(request);
      addNotification({
        id: `approval-${request.id}`,
        type: 'approval',
        title: '승인 요청',
        body: `${request.agentName}: ${request.action} ${request.target}`,
        timestamp: new Date(),
        actions: [
          {
            label: '승인',
            onClick: () => api.approval.respond(request.id, true),
          },
          {
            label: '거부',
            onClick: () => api.approval.respond(request.id, false),
          },
        ],
      });
    });

    return () => {
      unsubAgent();
      unsubChat();
      unsubLoopWarning();
      unsubApproval();
    };
  }, [updateAgentState, addMessage, addApprovalRequest, addNotification]);
}
