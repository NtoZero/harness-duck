# ClaudeTeam -- React Component Tree

**Version:** 0.1.0-draft
**Date:** 2026-03-31

---

## 1. 컴포넌트 계층 구조

```
App
├── ElectronTitleBar
│
├── MainLayout
│   ├── Sidebar
│   │   ├── AppLogo
│   │   ├── AgentList
│   │   │   └── AgentItem *
│   │   ├── AddAgentButton
│   │   ├── StatusPanel
│   │   │   ├── TokenUsageSummary
│   │   │   └── AlertBadge
│   │   └── SidebarNav
│   │       ├── NavItem (승인 대시보드)
│   │       ├── NavItem (팀 채팅)
│   │       ├── NavItem (파일 탐색기)
│   │       └── NavItem (설정)
│   │
│   ├── ResizeHandle (Sidebar ↔ Content)
│   │
│   ├── ContentArea
│   │   ├── ContentViewSwitcher
│   │   │   ├── ViewTab (터미널)
│   │   │   └── ViewTab (파일뷰어)
│   │   │
│   │   ├── TerminalView (conditional)
│   │   │   ├── TerminalTabBar
│   │   │   │   └── TerminalTab *
│   │   │   ├── TerminalPane (xterm.js)
│   │   │   └── TerminalStatusBar
│   │   │
│   │   ├── FileViewerView (conditional)
│   │   │   ├── FileTree
│   │   │   │   ├── FileTreeNode * (recursive)
│   │   │   │   └── AgentRepoGroup *
│   │   │   ├── ResizeHandle (Tree ↔ Viewer)
│   │   │   └── FileContentViewer
│   │   │       ├── CodeViewer (Monaco/CodeMirror)
│   │   │       ├── MarkdownViewer
│   │   │       └── ImageViewer
│   │   │
│   │   └── ApprovalBanner (conditional)
│   │
│   ├── ResizeHandle (Content ↔ Chat)
│   │
│   └── ChatPanel
│       ├── ChatHeader
│       ├── MessageList
│       │   ├── DateDivider *
│       │   ├── MessageItem *
│       │   │   ├── AgentAvatar
│       │   │   ├── MessageHeader (name, status, time)
│       │   │   ├── MessageBody
│       │   │   │   ├── MentionHighlight *
│       │   │   │   ├── CodeBlock *
│       │   │   │   └── FileReferenceCard *
│       │   │   └── MessageActions (hover)
│       │   └── LoopWarningBanner *
│       ├── MessageInput
│       │   ├── MentionAutocomplete
│       │   ├── FileAttachButton
│       │   └── SendButton
│       └── FilePreviewPanel (conditional)
│           ├── FilePreviewHeader
│           └── FilePreviewContent
│
├── AgentCreateDialog (modal)
│   ├── DialogHeader
│   ├── AgentNameInput
│   ├── DirectoryPicker
│   ├── RoleTextarea
│   ├── ModelSelector
│   ├── AdvancedSettings (collapsible)
│   │   ├── AutoApprovePatternInput
│   │   ├── SharedDocPathList
│   │   └── ChannelPortInput
│   └── DialogFooter
│
├── ApprovalDashboard (modal)
│   ├── ApprovalTabs (대기중/승인됨/거부됨)
│   ├── BulkActionBar
│   ├── ApprovalList
│   │   └── ApprovalItem *
│   │       ├── AgentBadge
│   │       ├── ActionDescription
│   │       ├── DiffPreview (conditional)
│   │       └── ApprovalActions
│   └── AutoApproveRuleTable
│       └── AutoApproveRuleRow *
│
├── SettingsPanel (modal)
│   ├── SettingsNav
│   │   └── SettingsNavItem *
│   └── SettingsContent
│       ├── GeneralSettings
│       ├── TeamSettings
│       │   ├── PresetList
│       │   ├── SharedDocPaths
│       │   └── AllowedReadPaths
│       ├── SafeguardSettings
│       └── AdvancedSettings
│
├── NotificationStack
│   └── NotificationToast *
│
└── QuickOpenDialog (modal, Cmd+P)
    ├── SearchInput
    └── FileResultList
        └── FileResultItem *
```

`*` = 반복 렌더링 컴포넌트 (list item)

---

## 2. Props 인터페이스 정의

### 2.1 최상위 레이아웃

```typescript
// App -- 최상위. 글로벌 상태 프로바이더 래핑
interface AppProps {}
// State: activeView, agents[], messages[], approvals[], settings

// ElectronTitleBar -- frameless 윈도우 타이틀바
interface ElectronTitleBarProps {
  title: string;               // "ClaudeTeam"
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
}

// MainLayout -- 3-panel flex 레이아웃
interface MainLayoutProps {
  sidebarWidth: number;        // 기본 240
  chatPanelWidth: number;      // 기본 320
  onSidebarResize: (width: number) => void;
  onChatPanelResize: (width: number) => void;
}
```

### 2.2 사이드바

