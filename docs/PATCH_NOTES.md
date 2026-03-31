# ClaudeTeam v0.1.0 — 패치 내역 및 실행 기록

**빌드 일시:** 2026-03-31
**커밋:** `112dced` feat: ClaudeTeam Electron 앱 풀스택 초기 구현
**브랜치:** `claude/stupefied-nash`
**변경 규모:** 70개 파일, +12,535줄

---

## 1. 실행 개요

에이전트 팀 기반 4단계 파이프라인으로 ClaudeTeam Electron 앱의 풀스택 초기 구현을 완료했다.

```
Phase 1: 설계      → ui-designer (서브에이전트)
Phase 2: 구현      → frontend-dev + backend-dev + qa-inspector (에이전트 팀)
Phase 3: 최종 검증 → qa-inspector
Phase 4: 정리      → 팀 해체, 커밋, 푸시
```

### 투입 에이전트

| 에이전트 | 타입 | 역할 | 모델 |
|---------|------|------|------|
| ui-designer | ui-designer | 와이어프레임, 컴포넌트 구조 설계 | opus |
| frontend-dev | frontend-dev | Electron Renderer UI 구현 | opus |
| backend-dev | backend-dev | Main Process, Channel Server 구현 | opus |
| qa-inspector | qa-inspector | 경계면 교차 비교 검증 | opus |
| team-lead | (오케스트레이터) | 파이프라인 조율, 이슈 수정 | opus |

---

## 2. Phase별 실행 기록

### Phase 1: 설계 (Design)

ui-designer를 서브에이전트로 호출하여 PRD와 기술 아키텍처 문서를 기반으로 설계 산출물을 생성했다.

**산출물** (`_workspace/01_design/`):

| 파일 | 내용 |
|------|------|
| `wireframes.md` (36KB) | 10개 화면 ASCII 와이어프레임 — 메인 레이아웃, 사이드바, 에이전트 생성, 팀 채팅, 터미널, 파일 뷰어, 권한 대시보드, 설정, 알림, 키보드 단축키 |
| `component-tree.md` (15KB) | React 컴포넌트 계층 43개, Props 인터페이스 초안, 재사용 컴포넌트 7개 식별, Zustand 스토어 스키마, IPC 채널 매핑 20개 |
| `navigation-flow.md` (13KB) | US-01~US-08 유저 스토리별 네비게이션 경로, 콘텐츠 뷰 전환 상태도, 모달 상태 다이어그램, 조건부 전환 규칙 8개 |
| `design-tokens.md` (9KB) | Catppuccin Mocha 다크 테마, 색상 팔레트, 타이포그래피(Inter + JetBrains Mono), 스페이싱 10단계, Z-Index 10단계, 애니메이션 4단계 |

### Phase 2: 구현 (Build)

에이전트 팀(`claudeteam-build`)을 구성하여 frontend-dev와 backend-dev를 병렬로 실행하고, qa-inspector가 점진적(incremental) 검증을 수행했다.

**생성된 소스 코드: 54개 파일, 7,435줄**

#### Frontend (src/renderer/ — 44파일, 4,782줄)

```
src/renderer/
├── App.tsx, main.tsx                    — 엔트리 포인트
├── ipc/api.ts                           — IPC facade (ApiResponse unwrap 포함)
├── stores/                              — Zustand 상태 관리
│   ├── agentStore.ts                    — 에이전트 CRUD, 상태 관리
│   ├── chatStore.ts                     — 메시지 히스토리, 전송
│   ├── approvalStore.ts                 — 권한 승인 큐
│   ├── fileStore.ts                     — 파일 트리, 열린 파일
│   └── uiStore.ts                       — 패널 크기, 모달, 뷰 상태
├── components/
│   ├── layout/                          — MainLayout, ElectronTitleBar
│   ├── sidebar/Sidebar.tsx              — 에이전트 목록, 상태 인디케이터
│   ├── terminal/                        — TerminalPane, TabBar, ApprovalBanner, StatusBar, ContentArea
│   ├── chat/                            — ChatPanel, ChatInput, MessageItem, MentionAutocomplete,
│   │                                      CodeBlock, FileReferenceCard, FilePreviewPanel,
│   │                                      DateDivider, LoopWarningBanner, MessageActions
│   ├── fileviewer/                      — FileViewerView, FileTree, CodeViewer, MarkdownViewer,
│   │                                      ImageViewer, QuickOpenDialog
│   ├── modals/                          — AgentCreateDialog, ApprovalDashboard, SettingsPanel
│   └── common/                          — AgentAvatar, StatusIndicator, NotificationStack,
│                                          ContextMenu, ResizeHandle
├── hooks/
│   ├── useIpcListeners.ts               — Main Process 이벤트 구독
│   └── useKeyboardShortcuts.ts          — Cmd+1~9, Cmd+P 등
└── styles/
    ├── tokens.css                       — CSS 변수 111개 (디자인 토큰)
    └── global.css                       — 글로벌 스타일, 다크 테마
```

