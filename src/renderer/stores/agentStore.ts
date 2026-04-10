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
    try {
      await api.agent.start(id);
    } catch (err) {
      console.error('Failed to start agent:', err);
      throw err;
    }
  },

  stopAgent: async (id) => {
    try {
      await api.agent.stop(id);
    } catch (err) {
      console.error('Failed to stop agent:', err);
      throw err;
    }
  },

  restartAgent: async (id) => {
    try {
      await api.agent.restart(id);
    } catch (err) {
      console.error('Failed to restart agent:', err);
      throw err;
    }
  },

  killAll: async () => {
    try {
      await api.agent.killAll();
    } catch (err) {
      console.error('Failed to kill all agents:', err);
      throw err;
    }
  },

  updateAgentState: (updated) => {
    set((s) => ({
      agents: s.agents.map((a) => (a.id === updated.id ? updated : a)),
    }));
  },
}));