```typescript
// Sidebar
interface SidebarProps {
  agents: AgentState[];
  activeAgentId: string | null;
  totalTokenUsage: number;
  pendingApprovalCount: number;
  onAgentSelect: (agentId: string) => void;
  onAddAgent: () => void;
  onNavigate: (view: SidebarNavTarget) => void;
}

type SidebarNavTarget = 'approvals' | 'chat' | 'files' | 'settings';

// AgentItem
interface AgentItemProps {
  agent: AgentState;
  isActive: boolean;
  onClick: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
}

// AgentState (shared type)
interface AgentState {
  id: string;
  name: string;
  workingDirectory: string;
  status: 'idle' | 'running' | 'waiting_approval' | 'error';
  model: 'sonnet' | 'opus';
  tokenUsage: { input: number; output: number };
  lastActivity: Date;
}

// StatusPanel
interface StatusPanelProps {
  totalTokens: number;
  activeCount: number;
  totalCount: number;
  alertCount: number;
  onKillAll: () => void;
}
```

### 2.3 콘텐츠 영역

```typescript
// ContentArea
interface ContentAreaProps {
  activeView: 'terminal' | 'fileViewer';
  onViewChange: (view: 'terminal' | 'fileViewer') => void;
}

// TerminalView
interface TerminalViewProps {
  agents: AgentState[];
  activeAgentId: string | null;
  onTabSelect: (agentId: string) => void;
  onTabClose: (agentId: string) => void;
}

// TerminalPane -- xterm.js 래퍼
interface TerminalPaneProps {
  agentId: string;
  ptyStream: ReadableStream;   // IPC를 통한 PTY 데이터
  onInput: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
}

// TerminalStatusBar
interface TerminalStatusBarProps {
  status: AgentState['status'];
  tokenUsage: { input: number; output: number };
}
```

### 2.4 파일 뷰어

```typescript
// FileViewerView
interface FileViewerViewProps {
  agents: AgentState[];         // 에이전트별 레포 루트
  initialFilePath?: string;     // 채팅에서 클릭해서 열 때
}

// FileTree
interface FileTreeProps {
  roots: FileTreeRoot[];        // 에이전트별 루트 디렉토리
  selectedPath: string | null;
  onFileSelect: (path: string) => void;
}

interface FileTreeRoot {
  agentName: string;
  agentId: string;
  rootPath: string;
}

// FileTreeNode (재귀)
interface FileTreeNodeProps {
  name: string;
  path: string;
  type: 'file' | 'directory';
  depth: number;
  isExpanded?: boolean;
  children?: FileTreeNodeProps[];
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}

// FileContentViewer
interface FileContentViewerProps {
  filePath: string;
  content: string;
  language: string;              // 구문 강조용
  agentName: string;             // 어떤 에이전트의 파일인지
  lastModified: Date;
}

// QuickOpenDialog
interface QuickOpenDialogProps {
  isOpen: boolean;
  agents: AgentState[];
  onSelect: (filePath: string) => void;
  onClose: () => void;
}
```

### 2.5 채팅 패널

```typescript
// ChatPanel
interface ChatPanelProps {
  messages: ChatMessage[];
  agents: AgentState[];          // 멘션 자동완성 + 아바타
  onSendMessage: (content: string, files?: string[]) => void;
  onFileClick: (filePath: string) => void;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
}

// ChatMessage (shared type)
interface ChatMessage {
  id: string;
  chatId: string;
  from: string;                  // 에이전트명 또는 'human'
  to: string[];                  // @멘션 대상
  content: string;
  files: string[];               // 절대경로
  type: 'request' | 'response' | 'broadcast';
  timestamp: Date;
  conversationDepth: number;
}

// MessageItem
interface MessageItemProps {
  message: ChatMessage;
  senderAgent?: AgentState;      // human이면 undefined
  onFileClick: (filePath: string) => void;
}

// MessageInput
interface MessageInputProps {
  agents: AgentState[];          // 자동완성 목록
  onSend: (content: string, files?: string[]) => void;
  disabled?: boolean;
}

// MentionAutocomplete
interface MentionAutocompleteProps {
  query: string;                 // "@" 이후 타이핑 내용
  agents: AgentState[];
  isVisible: boolean;
  onSelect: (agentName: string) => void;
}

// FileReferenceCard
interface FileReferenceCardProps {
  filePath: string;
  preview?: string;              // 첫 몇 줄 미리보기
  onClick: () => void;
}

// CodeBlock
interface CodeBlockProps {
  code: string;
  language?: string;
  isDiff?: boolean;
}
```

### 2.6 모달 다이얼로그