#### Backend (src/main/ — 7파일, 1,849줄)

| 파일 | 줄 수 | 역할 |
|------|-------|------|
| `index.ts` | 80 | Electron 앱 진입점, BrowserWindow 생성, preload 연결 |
| `preload.ts` | 122 | contextBridge 기반 ElectronAPI 노출 (19개 IPC 채널) |
| `ipc-handlers.ts` | 310 | IPC 핸들러 등록 — 에이전트 CRUD, 채팅, 파일, 설정, 터미널 |
| `agent-manager.ts` | 350 | node-pty 프로세스 관리, Claude Code 세션 시작/중지/재시작 |
| `message-router.ts` | 303 | Hub-and-Spoke 라우팅, @멘션 파싱, 루프 방지 (depth=5), Cooldown |
| `router-http-server.ts` | 364 | HTTP API 서버 — 메시지 수신, 파일 공유, 에이전트 등록/해제 |
| `session-store.ts` | 320 | SQLite 영속화 — 에이전트 설정, 메시지, 팀 프리셋, 세션 복원 |

#### Channel Server (src/channel/ — 2파일, 404줄)

| 파일 | 줄 수 | 역할 |
|------|-------|------|
| `channel-server.ts` | 220 | Bun + MCP SDK, stdio transport → Claude Code, HTTP inbound ← Router |
| `mcp-tools-server.ts` | 184 | MCP 도구 5개 — team_message, team_read_file, team_list_files, team_search_files, team_status |

#### Shared (src/shared/ — 1파일, 248줄)

| 파일 | 내용 |
|------|------|
| `types.ts` | AgentState, AgentConfig, ChatMessage, ApprovalRequest, AppSettings, IPC_CHANNELS, ApiResponse, RouterEvent 등 전체 공유 타입 |

#### 프로젝트 설정 (3파일, 83줄)

| 파일 | 역할 |
|------|------|
| `package.json` | React 19, Zustand 5, xterm.js 5, Electron 33, better-sqlite3, MCP SDK |
| `tsconfig.json` | TypeScript strict 모드, path aliases |
| `vite.config.ts` | Vite + React 플러그인 |

### Phase 3: 최종 통합 검증

qa-inspector가 4차에 걸쳐 경계면 교차 비교 검증을 수행했다.

**최종 판정: ALL PASS**

| 검증 영역 | 결과 |
|----------|------|
| IPC 채널 정합성 (19개 채널) | PASS |
| 공유 타입 일관성 (types.ts) | PASS |
| Router ↔ Channel Server HTTP | PASS |
| MCP Tools Server ↔ Router HTTP | PASS |
| 디자인 토큰 (111개) | PASS |
| 컴포넌트 커버리지 (43/43) | PASS |
| Zustand Store 구조 | PASS |
| 상태 전이 | PASS (waiting_approval은 TODO) |

---

## 3. QA 이슈 이력

검증 과정에서 16건의 경계면 이슈를 발견하고 전건 해결했다.

### 근본 원인: Preload 파일 중복 (B-015)

frontend-dev와 backend-dev가 각각 독립적으로 preload 파일을 작성하여 2개가 존재했다:
- `src/main/preload.ts` (backend-dev 작성) — Electron이 실제 사용
- `src/renderer/ipc/preload.ts` (frontend-dev 작성) — 프론트 컴포넌트가 타입 참조

두 파일의 API shape이 달랐고, 이것이 CRITICAL 이슈 10건의 근본 원인이었다.

