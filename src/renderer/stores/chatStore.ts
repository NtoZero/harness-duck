import { create } from 'zustand';
import type { ChatMessage } from '@shared/types';
import { api } from '../ipc/api';

interface ChatStore {
  messages: ChatMessage[];
  unreadCount: number;

  /**
   * Send a message. Main Process parses @mentions from content to determine
   * routing targets. The `to` array is NOT sent to Main -- it only accepts
   * (content: string, files?: string[]).
   */
  sendMessage: (content: string, files?: string[]) => Promise<void>;
  addMessage: (message: ChatMessage) => void;
  resetUnread: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  unreadCount: 0,

  sendMessage: async (content, files) => {
    await api.chat.send(content, files);
  },

  addMessage: (message) => {
    set((s) => ({
      messages: [...s.messages, message],
      unreadCount: s.unreadCount + 1,
    }));
  },

  resetUnread: () => set({ unreadCount: 0 }),
}));