```typescript
// AgentCreateDialog
interface AgentCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (config: AgentCreateInput) => void;
}

interface AgentCreateInput {
  name: string;
  workingDirectory: string;
  role: string;
  model: 'sonnet' | 'opus';
  autoApprovePatterns?: string[];
  sharedDocPaths?: string[];
  channelPort?: number;
}

// ApprovalDashboard
interface ApprovalDashboardProps {
  isOpen: boolean;
  approvals: ApprovalRequest[];
  autoApproveRules: AutoApproveRule[];
  onApprove: (ids: string[]) => void;
  onDeny: (ids: string[]) => void;
  onRuleChange: (rules: AutoApproveRule[]) => void;
  onClose: () => void;
}

interface ApprovalRequest {
  id: string;
  agentId: string;
  agentName: string;
  action: string;                // "Write", "Execute", ...
  target: string;                // 파일 경로 또는 명령어
  description: string;
  diff?: string;                 // 파일 변경 시 diff
  status: 'pending' | 'approved' | 'denied';
  timestamp: Date;
}

interface AutoApproveRule {
  id: string;
  agentName: string | '*';      // '*' = 전체
  pattern: string;               // "Read(*)", "Write(src/**)"
  enabled: boolean;
}

// SettingsPanel
interface SettingsPanelProps {
  isOpen: boolean;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
}

interface AppSettings {
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

interface TeamPreset {
  id: string;
  name: string;
  agents: AgentCreateInput[];
  createdAt: Date;
}
```

### 2.7 공통 컴포넌트

```typescript
// NotificationToast
interface NotificationToastProps {
  type: 'approval' | 'message' | 'warning' | 'error';
  title: string;
  body: string;
  actions?: { label: string; onClick: () => void }[];
  onDismiss: () => void;
  autoHideMs?: number;          // 기본 5000
}

// ResizeHandle
interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
  minSize?: number;
  maxSize?: number;
}

// AgentAvatar
interface AgentAvatarProps {
  name: string;
  status: AgentState['status'];
  size?: 'sm' | 'md' | 'lg';    // 24 | 32 | 40 px
}

// StatusIndicator
interface StatusIndicatorProps {
  status: AgentState['status'];
  size?: number;                 // px
  showLabel?: boolean;
}

// ContextMenu
interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}

interface ContextMenuItem {
  label: string;
  icon?: string;
  shortcut?: string;
  onClick: () => void;
  divider?: boolean;
  disabled?: boolean;
}
```

---

## 3. 재사용 컴포넌트 식별

| 컴포넌트 | 사용 위치 | 비고 |
|----------|----------|------|
| `AgentAvatar` | MessageItem, AgentItem, ApprovalItem | 이름+상태 기반 색상 |
| `StatusIndicator` | AgentItem, TerminalTab, ChatHeader | 상태별 색상 도트 |
| `CodeBlock` | MessageBody, FileContentViewer, DiffPreview | 구문 강조 공통 |
| `FileReferenceCard` | MessageBody, FilePreviewPanel | 파일 경로 카드 |
| `ResizeHandle` | Sidebar/Content, Content/Chat, Tree/Viewer | 드래그 리사이즈 |
| `ContextMenu` | AgentItem, FileTreeNode, MessageItem | 우클릭 메뉴 |
| `NotificationToast` | 전역 알림 스택 | 승인/메시지/경고 |

---

## 4. 상태 관리 구조

```
AppStore (Zustand or Context)
├── agents: AgentState[]
├── activeAgentId: string | null
├── activeView: 'terminal' | 'fileViewer'
│
├── chat
│   ├── messages: ChatMessage[]
│   └── unreadCount: number
│
├── approvals
│   ├── pending: ApprovalRequest[]
│   ├── history: ApprovalRequest[]
│   └── autoRules: AutoApproveRule[]
│
├── ui
│   ├── sidebarWidth: number
│   ├── chatPanelWidth: number
│   ├── isChatFullScreen: boolean
│   ├── openModals: Set<ModalType>
│   └── notifications: Notification[]
│
├── settings: AppSettings
│
└── files
    ├── openFiles: Map<string, FileContent>
    ├── selectedPath: string | null
    └── fileTreeState: Map<string, boolean>  // 경로 -> 펼침 여부
```

---

## 5. IPC 채널 매핑

Renderer <-> Main Process 간 통신 채널.

| IPC 채널 | 방향 | 용도 |
|----------|------|------|
| `agent:create` | R -> M | 에이전트 생성 요청 |
| `agent:start` | R -> M | 에이전트 시작 |
| `agent:stop` | R -> M | 에이전트 중지 |
| `agent:restart` | R -> M | 에이전트 재시작 |
| `agent:kill-all` | R -> M | 모든 에이전트 긴급 정지 |
| `agent:state-update` | M -> R | 에이전트 상태 변경 알림 |
| `terminal:data` | M -> R | PTY 출력 데이터 |
| `terminal:input` | R -> M | PTY 입력 데이터 |
| `terminal:resize` | R -> M | PTY 크기 변경 |
| `chat:send` | R -> M | 채팅 메시지 전송 |
| `chat:message` | M -> R | 수신 메시지 알림 |
| `chat:loop-warning` | M -> R | 루프 경고 |
| `approval:request` | M -> R | 승인 요청 알림 |
| `approval:respond` | R -> M | 승인/거부 응답 |
| `file:read` | R -> M | 파일 내용 요청 |
| `file:list` | R -> M | 디렉토리 트리 요청 |
| `file:search` | R -> M | 파일 검색 요청 |
| `settings:get` | R -> M | 설정 조회 |
| `settings:save` | R -> M | 설정 저장 |
| `window:minimize` | R -> M | 최소화 |
| `window:maximize` | R -> M | 최대화 |
| `window:close` | R -> M | 닫기 |
