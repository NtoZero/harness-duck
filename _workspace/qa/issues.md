# ClaudeTeam -- 발견 이슈 목록

**검증일:** 2026-03-31 (4차 재검증 -- 정정)
**상태:** 프론트 전건 FIXED, 백엔드 미해결 2건 (B-012, B-014), PARTIAL 1건 (B-013)

## ROOT CAUSE -- 중복 Preload 파일 충돌

### B-015: Preload 파일이 2개 존재하며 API shape이 다름
- **실제 사용:** `src/main/preload.ts` (백엔드 작성) -- `src/main/index.ts:25`에서 참조
- **프론트 기대:** `src/renderer/ipc/preload.ts` (프론트엔드 작성) -- `src/renderer/ipc/api.ts`에서 import
- **영향:** 프론트 컴포넌트는 renderer/ipc/preload.ts의 ElectronAPI 타입을 기준으로 코딩되었지만, 런타임에 Electron이 주입하는 것은 main/preload.ts의 API. 모든 B-001~B-011 이슈의 근본 원인.
- **수정 방안:** 하나의 preload 파일로 통일. main/preload.ts를 기준으로 하되, renderer/ipc/preload.ts의 사용자 친화적 인터페이스를 반영하여 합의된 API shape 도출

### B-016: terminal.sendInput vs terminal.write 메서드명 충돌
- **renderer/ipc/preload.ts:73** -- `sendInput` 메서드명
- **main/preload.ts:46** -- `write` 메서드명
- **TerminalPane.tsx:62** -- `electronAPI.terminal.sendInput()` 호출
- **영향:** 런타임에 `terminal.sendInput is not a function` TypeError 발생
- **수정 방안:** 메서드명 통일 (`sendInput` 또는 `write` 중 하나로)

---

## 재검증 결과 요약 (2026-03-31 4차 -- 정정)

| 이슈 | 상태 | 비고 |
|------|------|------|
| B-001 | FIXED | api.ts unwrap + cast |
| B-002/003 | FIXED | api.ts unwrap + throw |
| B-004 | FIXED | to 제거, Router가 content에서 파싱 |
| B-005 | FIXED | boolean 전달 |
| B-006/007/008 | FIXED | Request 객체 전달 + unwrap |
| B-009/010 | FIXED | settings unwrap |
| B-011 | FIXED | (message, conversation) 시그니처 |
| B-012 | NOT FIXED (backend) | types.ts에 pid/channelPort 미추가 |
| B-013 | PARTIAL | as unknown as AgentState double cast |
| B-014 | NOT FIXED (backend) | MessageType import 미존재 |
| B-015 | FIXED | renderer/ipc/preload.ts 삭제 |
| B-016 | FIXED | api.ts:80 facade `sendInput` -> 내부 `getElectron().terminal.write()` 호출. 정정: 이전 재검증 오류 |

---

## CRITICAL -- 즉시 수정 필요 (미해결)

### B-001: agent:create IPC 리턴 타입 불일치
- **생산자:** `src/main/ipc-handlers.ts:32-37` -- `ApiResponse` 객체 (`{success, data: AgentConfig}`) 리턴
- **소비자:** `src/renderer/ipc/preload.ts:61` -- `Promise<AgentState>` 기대
- **영향:** `agentStore.ts:26`에서 리턴값을 `AgentState`로 agents 배열에 push하지만, 실제로는 ApiResponse wrapper가 들어감
- **수정 방안:**
  - (A) Main에서 ApiResponse wrapper 제거하고 AgentState 직접 리턴, 또는
  - (B) Preload에서 ApiResponse를 unwrap하는 레이어 추가
  - 추가로 `AgentConfig` vs `AgentState` 리턴 타입도 통일 필요

### B-004: chat:send IPC 인자 shape 불일치
- **생산자:** `src/renderer/ipc/preload.ts:82` -- `ipcRenderer.invoke(CHAT_SEND, { content, to, files })` 객체 전달
- **소비자:** `src/main/ipc-handlers.ts:91` -- `async (_event, content: string, files?: string[])` 분리 인자 기대
- **영향:** Main에서 `content`에 전체 객체 `{content, to, files}`가 들어가고, `files`는 undefined. `to` 배열(멘션 대상)이 완전히 누락되어 라우팅 실패
- **수정 방안:** Main 핸들러를 `async (_event, { content, to, files })` 형태로 수정

### B-005: approval:respond IPC 인자 shape 불일치
- **생산자:** `src/renderer/ipc/preload.ts:95` -- `{ id, action: 'approve'|'deny' }` 객체 전달
- **소비자:** `src/main/ipc-handlers.ts:112` -- `(approvalId: string, approved: boolean)` 분리 인자 기대
- **영향:** approvalId에 객체가 들어가고 approved는 undefined
- **수정 방안:** Main 핸들러를 `async (_event, { id, action })` 형태로 수정

