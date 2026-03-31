// ClaudeTeam — Preload Script
// contextBridge를 통해 Renderer에 안전한 API를 노출

import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/types';
import type {
  AgentCreateInput,
  AgentState,
  ChatMessage,
  AppSettings,
  ApprovalRequest,
  ApiResponse,
  FileReadRequest,
  FileListRequest,
  FileSearchRequest,
  SearchResult,
} from '../shared/types';

const electronAPI = {
  // ─── Agent Lifecycle ───
  agent: {
    create: (input: AgentCreateInput): Promise<ApiResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_CREATE, input),

    start: (nameOrId: string): Promise<ApiResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_START, nameOrId),

    stop: (nameOrId: string): Promise<ApiResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_STOP, nameOrId),

    restart: (nameOrId: string): Promise<ApiResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_RESTART, nameOrId),

    killAll: (): Promise<ApiResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_KILL_ALL),

    onStateUpdate: (callback: (state: AgentState) => void) => {
      const handler = (_event: any, state: AgentState) => callback(state);
      ipcRenderer.on(IPC_CHANNELS.AGENT_STATE_UPDATE, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.AGENT_STATE_UPDATE, handler);
    },
  },

  // ─── Terminal ───
  terminal: {
    write: (agentId: string, data: string): void =>
      ipcRenderer.send(IPC_CHANNELS.TERMINAL_INPUT, agentId, data),

    resize: (agentId: string, cols: number, rows: number): void =>
      ipcRenderer.send(IPC_CHANNELS.TERMINAL_RESIZE, agentId, cols, rows),

    onData: (callback: (agentId: string, data: string) => void) => {
      const handler = (_event: any, agentId: string, data: string) => callback(agentId, data);
      ipcRenderer.on(IPC_CHANNELS.TERMINAL_DATA, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_DATA, handler);
    },
  },

  // ─── Chat ───
  chat: {
    send: (content: string, files?: string[]): Promise<ApiResponse<ChatMessage>> =>
      ipcRenderer.invoke(IPC_CHANNELS.CHAT_SEND, content, files),

    onMessage: (callback: (message: ChatMessage) => void) => {
      const handler = (_event: any, message: ChatMessage) => callback(message);
      ipcRenderer.on(IPC_CHANNELS.CHAT_MESSAGE, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.CHAT_MESSAGE, handler);
    },

    onLoopWarning: (callback: (message: string, conversation: string) => void) => {
      const handler = (_event: any, message: string, conversation: string) =>
        callback(message, conversation);
      ipcRenderer.on(IPC_CHANNELS.CHAT_LOOP_WARNING, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.CHAT_LOOP_WARNING, handler);
    },
  },

  // ─── Approvals ───
  approval: {
    respond: (approvalId: string, approved: boolean): Promise<ApiResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.APPROVAL_RESPOND, approvalId, approved),

    onRequest: (callback: (request: ApprovalRequest) => void) => {
      const handler = (_event: any, request: ApprovalRequest) => callback(request);
      ipcRenderer.on(IPC_CHANNELS.APPROVAL_REQUEST, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.APPROVAL_REQUEST, handler);
    },
  },

  // ─── File System ───
  file: {
    read: (req: FileReadRequest): Promise<ApiResponse<string>> =>
      ipcRenderer.invoke(IPC_CHANNELS.FILE_READ, req),

    list: (req: FileListRequest): Promise<ApiResponse<string>> =>
      ipcRenderer.invoke(IPC_CHANNELS.FILE_LIST, req),

    search: (req: FileSearchRequest): Promise<ApiResponse<SearchResult[]>> =>
      ipcRenderer.invoke(IPC_CHANNELS.FILE_SEARCH, req),
  },

  // ─── Settings ───
  settings: {
    get: (): Promise<ApiResponse<AppSettings>> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),

    save: (settings: AppSettings): Promise<ApiResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, settings),
  },

  // ─── Dialog ───
  dialog: {
    openDirectory: (): Promise<ApiResponse<string>> =>
      ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_DIRECTORY),
  },

  // ─── Window Controls ───
  window: {
    minimize: (): void => ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE),
    maximize: (): void => ipcRenderer.send(IPC_CHANNELS.WINDOW_MAXIMIZE),
    close: (): void => ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE),
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type declaration for renderer usage
export type ElectronAPI = typeof electronAPI;
