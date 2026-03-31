// ===== Agent Types =====

export interface AgentConfig {
  id: string;
  name: string;
  workingDirectory: string;
  role: string;
  model: 'sonnet' | 'opus';
  channelPort: number;
  autoApprovePatterns?: string[];
  sharedDocPaths?: string[];
}

export interface AgentState {
  id: string;
  name: string;
  workingDirectory: string;
  status: AgentStatus;
  model: 'sonnet' | 'opus';
  tokenUsage: TokenUsage;
  lastActivity: Date;
  pid?: number;
  channelPort?: number;
}

export type AgentStatus = 'idle' | 'running' | 'waiting_approval' | 'error';

export interface TokenUsage {
  input: number;
  output: number;
}

// ===== Chat Types =====

export interface ChatMessage {
  id: string;
  chatId: string;
  from: string;
  to: string[];
  content: string;
  files: string[];
  type: 'request' | 'response' | 'broadcast';
  timestamp: Date;
  conversationDepth: number;
}

// ===== Approval Types =====

export interface ApprovalRequest {
  id: string;
  agentId: string;
  agentName: string;
  action: string;
  target: string;
  description: string;
  diff?: string;
  status: 'pending' | 'approved' | 'denied';
  timestamp: Date;
}

export interface AutoApproveRule {
  id: string;
  agentName: string | '*';
  pattern: string;
  enabled: boolean;
}

// ===== Settings Types =====

export interface AppSettings {
  theme: 'system' | 'dark' | 'light';
  language: string;
  defaultModel: 'sonnet' | 'opus';
  routerPort: number;
  maxConversationDepth: number;
  tokenWarningThreshold: number;
  writeScope: 'own_repo' | 'allowed_paths' | 'unrestricted';
  killAllShortcut: string;
  teamPresets: TeamPreset[];
  sharedDocPaths: string[];
  allowedReadPaths: string[];
}

export interface TeamPreset {
  id: string;
  name: string;
  agents: AgentCreateInput[];
  createdAt: Date;
}

export interface AgentCreateInput {
  name: string;
  workingDirectory: string;
  role: string;
  model: 'sonnet' | 'opus';
  autoApprovePatterns?: string[];
  sharedDocPaths?: string[];
  channelPort?: number;
}

// ===== UI Types =====

export type ContentView = 'terminal' | 'fileViewer';
export type SidebarNavTarget = 'approvals' | 'chat' | 'files' | 'settings';
export type ModalType = 'agentCreate' | 'approvalDashboard' | 'settings' | 'quickOpen';

export interface Notification {
  id: string;
  type: 'approval' | 'message' | 'warning' | 'error';
  title: string;
  body: string;
  actions?: { label: string; onClick: () => void }[];
  timestamp: Date;
  autoHideMs?: number;
}

// ===== File Types =====

export interface FileTreeRoot {
  agentName: string;
  agentId: string;
  rootPath: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

export interface FileContent {
  path: string;
  content: string;
  language: string;
  agentName: string;
  lastModified: Date;
}

// ===== IPC Channel Names =====

// ===== Router Event Types (Main -> Renderer) =====

export type RouterEvent =
  | { type: 'message'; data: ChatMessage }
  | { type: 'loop_warning'; message: string; conversation: string }
  | { type: 'delivery_failed'; target: string; reason: string }
  | { type: 'agent_state_update'; agent: AgentState }
  | { type: 'approval_request'; data: ApprovalRequest };

// ===== API Response Wrapper =====

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ===== File System Request/Response =====

export interface FileReadRequest {
  path: string;
  lines?: string;
  requester?: string;
}

export interface FileReadResponse {
  content?: string;
  error?: string;
}

export interface FileListRequest {
  target: string;
  subpath?: string;
  depth?: number;
}

export interface FileSearchRequest {
  pattern: string;
  agent?: string;
  glob?: string;
}

export interface SearchResult {
  file: string;
  line: number;
  content: string;
}

// ===== Team Config (.claudeteam.json) =====

export interface TeamConfig {
  version: string;
  teamName: string;
  router: {
    port: number;
    host: string;
  };
  sharedDocuments: string[];
  agents: Record<string, {
    workingDirectory: string;
    model: 'sonnet' | 'opus';
    role: string;
    allowedReadPaths?: string[];
  }>;
  rules: {
    maxConversationDepth: number;
    maxFileReadSize: number;
    cooldownThreshold: {
      messages: number;
      windowSeconds: number;
    };
  };
}

// ===== IPC Channel Names =====

export const IPC_CHANNELS = {
  // Agent
  AGENT_CREATE: 'agent:create',
  AGENT_START: 'agent:start',
  AGENT_STOP: 'agent:stop',
  AGENT_RESTART: 'agent:restart',
  AGENT_KILL_ALL: 'agent:kill-all',
  AGENT_STATE_UPDATE: 'agent:state-update',
  // Terminal
  TERMINAL_DATA: 'terminal:data',
  TERMINAL_INPUT: 'terminal:input',
  TERMINAL_RESIZE: 'terminal:resize',
  // Chat
  CHAT_SEND: 'chat:send',
  CHAT_MESSAGE: 'chat:message',
  CHAT_LOOP_WARNING: 'chat:loop-warning',
  // Approval
  APPROVAL_REQUEST: 'approval:request',
  APPROVAL_RESPOND: 'approval:respond',
  // File
  FILE_READ: 'file:read',
  FILE_LIST: 'file:list',
  FILE_SEARCH: 'file:search',
  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  // Window
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  // Dialog
  DIALOG_OPEN_DIRECTORY: 'dialog:open-directory',
} as const;
