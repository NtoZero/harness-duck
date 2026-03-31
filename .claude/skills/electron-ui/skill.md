---
name: electron-ui
description: "Electron Renderer의 React/TypeScript UI를 구현한다. xterm.js 터미널, 팀 채팅 뷰, 파일 뷰어, IPC 통신 레이어, 상태 관리를 포함한다. 'Electron UI', '프론트엔드 구현', 'React 컴포넌트', '터미널 UI', '채팅 UI' 키워드가 나오면 이 스킬을 사용할 것."
---

# Electron UI — Renderer Process 프론트엔드 구현

와이어프레임과 컴포넌트 트리를 기반으로 Electron Renderer의 React/TypeScript UI를 구현한다.

## 기술 스택
- **React 18+** — 함수형 컴포넌트, hooks
- **TypeScript** — strict mode
- **xterm.js + @xterm/addon-fit** — 터미널 에뮬레이터
- **Monaco Editor** — 코드 뷰어 (또는 CodeMirror)
- **Electron IPC** — contextBridge + preload 패턴
- **상태 관리** — Zustand 또는 Jotai (경량 상태 라이브러리)

## 구현 순서

### 1. 프로젝트 구조 생성
```
src/renderer/
├── components/
│   ├── layout/        (TitleBar, MainLayout, Sidebar)
│   ├── terminal/      (TerminalTabs, TabBar, TerminalPane)
│   ├── chat/          (ChatPanel, MessageList, MessageInput)
│   ├── file-viewer/   (FileTree, CodeViewer, MarkdownViewer)
│   ├── agent/         (AgentList, AgentItem, AgentCreateDialog)
│   └── common/        (Button, Input, Modal, StatusBadge)
├── hooks/
│   ├── useAgent.ts
│   ├── useMessages.ts
│   ├── useTerminal.ts
│   └── useFileViewer.ts
├── stores/
│   ├── agentStore.ts
│   ├── messageStore.ts
│   └── uiStore.ts
├── ipc/
│   ├── preload.ts     (contextBridge 노출 API)
│   └── renderer.ts    (타입 안전한 IPC 호출)
├── types/
│   └── index.ts       (공유 타입 정의)
└── App.tsx
```

### 2. IPC 통신 레이어
Electron contextBridge를 통해 Main Process와 통신한다:

```typescript
// preload.ts — Main Process API를 Renderer에 노출
const api = {
  agent: {
    create: (config: AgentConfig) => ipcRenderer.invoke('agent:create', config),
    start: (id: string) => ipcRenderer.invoke('agent:start', id),
    stop: (id: string) => ipcRenderer.invoke('agent:stop', id),
    list: () => ipcRenderer.invoke('agent:list'),
    onStatusChange: (cb: (state: AgentState) => void) =>
      ipcRenderer.on('agent:status-changed', (_, state) => cb(state)),
  },
  message: {
    send: (msg: OutgoingMessage) => ipcRenderer.invoke('message:send', msg),
    onReceive: (cb: (msg: Message) => void) =>
      ipcRenderer.on('message:received', (_, msg) => cb(msg)),
  },
  file: {
    read: (path: string) => ipcRenderer.invoke('file:read', path),
    listDir: (path: string) => ipcRenderer.invoke('file:list-dir', path),
  },
};
```

IPC 채널명은 `{domain}:{action}` 형식으로 통일한다. Renderer에서 직접 `ipcRenderer`를 사용하지 않고 반드시 preload를 경유한다 (보안).

### 3. 핵심 컴포넌트 구현 가이드

**xterm.js 터미널:**
- 에이전트당 하나의 Terminal 인스턴스 유지
- 탭 전환 시 DOM attach/detach (인스턴스 재생성 아님)
- FitAddon으로 리사이즈 자동 대응
- Main Process의 node-pty와 IPC로 연결

**팀 채팅 뷰:**
- 시간순 메시지 렌더링, 에이전트별 아바타/색상 구분
- @멘션은 자동완성 지원 + 하이라이팅
- 파일 경로 인라인은 클릭 시 FileViewer 오픈
- 코드블록은 구문 강조 렌더링

**파일 뷰어:**
- 좌측 파일 트리 (에이전트별 레포 루트)
- 우측 코드 뷰어 (Monaco) — 읽기 전용
- 마크다운 파일은 렌더링 뷰 토글
- Cmd+P 퍼지 검색 (Quick Open)

### 4. 반응형 레이아웃
- 3패널 레이아웃 (Sidebar | Content | Chat) 은 드래그로 리사이즈 가능
- 최소/최대 너비 제한 (디자인 토큰의 Layout 참조)
- 좁은 화면에서 Chat 패널은 오버레이로 전환

## 주의사항
- Renderer Process에서 Node.js API 직접 호출 금지 — 반드시 IPC 경유
- xterm.js 인스턴스는 메모리 누수 방지를 위해 에이전트 삭제 시 dispose()
- 디자인 토큰은 CSS 변수로 정의하여 `_workspace/01_design/design-tokens.md`와 동기화