### B-006: file:read IPC 양방향 불일치
- **생산자:** `src/renderer/ipc/preload.ts:103` -- `path: string` 단일 인자 전달, `FileContent` 리턴 기대
- **소비자:** `src/main/ipc-handlers.ts:122` -- `FileReadRequest` 객체 기대, `ApiResponse<string>` 리턴
- **영향:** Main에서 `req.path`가 아닌 `req` 자체가 string이 됨. 리턴도 `{success, data: string}`인데 Renderer는 `FileContent` 기대
- **수정 방안:** 양쪽 인터페이스 통일 필요. Preload에서 path를 `{path}` 객체로 감싸고, Main에서 FileContent 형태로 리턴하도록 수정

### B-007: file:list IPC 양방향 불일치
- **생산자:** `src/renderer/ipc/preload.ts:104` -- `rootPath: string` 전달, `FileTreeNode[]` 기대
- **소비자:** `src/main/ipc-handlers.ts:148` -- `FileListRequest` 기대, `ApiResponse<string>` 리턴
- **영향:** tree string이 FileTreeNode[] 대신 리턴됨
- **수정 방안:** Main에서 FileTreeNode[] 구조체를 구축하여 리턴하도록 변경

### B-008: file:search IPC 양방향 불일치
- **생산자:** `src/renderer/ipc/preload.ts:105` -- `query: string` 전달, `{path, agentName}[]` 기대
- **소비자:** `src/main/ipc-handlers.ts:169` -- `FileSearchRequest` 기대, `ApiResponse<SearchResult[]>` 리턴
- **영향:** SearchResult는 `{file, line, content}`인데 Renderer는 `{path, agentName}` 기대
- **수정 방안:** 리턴 shape 통일 필요

### B-002/003: agent:start/stop/restart/killAll ApiResponse unwrap 누락
- **생산자:** `src/main/ipc-handlers.ts:41-75` -- 모든 agent 액션이 `ApiResponse` 리턴
- **소비자:** `src/renderer/ipc/preload.ts:62-65` -- `Promise<void>` 기대
- **영향:** 에러 시 `{success: false, error: "..."}` 객체가 리턴되지만 Renderer에서 에러를 감지하지 못함. 실패가 조용히 무시됨
- **수정 방안:** Preload에서 ApiResponse를 확인하고 success가 false면 throw하는 unwrap 레이어 추가

---

## HIGH -- 조속한 수정 필요

### B-011: chat:loop-warning 이벤트 shape 불일치
- **생산자:** `src/main/ipc-handlers.ts:229` -- `send(CHAT_LOOP_WARNING, event.message, event.conversation)`
- **소비자:** `src/renderer/ipc/preload.ts:89` -- `callback(agentId: string, depth: number)`
- **영향:** Renderer에서 message string을 agentId로, conversation string을 depth(number)로 받음. UI 경고 메시지가 왜곡됨
- **수정 방안:** Main에서 보내는 인자를 `(agentId, depth)`로 변경하거나, Renderer 콜백을 `(message, conversation)`으로 변경

### B-012: AgentState shared type에 pid/channelPort 누락
- **위치:** `src/shared/types.ts:14-22` vs `src/main/agent-manager.ts:70-76`
- **영향:** agent-manager에서 생성하는 state 객체에 `pid`와 `channelPort`가 포함되지만 shared type에는 없음. TypeScript 컴파일 에러
- **수정 방안:** `AgentState` 인터페이스에 `pid?: number; channelPort?: number;` 추가

### B-013: agent:create 리턴이 AgentConfig인데 AgentState로 사용
- **위치:** `src/main/ipc-handlers.ts:33` -- data에 `AgentConfig` 할당, `agentStore.ts:26` -- `AgentState`로 push
- **영향:** AgentConfig에는 `status`, `tokenUsage`, `lastActivity` 필드가 없고, AgentState에는 `role`, `channelPort`, `autoApprovePatterns` 등이 없음
- **수정 방안:** Main에서 createAgent 후 AgentState를 리턴하도록 변경

---

## MEDIUM -- 컴파일 에러

### B-014: MessageType import 미존재
- **위치:** `src/main/message-router.ts:8` -- `import type { MessageType } from '../shared/types'`
- **영향:** `types.ts`에 `MessageType` export가 없음. 컴파일 에러
- **수정 방안:** import 제거 (실제로 코드에서 사용되지 않음), 또는 `type MessageType = ChatMessage['type']`을 types.ts에 추가

---

## LOW -- 기능 미완성 (TODO)

### settings store 미연동
- **위치:** `src/renderer/App.tsx:17-29` -- `DEFAULT_SETTINGS` 하드코딩
- **영향:** 설정 변경이 persist되지 않음
- **수정 방안:** settingsStore를 생성하여 `electronAPI.settings.get()`으로 초기 로딩, `save()`로 persist
