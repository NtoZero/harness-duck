# ClaudeTeam -- 경계면 교차 비교 보고서

**검증일:** 2026-03-31 (2차 업데이트)
**검증 대상:** src/shared/types.ts, src/renderer/*, src/main/*, src/channel/*

---

## 1. IPC 채널 정합성 (Preload vs IPC Handlers vs IPC_CHANNELS)

### 1.1 채널명 매칭 -- PASS

`IPC_CHANNELS` 상수(types.ts:216-246)의 19개 채널이 모두 preload.ts와 ipc-handlers.ts 양쪽에서 동일한 상수를 import하여 사용. 하드코딩된 문자열 불일치 위험 없음.

### 1.2 인자/리턴 타입 불일치 -- CRITICAL ISSUES

| # | 경계면 | 생산자 (Main) | 소비자 (Renderer) | 이슈 |
|---|--------|---------------|-------------------|------|
| **B-001** | `agent:create` 리턴 | `ipc-handlers.ts:32` -- `ApiResponse` (wrapped) 리턴 | `preload.ts:61` -- `Promise<AgentState>` 기대 | **타입 불일치**: Main은 `{success, data: AgentConfig}` 리턴, Renderer는 `AgentState`를 직접 기대. unwrap 로직 없음 |
| **B-002** | `agent:start/stop/restart` 리턴 | `ipc-handlers.ts:41,50,59` -- `ApiResponse` 리턴 | `preload.ts:62-64` -- `Promise<void>` 기대 | Main은 `{success: true}` 객체 리턴, Renderer는 void 기대. 에러 시 `{success: false, error}` 객체가 무시됨 |
| **B-003** | `agent:kill-all` 리턴 | `ipc-handlers.ts:68` -- `ApiResponse` 리턴 | `preload.ts:65` -- `Promise<void>` 기대 | B-002와 동일 |
| **B-004** | `chat:send` 인자 | `ipc-handlers.ts:91` -- `(content: string, files?: string[])` 2개 인자 기대 | `preload.ts:82` -- `{ content, to, files }` 객체 전달 | **인자 shape 불일치**: Renderer는 `{content, to, files}` 객체를 보내지만, Main 핸들러는 `content`와 `files`를 분리된 인자로 받음. `to` 필드 완전히 누락 |
| **B-005** | `approval:respond` 인자 | `ipc-handlers.ts:112` -- `(approvalId: string, approved: boolean)` 기대 | `preload.ts:95` -- `{ id, action: 'approve'|'deny' }` 객체 전달 | **인자 shape 불일치**: Renderer는 `{id, action}` 객체를 보내고, Main은 `(approvalId, approved)` 분리 인자 기대. 추가로 action은 string이고 approved는 boolean |
| **B-006** | `file:read` 인자/리턴 | `ipc-handlers.ts:122` -- `FileReadRequest` 객체 기대, `ApiResponse<string>` 리턴 | `preload.ts:103` -- `path: string` 전달, `FileContent` 기대 | **양방향 불일치**: Renderer는 단순 string path를 보내고 FileContent 객체를 기대, Main은 FileReadRequest 객체를 기대하고 ApiResponse<string> 리턴 |
| **B-007** | `file:list` 인자/리턴 | `ipc-handlers.ts:148` -- `FileListRequest` 기대, `ApiResponse<string>` 리턴 | `preload.ts:104` -- `rootPath: string` 전달, `FileTreeNode[]` 기대 | **양방향 불일치**: Renderer는 rootPath string을 보내고 FileTreeNode[] 기대, Main은 FileListRequest 객체를 기대하고 tree string 리턴 |
| **B-008** | `file:search` 인자/리턴 | `ipc-handlers.ts:169` -- `FileSearchRequest` 기대, `ApiResponse<SearchResult[]>` 리턴 | `preload.ts:105` -- `query: string` 전달, `{path, agentName}[]` 기대 | **양방향 불일치**: 인자 타입과 리턴 타입 모두 다름 |
| **B-009** | `settings:get` 리턴 | `ipc-handlers.ts:192` -- `ApiResponse<AppSettings>` 리턴 | `preload.ts:108` -- `AppSettings` 직접 기대 | ApiResponse wrapper unwrap 로직 없음 |
| **B-010** | `settings:save` 인자 | `ipc-handlers.ts:197` -- `(settings: AppSettings)` 분리 인자 | `preload.ts:109` -- `(settings)` 직접 전달 | 이 경우는 정상 동작할 수 있으나, ApiResponse 리턴이 무시됨 |

### 1.3 chat:loop-warning M->R 이벤트 shape 불일치 -- HIGH

| # | 이슈 |
|---|------|
| **B-011** | `ipc-handlers.ts:229` -- `send(CHAT_LOOP_WARNING, event.message, event.conversation)` 전송. `preload.ts:89` -- `callback(agentId: string, depth: number)` 기대. Main은 `(message: string, conversation: string)`을 보내는데 Renderer는 `(agentId: string, depth: number)`를 기대. **필드 의미와 타입 모두 불일치** |

---

## 2. AgentState 타입 불일치 -- CRITICAL

| # | 경계면 | 이슈 |
|---|--------|------|
| **B-012** | `types.ts` AgentState vs `agent-manager.ts` AgentState | `types.ts:14-22`에서 AgentState는 `{id, name, workingDirectory, status, model, tokenUsage, lastActivity}` 7개 필드. `agent-manager.ts:70-76`에서 생성하는 state에는 `pid`, `channelPort` 추가 필드 포함. **shared types에 `pid`와 `channelPort`가 누락됨** |
| **B-013** | `agent:create` 리턴 타입 혼동 | Main의 ipc-handlers.ts:33은 `AgentConfig`를 data로 리턴하지만, preload.ts:61에서 `AgentState`를 기대. agentStore.ts:26에서 이 리턴값을 agents 배열에 push. AgentConfig과 AgentState는 다른 인터페이스 |

---

## 3. Message Router <-> Channel Server HTTP 프로토콜 -- PASS (설계 기준)

Router -> Channel Server: `POST /` body `{from, chatId, message, type, files}` (message-router.ts:177-184)
Channel Server -> Router: `POST /agent-reply` body `{from, chatId, text}` (router-http-server.ts:251-261)

설계 문서의 프로토콜과 구현이 일치함.

---

## 4. Zustand Store vs component-tree.md 상태 구조 -- PASS (소소한 차이)

| 설계 문서 상태 | 구현 | 비고 |
|---------------|------|------|
| `agents: AgentState[]` | agentStore.agents | 일치 |
| `activeAgentId: string \| null` | agentStore.activeAgentId | 일치 |
| `activeView` | uiStore.activeView | 일치 |
| `chat.messages` | chatStore.messages | 일치 |
| `chat.unreadCount` | chatStore.unreadCount | 일치 |
| `approvals.pending` | approvalStore.pending | 일치 |
| `approvals.history` | approvalStore.history | 일치 |
| `approvals.autoRules` | approvalStore.autoRules | 일치 |
| `ui.sidebarWidth` | uiStore.sidebarWidth | 일치 |
| `ui.chatPanelWidth` | uiStore.chatPanelWidth | 일치 |
| `ui.isChatFullScreen` | uiStore.isChatFullScreen | 일치 |
| `ui.openModals` | uiStore.openModals | 일치 |
| `ui.notifications` | uiStore.notifications | 일치 |
| `settings: AppSettings` | App.tsx DEFAULT_SETTINGS | **store 미연동**: 설정이 IPC로 persist되지 않고 하드코딩됨 |
| `files.openFiles` | fileStore.openFiles | 일치 |
| `files.selectedPath` | fileStore.selectedPath | 일치 |
| `files.fileTreeState` | fileStore.fileTreeState | 일치 |

---

## 5. 상태 전이 완전성 -- PASS (제한적)

`AgentStatus` = `'idle' | 'running' | 'waiting_approval' | 'error'`

Agent Manager 전이 경로:
- `idle -> running` (startAgent)
- `running -> idle` (stopAgent 또는 정상 종료)
- `running -> error` (비정상 종료)
- `error -> running` (자동 재시작)

**미구현 전이:**
- `running -> waiting_approval`: approval 연동이 TODO 상태 (ipc-handlers.ts:115)
- UI에서 `waiting_approval` 상태 표시 컴포넌트는 존재하지만, 백엔드에서 이 상태로 전이하는 로직 없음

---

## 6. types.ts 내 `MessageType` 참조 오류 -- MEDIUM

| # | 이슈 |
|---|------|
| **B-014** | `message-router.ts:8` -- `import type { MessageType } from '../shared/types'` 하지만 `types.ts`에 `MessageType`은 정의되어 있지 않음. ChatMessage.type은 리터럴 유니온 `'request' | 'response' | 'broadcast'`로 인라인 정의됨. **컴파일 에러 발생 예상** |

---

## 7. Router HTTP API vs 설계 문서 -- PASS

| API 엔드포인트 | 설계 문서 | 구현 | 비고 |
|---------------|----------|------|------|
| POST /api/message | O | router-http-server.ts:34 | 일치 |
| GET /api/agents | O | router-http-server.ts:37 | 일치 |
| POST /api/agents/register | O | router-http-server.ts:40 | 일치 |
| POST /api/agents/deregister | O | router-http-server.ts:43 | 일치 |
| POST /api/agents/heartbeat | O | router-http-server.ts:46 | 일치 |
| POST /api/fs/read | O | router-http-server.ts:49 | 일치 |
| POST /api/fs/list | O | router-http-server.ts:52 | 일치 |
| POST /api/fs/search | O | router-http-server.ts:55 | 일치 |
| GET /api/messages | O | router-http-server.ts:58 | 일치 |
| GET /api/messages/stream | O | router-http-server.ts:61 | 일치 |
| POST /agent-reply | O | router-http-server.ts:64 | 일치 |

---

## 8. Preload 파일 충돌 -- CRITICAL (근본 원인)

| # | 이슈 |
|---|------|
| **B-015** | **Preload 파일이 2개 존재**: `src/main/preload.ts`(백엔드 작성)와 `src/renderer/ipc/preload.ts`(프론트엔드 작성). Electron은 `src/main/preload.ts`를 사용 (`src/main/index.ts:25` -- `preload: path.join(__dirname, 'preload.js')`). 프론트엔드의 `src/renderer/ipc/preload.ts`는 **사용되지 않는 파일**. |

**근본 원인 분석:**

`src/main/preload.ts` (실제 사용) vs `src/renderer/ipc/preload.ts` (프론트엔드가 기대) 비교:

| 메서드 | main/preload.ts (실제) | renderer/ipc/preload.ts (기대) | 불일치 |
|--------|----------------------|-------------------------------|--------|
| agent.create 리턴 | `Promise<ApiResponse>` | `Promise<AgentState>` | 타입 불일치 |
| agent.start/stop/restart 리턴 | `Promise<ApiResponse>` | `Promise<void>` | 타입 불일치 |
| chat.send 인자 | `(content, files?)` -- 분리 인자 | `(content, to, files?)` -- to 포함 | **to 누락** |
| chat.onLoopWarning 콜백 | `(message, conversation)` | `(agentId, depth)` | shape 다름 |
| approval.respond 인자 | `(approvalId, approved: boolean)` | `(id, action: 'approve'\|'deny')` | shape+타입 다름 |
| file.read 인자 | `(req: FileReadRequest)` | `(path: string)` | 인자 형태 다름 |
| file.list 인자 | `(req: FileListRequest)` | `(rootPath: string)` | 인자 형태 다름 |
| file.search 인자 | `(req: FileSearchRequest)` | `(query: string)` | 인자 형태 다름 |
| terminal.sendInput | `terminal.write` | `terminal.sendInput` | **메서드명 다름** |

**`src/renderer/ipc/api.ts`는 `src/renderer/ipc/preload.ts`의 `ElectronAPI` 타입을 import**하므로, 프론트 컴포넌트들은 renderer/ipc/preload.ts의 인터페이스를 기준으로 코딩됨. 그러나 런타임에 Electron이 실제 주입하는 것은 `src/main/preload.ts`의 API.

**B-016: terminal.sendInput vs terminal.write 메서드명 충돌**
- `src/renderer/ipc/preload.ts:73` -- `sendInput: (agentId, data) => ipcRenderer.send(...)`
- `src/main/preload.ts:46` -- `write: (agentId, data) => ipcRenderer.send(...)`
- Renderer 컴포넌트(`TerminalPane.tsx:62`)는 `electronAPI.terminal.sendInput()`을 호출하지만, 실제 API에는 `terminal.write()`만 존재. **런타임 TypeError 발생**

---

## 9. Channel Server <-> Message Router HTTP 프로토콜 -- PASS

`src/channel/channel-server.ts`와 `src/main/message-router.ts` 교차 비교:

### 9.1 Router -> Channel Server (message-router.ts:174-184 -> channel-server.ts:124-129)

| 필드 | Router 전송 | Channel Server 수신 | 일치 |
|------|-----------|-------------------|------|
| from | `fullMsg.from` | `body.from` | PASS |
| chatId | `fullMsg.chatId` | `body.chatId` | PASS |
| message | `this.formatChannelMessage(fullMsg)` | `body.message` | PASS |
| type | `fullMsg.type` | `body.type` | PASS |
| files | `fullMsg.files` | `body.files` | PASS |

### 9.2 Channel Server -> Router (channel-server.ts:83-91 -> router-http-server.ts:251-260)

| 필드 | Channel Server 전송 | Router 수신 | 일치 |
|------|-------------------|-----------|------|
| from | `AGENT_NAME` | `body.from` | PASS |
| chatId | `chat_id` | `body.chatId` | PASS |
| text | `text` | `body.text` | PASS |

### 9.3 MCP 도구 서버 -> Router HTTP API (mcp-tools-server.ts -> router-http-server.ts)

| 도구 | API 호출 | Router 핸들러 | 일치 |
|------|---------|-------------|------|
| team_message | `POST /api/message {from, content}` | handleMessage | PASS |
| team_read_file | `POST /api/fs/read {path, lines, requester}` | handleFileRead | PASS (requester는 HTTP에서 무시되지만 무해) |
| team_list_files | `POST /api/fs/list {target, subpath, depth}` | handleFileList | PASS |
| team_search_files | `POST /api/fs/search {pattern, agent, glob}` | handleFileSearch | PASS |
| team_status | `GET /api/agents` | handleAgents | PASS |

---

## 요약

| 심각도 | 개수 | 설명 |
|--------|------|------|
| CRITICAL | 10 | B-001~B-008: IPC 인자/리턴 타입 불일치, B-015: 중복 preload 파일 충돌, B-016: terminal 메서드명 불일치 |
| HIGH | 3 | B-011: loop-warning shape, B-012~B-013: AgentState 필드/타입 혼동 |
| MEDIUM | 1 | B-014: MessageType import 미존재 (컴파일 에러) |
| LOW | 1 | settings store 미연동 (TODO) |
| **PASS** | 5개 영역 | 채널명, Router HTTP API, Zustand 구조, Router<->Channel 프로토콜, MCP도구<->Router |

**근본 원인:** 프론트엔드와 백엔드가 각각 독립적으로 preload 파일을 작성하여 API shape이 분기됨. 하나의 preload 파일로 통일하고 양쪽이 합의한 인터페이스를 사용해야 함.
