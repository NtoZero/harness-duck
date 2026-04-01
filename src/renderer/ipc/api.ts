/**
 * Typed access to the Electron IPC API exposed via src/main/preload.ts.
 *
 * The actual preload script lives in src/main/preload.ts (backend-dev's domain).
 * This module provides an unwrap helper for ApiResponse and a high-level `api`
 * object that Renderer stores/hooks should use.
 *
 * In non-Electron environments (e.g. Vite dev server), falls back to a mock.
 */
import type { ElectronAPI } from '../../main/preload';
import type {
  AgentState,
  AgentCreateInput,
  ChatMessage,
  ApprovalRequest,
  AutoApproveRule,
  AppSettings,
  ApiResponse,
  FileReadRequest,
  FileListRequest,
  FileSearchRequest,
  SearchResult,
} from '@shared/types';

export type { ElectronAPI };

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

// ─── ApiResponse unwrap ───

export class IpcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IpcError';
  }
}

function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success) {
    throw new IpcError(response.error ?? 'IPC call failed');
  }
  return response.data as T;
}

function getElectron(): ElectronAPI {
  return window.electronAPI ?? getMock();
}

// ─── High-level API (unwrapped, matches Main Process signatures) ───

export const api = {
  agent: {
    create: async (input: AgentCreateInput): Promise<AgentState> => {
      const res = await getElectron().agent.create(input);
      // Main returns AgentConfig as data; cast to AgentState shape
      return unwrap(res) as unknown as AgentState;
    },
    start: async (id: string): Promise<void> => {
      unwrap(await getElectron().agent.start(id));
    },
    stop: async (id: string): Promise<void> => {
      unwrap(await getElectron().agent.stop(id));
    },
    restart: async (id: string): Promise<void> => {
      unwrap(await getElectron().agent.restart(id));
    },
    killAll: async (): Promise<void> => {
      unwrap(await getElectron().agent.killAll());
    },
    onStateUpdate: (cb: (state: AgentState) => void): (() => void) => {
      return getElectron().agent.onStateUpdate(cb);
    },
  },

  terminal: {
    write: (agentId: string, data: string): void => {
      getElectron().terminal.write(agentId, data);
    },
    resize: (agentId: string, cols: number, rows: number): void => {
      getElectron().terminal.resize(agentId, cols, rows);
    },
    onData: (cb: (agentId: string, data: string) => void): (() => void) => {
      return getElectron().terminal.onData(cb);
    },
  },

  chat: {
    /**
     * Main expects (content: string, files?: string[]).
     * Targets are parsed from @mentions in content by the router.
     * The `to` array is NOT passed to Main.
     */
    send: async (content: string, files?: string[]): Promise<ChatMessage | undefined> => {
      const res = await getElectron().chat.send(content, files);
      return unwrap(res);
    },
    onMessage: (cb: (message: ChatMessage) => void): (() => void) => {
      return getElectron().chat.onMessage(cb);
    },
    /** Main sends (message: string, conversation: string), NOT (agentId, depth). */
    onLoopWarning: (cb: (message: string, conversation: string) => void): (() => void) => {
      return getElectron().chat.onLoopWarning(cb);
    },
  },

  approval: {
    /** Main expects (approvalId: string, approved: boolean). */
    respond: async (approvalId: string, approved: boolean): Promise<void> => {
      unwrap(await getElectron().approval.respond(approvalId, approved));
    },
    onRequest: (cb: (request: ApprovalRequest) => void): (() => void) => {
      return getElectron().approval.onRequest(cb);
    },
    getRules: async (): Promise<AutoApproveRule[]> => {
      return unwrap(await getElectron().approval.getRules());
    },
    saveRules: async (rules: AutoApproveRule[]): Promise<void> => {
      unwrap(await getElectron().approval.saveRules(rules));
    },
  },

  file: {
    /** Main expects FileReadRequest, returns ApiResponse<string>. */
    read: async (req: FileReadRequest): Promise<string> => {
      return unwrap(await getElectron().file.read(req));
    },
    /** Main expects FileListRequest, returns ApiResponse<string> (tree as text). */
    list: async (req: FileListRequest): Promise<string> => {
      return unwrap(await getElectron().file.list(req));
    },
    /** Main expects FileSearchRequest, returns ApiResponse<SearchResult[]>. */
    search: async (req: FileSearchRequest): Promise<SearchResult[]> => {
      return unwrap(await getElectron().file.search(req));
    },
  },

  settings: {
    get: async (): Promise<AppSettings> => {
      return unwrap(await getElectron().settings.get());
    },
    save: async (settings: AppSettings): Promise<void> => {
      unwrap(await getElectron().settings.save(settings));
    },
  },

  dialog: {
    /** Opens native directory picker. Returns selected path or empty string if canceled. */
    openDirectory: async (): Promise<string> => {
      return unwrap(await getElectron().dialog.openDirectory());
    },
  },

  window: {
    minimize: (): void => getElectron().window.minimize(),
    maximize: (): void => getElectron().window.maximize(),
    close: (): void => getElectron().window.close(),
  },
};

// ─── Mock for Vite dev (non-Electron) ───

let _mock: ElectronAPI | null = null;

function getMock(): ElectronAPI {
  if (_mock) return _mock;
  const noop = () => {};
  const noopUnsub = () => noop;
  const ok = (): Promise<ApiResponse> => Promise.resolve({ success: true });

  _mock = {
    agent: {
      create: () => Promise.resolve({ success: true, data: {} }),
      start: ok,
      stop: ok,
      restart: ok,
      killAll: ok,
      onStateUpdate: noopUnsub,
    },
    terminal: { write: noop, resize: noop, onData: noopUnsub },
    chat: {
      send: () => Promise.resolve({ success: true, data: undefined }),
      onMessage: noopUnsub,
      onLoopWarning: noopUnsub,
    },
    approval: { respond: ok, onRequest: noopUnsub, getRules: () => Promise.resolve({ success: true, data: [] }), saveRules: ok },
    file: {
      read: () => Promise.resolve({ success: true, data: '' }),
      list: () => Promise.resolve({ success: true, data: '' }),
      search: () => Promise.resolve({ success: true, data: [] }),
    },
    settings: {
      get: () => Promise.resolve({ success: true, data: undefined }),
      save: ok,
    },
    dialog: { openDirectory: () => Promise.resolve({ success: true, data: '' }) },
    window: { minimize: noop, maximize: noop, close: noop },
  } as unknown as ElectronAPI;

  return _mock;
}