**해결:** `src/renderer/ipc/preload.ts`를 삭제하고, `src/renderer/ipc/api.ts`에 ApiResponse unwrap 레이어를 도입하여 `src/main/preload.ts`와 직접 연동.

### 이슈 상세

| ID | 심각도 | 내용 | 수정자 |
|----|--------|------|--------|
| B-001 | CRITICAL | agent:create 리턴 타입 불일치 (ApiResponse vs AgentState) | frontend-dev |
| B-002/003 | CRITICAL | agent:start/stop/restart ApiResponse unwrap 누락 | frontend-dev |
| B-004 | CRITICAL | chat:send `to` 배열 누락으로 메시지 라우팅 실패 | frontend-dev |
| B-005 | CRITICAL | approval:respond 인자 shape 불일치 | frontend-dev |
| B-006 | CRITICAL | file:read 양방향 불일치 (string vs FileReadRequest) | frontend-dev |
| B-007 | CRITICAL | file:list 리턴 shape 불일치 (string vs FileTreeNode[]) | frontend-dev |
| B-008 | CRITICAL | file:search 리턴 shape 불일치 | frontend-dev |
| B-009/010 | CRITICAL | settings get/save ApiResponse unwrap 누락 | frontend-dev |
| B-011 | HIGH | chat:loop-warning 이벤트 shape 불일치 | frontend-dev |
| B-012 | HIGH | AgentState에 pid/channelPort 필드 누락 | team-lead |
| B-013 | HIGH | AgentConfig → AgentState double cast (동작은 함) | frontend-dev |
| B-014 | MEDIUM | MessageType import 미존재 (컴파일 에러) | team-lead |
| B-015 | CRITICAL | Preload 파일 2개 존재, API shape 충돌 (근본 원인) | frontend-dev |
| B-016 | CRITICAL | terminal.sendInput vs terminal.write 메서드명 충돌 | frontend-dev |

### 검증 라운드

| 라운드 | 검증 내용 | 결과 |
|--------|----------|------|
| 1차 | 초기 경계면 스캔 | CRITICAL 8, HIGH 3, MEDIUM 1, LOW 1 발견 |
| 2차 | 근본 원인 분석 | Preload 중복(B-015) + terminal 메서드명(B-016) 발견 |
| 3차 | 디자인 토큰, 컴포넌트 커버리지 | 토큰 PASS, 커버리지 84% → 미구현 7개 식별 |
| 4차 | frontend 수정 후 재검증 | 프론트 전건 FIXED, 백엔드 2건 잔존 |
| 최종 | team-lead 직접 수정 후 재검증 | ALL PASS (16/16 해결) |

---

## 4. 아키텍처 요약

