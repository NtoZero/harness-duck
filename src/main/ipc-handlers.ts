// ClaudeTeam — IPC Handlers
// Renderer <-> Main Process 통신 핸들러 등록

import { ipcMain, BrowserWindow, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { IPC_CHANNELS } from '../shared/types';
import type {
  AgentCreateInput,
  AgentState,
  ChatMessage,
  AppSettings,
  ApiResponse,
  AutoApproveRule,
  FileReadRequest,
  FileListRequest,
  FileSearchRequest,
  SearchResult,
  RouterEvent,
} from '../shared/types';
import type { AgentManager } from './agent-manager';
import type { MessageRouter } from './message-router';
import type { SessionStore } from './session-store';

export function registerIpcHandlers(
  win: BrowserWindow,
  agentManager: AgentManager,
  router: MessageRouter,
  store: SessionStore,
): void {
  // ─── Agent Lifecycle ───

  ipcMain.handle(IPC_CHANNELS.AGENT_CREATE, async (_event, input: AgentCreateInput): Promise<ApiResponse<AgentState>> => {
    try {
      const config = await agentManager.createAgent(input);
      // Return AgentState (not AgentConfig) so renderer has tokenUsage, status etc.
      const state: AgentState = {
        id: config.id,
        name: config.name,
        workingDirectory: config.workingDirectory,
        status: 'idle',
        model: config.model,
        pid: undefined,
        channelPort: config.channelPort,
        tokenUsage: { input: 0, output: 0 },
        lastActivity: new Date(),
      };
      return { success: true, data: state };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_START, async (_event, nameOrId: string): Promise<ApiResponse> => {
    try {
      await agentManager.startAgent(nameOrId);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_STOP, async (_event, nameOrId: string): Promise<ApiResponse> => {
    try {
      await agentManager.stopAgent(nameOrId);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_RESTART, async (_event, nameOrId: string): Promise<ApiResponse> => {
    try {
      await agentManager.restartAgent(nameOrId);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_KILL_ALL, async (): Promise<ApiResponse> => {
    try {
      await agentManager.killAll();
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ─── Terminal I/O ───

  ipcMain.on(IPC_CHANNELS.TERMINAL_INPUT, (_event, agentId: string, data: string) => {
    agentManager.writeToTerminal(agentId, data);
  });

  ipcMain.on(IPC_CHANNELS.TERMINAL_RESIZE, (_event, agentId: string, cols: number, rows: number) => {
    agentManager.resizeTerminal(agentId, cols, rows);
  });

  // ─── Chat ───

  ipcMain.handle(
    IPC_CHANNELS.CHAT_SEND,
    async (_event, content: string, files?: string[]): Promise<ApiResponse<ChatMessage>> => {
      try {
        const msg = await router.routeMessage({
          chatId: `chat-${Date.now()}`,
          from: 'human',
          content,
          files: files ?? [],
          type: 'request',
          conversationDepth: 0,
        });
        return { success: true, data: msg };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  // ─── Approvals ───

  ipcMain.handle(
    IPC_CHANNELS.APPROVAL_RESPOND,
    async (_event, approvalId: string, approved: boolean): Promise<ApiResponse> => {
      try {
        agentManager.handleApprovalResponse(approvalId, approved);
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.APPROVAL_GET_RULES,
    async (): Promise<ApiResponse<AutoApproveRule[]>> => {
      try {
        const rules = agentManager.getAutoApproveRules();
        return { success: true, data: rules };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.APPROVAL_SAVE_RULES,
    async (_event, rules: AutoApproveRule[]): Promise<ApiResponse> => {
      try {
        agentManager.setAutoApproveRules(rules);
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  // ─── File System ───

  ipcMain.handle(
    IPC_CHANNELS.FILE_READ,
    async (_event, req: FileReadRequest): Promise<ApiResponse<string>> => {
      try {
        if (!fs.existsSync(req.path)) {
          return { success: false, error: `File not found: ${req.path}` };
        }

        let content = fs.readFileSync(req.path, 'utf-8');

        if (req.lines) {
          const [start, end] = req.lines.split('-').map(Number);
          const lines = content.split('\n');
          content = lines.slice(start - 1, end).join('\n');
        }

        if (content.length > 50000) {
          content = content.substring(0, 50000) + '\n\n... [truncated at 50,000 chars]';
        }

        return { success: true, data: content };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.FILE_LIST,
    async (_event, req: FileListRequest): Promise<ApiResponse<string>> => {
      try {
        const agent = router.getAgent(req.target);
        if (!agent) {
          return { success: false, error: `Agent "${req.target}" not found` };
        }

        const basePath = req.subpath
          ? path.join(agent.workingDirectory, req.subpath)
          : agent.workingDirectory;

        const tree = buildDirectoryTree(basePath, req.depth ?? 2);
        return { success: true, data: tree };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.FILE_SEARCH,
    async (_event, req: FileSearchRequest): Promise<ApiResponse<SearchResult[]>> => {
      // Simple grep-like search implementation
      try {
        const agents = router.getRegisteredAgents();
        const targetDirs = req.agent
          ? agents.filter((a) => a.name === req.agent).map((a) => a.workingDirectory)
          : agents.map((a) => a.workingDirectory);

        const results: SearchResult[] = [];
        for (const dir of targetDirs) {
          searchInDirectory(dir, req.pattern, results, req.glob);
        }

        return { success: true, data: results.slice(0, 50) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  // ─── Settings ───

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (): Promise<ApiResponse<AppSettings>> => {
    return { success: true, data: store.getAppSettings() };
  });

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SAVE,
    async (_event, settings: AppSettings): Promise<ApiResponse> => {
      store.saveAppSettings(settings);
      return { success: true };
    },
  );

  // ─── Dialog ───

  ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN_DIRECTORY, async (): Promise<ApiResponse<string>> => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
      title: '작업 디렉토리 선택',
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: true, data: '' };
    }
    return { success: true, data: result.filePaths[0] };
  });

  // ─── Window Controls ───

  ipcMain.on(IPC_CHANNELS.WINDOW_MINIMIZE, () => win.minimize());
  ipcMain.on(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    win.isMaximized() ? win.unmaximize() : win.maximize();
  });
  ipcMain.on(IPC_CHANNELS.WINDOW_CLOSE, () => win.close());

  // ─── Forward Events from Main -> Renderer ───

  agentManager.on('terminal-data', (payload: { agentId: string; data: string }) => {
    win.webContents.send(IPC_CHANNELS.TERMINAL_DATA, payload.agentId, payload.data);
  });

  agentManager.on('agent-state-update', (state: AgentState) => {
    win.webContents.send(IPC_CHANNELS.AGENT_STATE_UPDATE, state);
  });

  router.on('router-event', (event: RouterEvent) => {
    switch (event.type) {
      case 'message':
        win.webContents.send(IPC_CHANNELS.CHAT_MESSAGE, event.data);
        break;
      case 'loop_warning':
        win.webContents.send(IPC_CHANNELS.CHAT_LOOP_WARNING, event.message, event.conversation);
        break;
      case 'approval_request':
        win.webContents.send(IPC_CHANNELS.APPROVAL_REQUEST, event.data);
        break;
    }
  });
}

// ─── Utility Functions ───

function buildDirectoryTree(dirPath: string, maxDepth: number, currentDepth = 0): string {
  if (currentDepth >= maxDepth || !fs.existsSync(dirPath)) return '';

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const indent = '  '.repeat(currentDepth);
  let result = '';

  const sorted = entries
    .filter((e) => !e.name.startsWith('.') && e.name !== 'node_modules')
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  for (const entry of sorted) {
    if (entry.isDirectory()) {
      result += `${indent}${entry.name}/\n`;
      result += buildDirectoryTree(path.join(dirPath, entry.name), maxDepth, currentDepth + 1);
    } else {
      result += `${indent}${entry.name}\n`;
    }
  }

  return result;
}

function searchInDirectory(
  dirPath: string,
  pattern: string,
  results: SearchResult[],
  globFilter?: string,
  maxResults = 50,
): void {
  if (results.length >= maxResults) return;
  if (!fs.existsSync(dirPath)) return;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const regex = new RegExp(pattern, 'gi');

  for (const entry of entries) {
    if (results.length >= maxResults) return;
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      searchInDirectory(fullPath, pattern, results, globFilter, maxResults);
    } else {
      if (globFilter && !matchGlob(entry.name, globFilter)) continue;

      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            results.push({ file: fullPath, line: i + 1, content: lines[i].trim() });
            regex.lastIndex = 0;
            if (results.length >= maxResults) return;
          }
        }
      } catch {
        // Skip binary or unreadable files
      }
    }
  }
}

function matchGlob(filename: string, glob: string): boolean {
  const ext = glob.replace('*', '');
  return filename.endsWith(ext);
}
