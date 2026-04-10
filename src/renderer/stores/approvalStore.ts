import { create } from 'zustand';
import type { ApprovalRequest, AutoApproveRule } from '@shared/types';
import { api } from '../ipc/api';

interface ApprovalStore {
  pending: ApprovalRequest[];
  history: ApprovalRequest[];
  autoRules: AutoApproveRule[];

  addRequest: (request: ApprovalRequest) => void;
  approve: (ids: string[]) => Promise<void>;
  deny: (ids: string[]) => Promise<void>;
  setAutoRules: (rules: AutoApproveRule[]) => void;
  loadRules: () => Promise<void>;
}

export const useApprovalStore = create<ApprovalStore>((set, get) => ({
  pending: [],
  history: [],
  autoRules: [],

  addRequest: (request) => {
    set((s) => ({ pending: [...s.pending, request] }));
  },

  approve: async (ids) => {
    // Optimistic update first
    const snapshot = get().pending;
    const approved = snapshot
      .filter((r) => ids.includes(r.id))
      .map((r) => ({ ...r, status: 'approved' as const }));
    set((s) => ({
      pending: s.pending.filter((r) => !ids.includes(r.id)),
      history: [...s.history, ...approved],
    }));
    // IPC calls in parallel
    try {
      await Promise.all(ids.map((id) => api.approval.respond(id, true)));
    } catch {
      // Rollback on failure
      set((s) => ({
        pending: [...s.pending, ...snapshot.filter((r) => ids.includes(r.id))],
        history: s.history.filter((r) => !ids.includes(r.id)),
      }));
    }
  },

  deny: async (ids) => {
    // Optimistic update first
    const snapshot = get().pending;
    const denied = snapshot
      .filter((r) => ids.includes(r.id))
      .map((r) => ({ ...r, status: 'denied' as const }));
    set((s) => ({
      pending: s.pending.filter((r) => !ids.includes(r.id)),
      history: [...s.history, ...denied],
    }));
    // IPC calls in parallel
    try {
      await Promise.all(ids.map((id) => api.approval.respond(id, false)));
    } catch {
      // Rollback on failure
      set((s) => ({
        pending: [...s.pending, ...snapshot.filter((r) => ids.includes(r.id))],
        history: s.history.filter((r) => !ids.includes(r.id)),
      }));
    }
  },

  setAutoRules: (rules) => {
    set({ autoRules: rules });
    api.approval.saveRules(rules).catch(() => {});
  },

  loadRules: async () => {
    try {
      const rules = await api.approval.getRules();
      set({ autoRules: rules });
    } catch {
      // fallback to empty
    }
  },
}));