```
┌──────────────────────────────────────────────────────────┐
│                    Electron App                           │
│                                                          │
│  ┌─────────────────┐    IPC (19채널)    ┌──────────────┐ │
│  │   Renderer       │ ◄──────────────► │ Main Process  │ │
│  │                  │   contextBridge   │               │ │
│  │  React 19        │                  │ AgentManager  │ │
│  │  Zustand 5       │                  │ (node-pty)    │ │
│  │  xterm.js 5      │                  │               │ │
│  │  43 components   │                  │ IpcHandlers   │ │
│  │  5 stores        │                  │ SessionStore  │ │
│  │  api.ts facade   │                  │ (SQLite)      │ │
│  └─────────────────┘                  └──────┬───────┘ │
│                                               │         │
│                                          HTTP (localhost)│
│                                               │         │
│  ┌──────────────────┐    HTTP     ┌──────────┴───────┐ │
│  │  Channel Server   │ ◄────────► │  Message Router   │ │
│  │  (Bun + MCP SDK)  │            │  (Hub-and-Spoke)  │ │
│  │                   │            │                    │ │
│  │  stdio ↕ Claude   │            │  @멘션 파싱        │ │
│  │  MCP Tools (5개)  │            │  루프 방지 (d=5)   │ │
│  └──────────────────┘            │  Cooldown          │ │
│                                   └────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 통신 프로토콜

| 경로 | 방식 | 용도 |
|------|------|------|
| Renderer ↔ Main | IPC (contextBridge) | UI 조작, 에이전트 관리, 파일 I/O |
| Main ↔ Channel Server | HTTP (localhost) | 메시지 라우팅, 에이전트 등록 |
| Channel Server ↔ Claude Code | stdio (MCP) | AI 에이전트 통신 |
| Main ↔ SQLite | sql.js (WebAssembly) | 영속화 (에이전트, 메시지, 설정) |

---

## 5. 기술 스택

| 레이어 | 기술 | 버전 |
|--------|------|------|
| Desktop Shell | Electron | 41.x |
| Renderer | React + TypeScript | 19.x / 5.7+ |
| 상태 관리 | Zustand | 5.x |
| 터미널 | @xterm/xterm | 5.5+ |
| 코드 뷰어 | react-syntax-highlighter | 16.x |
| 마크다운 | react-markdown | 9.x |
| 아이콘 | lucide-react | 0.469+ |
| Main Process | node-pty, sql.js (WebAssembly) | 1.x / 1.11+ |
| Channel Server | Bun + @modelcontextprotocol/sdk | 1.12+ |
| 빌드 | Vite + @vitejs/plugin-react | 6.x |
| 패키징 | electron-builder | 26.x |

---

## 6. 알려진 제한사항 (TODO)

| 항목 | 상태 | 설명 |
|------|------|------|
| waiting_approval 상태 전이 | TODO | Approval 시스템이 IPC handler에서 AgentManager로 연동되지 않음 |
| Settings 영속화 | TODO | App.tsx에서 DEFAULT_SETTINGS 하드코딩, settingsStore 미연동 |
| B-013 double cast | 동작함 | Main이 AgentState를 직접 리턴하면 불필요한 cast 제거 가능 |
| Spring Boot API | 미구현 | 설계 문서에 명시된 REST API (`src/api/`)는 Main Process에 통합됨 |
| E2E 테스트 | 미구현 | 단위 테스트, 통합 테스트 미작성 |
| electron-builder 패키징 | 미실행 | macOS .dmg 빌드 미수행 |

---

## 7. QA 보고서 목록

| 파일 | 내용 |
|------|------|
| `_workspace/qa/final-integration-report.md` | Phase 3 최종 통합 검증 보고서 (ALL PASS) |
| `_workspace/qa/boundary-report.md` | 경계면 교차 비교 상세 |
| `_workspace/qa/issues.md` | 이슈 16건 상세 (발견~해결 추적) |
| `_workspace/qa/spec-coverage.md` | 스펙 커버리지 (디자인 토큰, 컴포넌트) |
| `_workspace/qa/final-report.md` | 프론트엔드 최종 검증 |

---

## 8. 포스트 빌드 패치 (v0.1.1)

초기 빌드(v0.1.0) 이후 실제 Electron 앱 실행까지 발견된 이슈들을 해결한 패치 내역.

### 8.1 빌드 에러 수정

| 커밋 | 내용 |
|------|------|
| `ff094a6` | **tsc 빌드 에러 4건** — Bun 타입(`bun-types`) 미인식, Electron 전용 CSS(`WebkitAppRegion`) TS 에러. `tsconfig.json`에 `exclude: ["src/channel", "src/main"]` 추가, `@ts-expect-error` 주석 처리 |
| `75abce6` | **Main Process 출력 경로 오류** — `tsconfig.main.json`의 `rootDir: "."`가 `dist/main/src/main/index.js` 경로를 생성. `rootDir: "src"`로 변경하여 `dist/main/main/index.js` 출력. `package.json`의 `main`/`start` 경로도 수정 |

### 8.2 네이티브 모듈 호환성

| 커밋 | 내용 |
|------|------|
| `0776e31` | **better-sqlite3 ABI 불일치** — Node.js MODULE_VERSION 127 vs Electron 145 충돌. `better-sqlite3` → `sql.js`(WebAssembly) 전환. `session-store.ts` 전면 재작성 (동기→비동기 초기화, `waitReady()` 패턴, `persist()` 메서드 추가). 네이티브 빌드 의존성 제거로 `electron-rebuild` 불필요 |

### 8.3 Electron file:// 프로토콜 호환성 (빈 화면 수정)

앱이 실행되지만 **빈 흰색 화면**만 표시되는 문제. 3가지 근본 원인을 단계적으로 발견하고 해결했다.

| 원인 | 상세 | 수정 |
|------|------|------|
| **CSP가 JS 실행 차단** | `<meta http-equiv="Content-Security-Policy">`의 `script-src 'self'`가 `file://` 프로토콜에서 origin=null이 되어 모든 스크립트 로딩 차단 | HTML에서 CSP 제거 → `session.defaultSession.webRequest.onHeadersReceived()`로 Main Process에서 CSP 설정 |
| **Vite crossorigin 속성** | Vite가 `<script>`, `<link>`에 `crossorigin` 속성을 자동 삽입. `file://`에는 CORS 서버가 없어 스크립트 로드 실패 | Vite 커스텀 플러그인 `removeCrossOrigin()`으로 빌드 시 속성 제거 |
| **Vite base 절대 경로** | Vite 기본 `base: '/'`가 `src="/assets/..."` 절대 경로 생성. `file://`에서 시스템 루트 `/assets/` 참조 | `base: './'`로 상대 경로(`./assets/...`) 설정 |

