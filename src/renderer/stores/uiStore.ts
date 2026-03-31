import { create } from 'zustand';
import type { ContentView, ModalType, Notification } from '@shared/types';

interface UIStore {
  sidebarWidth: number;
  chatPanelWidth: number;
  activeView: ContentView;
  isChatFullScreen: boolean;
  openModals: Set<ModalType>;
  notifications: Notification[];

  setSidebarWidth: (width: number) => void;
  setChatPanelWidth: (width: number) => void;
  setActiveView: (view: ContentView) => void;
  toggleChatFullScreen: () => void;
  openModal: (modal: ModalType) => void;
  closeModal: (modal: ModalType) => void;
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarWidth: 240,
  chatPanelWidth: 320,
  activeView: 'terminal',
  isChatFullScreen: false,
  openModals: new Set(),
  notifications: [],

  setSidebarWidth: (width) => set({ sidebarWidth: Math.max(180, Math.min(360, width)) }),
  setChatPanelWidth: (width) => set({ chatPanelWidth: Math.max(280, Math.min(480, width)) }),
  setActiveView: (view) => set({ activeView: view }),
  toggleChatFullScreen: () => set((s) => ({ isChatFullScreen: !s.isChatFullScreen })),

  openModal: (modal) =>
    set((s) => {
      const next = new Set(s.openModals);
      next.add(modal);
      return { openModals: next };
    }),

  closeModal: (modal) =>
    set((s) => {
      const next = new Set(s.openModals);
      next.delete(modal);
      return { openModals: next };
    }),

  addNotification: (notification) =>
    set((s) => ({ notifications: [...s.notifications, notification] })),

  removeNotification: (id) =>
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
}));
