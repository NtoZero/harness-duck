import { create } from 'zustand';
import type { AgentState, AgentCreateInput } from '@shared/types';
import { api } from '../ipc/api';

interface AgentStore {
  agents: AgentState[];
  activeAgentId: string | null;

  setActiveAgent: (id: string | null) => void;
  createAgent: (input: AgentCreateInput) => Promise<void>;
  startAgent: (id: string) => Promise<void>;
  stopAgent: (id: string) => Promise<void>;
  restartAgent: (id: string) => Promise<void>;
  killAll: () => Promise<void>;
  updateAgentState: (state: AgentState) => void;
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  agents: [],
  activeAgentId: null,

  setActiveAgent: (id) => set({ activeAgentId: id }),

  createAgent: async (input) => {
    try {
      const agent = await api.agent.create(input);
      set((s) => ({ agents: [...s.agents, agent] }));
      if (!get().activeAgentId) {
        set({ activeAgentId: agent.id });
      }
    } catch (err) {
      console.error('Failed to create agent:', err);
    }
  },

  startAgent: async (id) => {
    await api.agent.start(id);
  },

  stopAgent: async (id) => {
    await api.agent.stop(id);
  },

  restartAgent: async (id) => {
    await api.agent.restart(id);
  },

  killAll: async () => {
    await api.agent.killAll();
  },

  updateAgentState: (updated) => {
    set((s) => ({
      agents: s.agents.map((a) => (a.id === updated.id ? updated : a)),
    }));
  },
}));