**디버깅 과정:**

```
1. ELECTRON_ENABLE_LOGGING=1 로 로그 캡처
2. console-message 이벤트로 Renderer 콘솔 → Main stdout 전달
3. did-finish-load 발생하지만 console-message 없음 → JS 미실행 확인
4. CSP 제거 후 JS 실행 확인 → CSP가 원인
5. executeJavaScript('document.getElementById("root").innerHTML') → React 렌더링 확인
6. getComputedStyle(document.body).backgroundColor → rgb(30, 30, 46) 다크 테마 확인
```

### 8.4 의존성 보안 취약점 해결

| 커밋 | 내용 |
|------|------|
| `1106ef1` | **npm 취약점 15건 → 0건** — `npm audit fix --force`로 메이저 업그레이드 |

| 패키지 | 이전 | 이후 | 취약점 |
|--------|------|------|--------|
| electron | 33.x | 41.1.0 | ASAR Integrity Bypass (moderate) |
| electron-builder | 25.x | 26.8.1 | tar 경로 순회 취약점 9건 (high) |
| react-syntax-highlighter | 15.x | 16.1.1 | PrismJS DOM Clobbering (moderate) |

### 8.5 문서 업데이트

| 커밋 | 내용 |
|------|------|
| `11eec28` | 배포 가이드 — 사전 설치를 Homebrew 기반으로 변경 (Bun은 curl 유지), 이미 생성된 파일 설명으로 수정 |
| `07a5206` | 빌드 섹션에 `npm run build:all` 통합 빌드 명령 추가 |

### 8.6 수정된 파일 요약

| 파일 | 변경 내용 |
|------|----------|
| `vite.config.ts` | `base: './'`, `removeCrossOrigin()` 플러그인, `modulePreload: { polyfill: false }` |
| `src/main/index.ts` | CSP를 `session.webRequest.onHeadersReceived`로 이동, `session` import 추가 |
| `index.html` | CSP `<meta>` 태그 제거 (Main Process에서 설정) |
| `src/main/session-store.ts` | better-sqlite3 → sql.js 전면 재작성 |
| `tsconfig.json` | `exclude: ["src/channel", "src/main"]` 추가 |
| `tsconfig.main.json` | `rootDir: "src"` 수정 |
| `package.json` | electron 41, electron-builder 26, sql.js, main/start 경로 수정 |

---

## 9. 빌드 및 실행 방법

```bash
# 의존성 설치
npm install

# 전체 빌드 (Renderer + Main + Channel)
npm run build:all

# Electron 앱 실행 (프로덕션 모드)
npm start

# 개발 모드 (Vite dev server + Electron 동시 실행)
npm run dev          # 1번 터미널: Renderer (Vite dev server :5173)
npm run dev:main     # 2번 터미널: Main Process (tsc --watch)
NODE_ENV=development npm start  # 3번 터미널: Electron 실행
```

> **참고:** 프로덕션 모드(`npm start`)는 빌드된 `dist/renderer/index.html`을 로드합니다.
> 개발 모드(`NODE_ENV=development`)는 Vite dev server(`localhost:5173`)에 연결하며, DevTools가 자동으로 열립니다.
