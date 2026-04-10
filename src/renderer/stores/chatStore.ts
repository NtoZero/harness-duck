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
    // Optimistic update: show message immediately
    const optimisticId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: ChatMessage = {
      id: optimisticId,
      chatId: '',
      from: 'human',
      to: [],
      content,
      files: files ?? [],
      type: 'request',
      timestamp: new Date(),
      conversationDepth: 0,
    };
    set((s) => ({ messages: [...s.messages, optimistic] }));

    try {
      await api.chat.send(content, files);
    } catch {
      // Remove optimistic message on failure
      set((s) => ({ messages: s.messages.filter((m) => m.id !== optimisticId) }));
    }
  },

  addMessage: (message) => {
    set((s) => {
      // Dedup: skip if message ID already exists, or replace optimistic temp message
      const filtered = s.messages.filter((m) =>
        m.id !== message.id &&
        !(m.id.startsWith('temp-') && m.from === message.from && m.content === message.content),
      );
      return {
        messages: [...filtered, message],
        unreadCount: s.unreadCount + 1,
      };
    });
  },

  resetUnread: () => set({ unreadCount: 0 }),
}));
