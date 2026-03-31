---
name: spring-api
description: "Spring Boot 기반 REST API와 Electron Main Process(Agent Manager, Message Router, Channel Server)를 구현한다. 팀 관리 API, 에이전트 라이프사이클, MCP 채널 서버, SQLite 영속화를 포함한다. 'API 구현', 'Spring Boot', '백엔드 구현', '메시지 라우터', 'Channel Server' 키워드가 나오면 이 스킬을 사용할 것."
---

# Spring API — 백엔드 서비스 & Main Process 구현

Spring Boot REST API와 Electron Main Process의 핵심 서비스를 구현한다.

## 기술 스택
- **Spring Boot 3.x** — REST API, Validation, Exception Handling
- **SQLite** — 세션 스토어 (spring-boot-starter-data-jpa + sqlite-dialect)
- **Node.js / Bun** — Electron Main Process, MCP Channel Server
- **node-pty** — Claude Code 프로세스 관리
- **MCP SDK** (@modelcontextprotocol/sdk) — Channel Server 프로토콜

## 구현 영역

### 1. Spring Boot REST API

```
src/api/
├── controller/
│   ├── AgentController.java    (CRUD + 시작/중지)
│   ├── TeamController.java     (팀 프리셋 관리)
│   ├── MessageController.java  (메시지 조회/검색)
│   └── HealthController.java
├── service/
│   ├── AgentService.java
│   ├── TeamService.java
│   └── MessageService.java
├── repository/
│   ├── AgentRepository.java
│   ├── TeamRepository.java
│   └── MessageRepository.java
├── dto/
│   ├── AgentConfigDto.java
│   ├── AgentStateDto.java
│   ├── MessageDto.java
│   └── TeamPresetDto.java
├── entity/
│   ├── Agent.java
│   ├── Team.java
│   └── Message.java
└── config/
    ├── WebConfig.java
    └── SqliteConfig.java
```

**API 엔드포인트:**

| Method | Path | 설명 |
|--------|------|------|
| POST | /api/agents | 에이전트 생성 |
| GET | /api/agents | 에이전트 목록 조회 |
| GET | /api/agents/{id} | 에이전트 상태 조회 |
| POST | /api/agents/{id}/start | 에이전트 시작 |
| POST | /api/agents/{id}/stop | 에이전트 중지 |
| GET | /api/messages | 메시지 목록 (필터: chatId, from, to) |
| POST | /api/messages | 사용자 메시지 전송 |
| GET | /api/teams | 팀 프리셋 목록 |
| POST | /api/teams | 팀 프리셋 저장 |

모든 응답은 통일된 포맷을 따른다:
```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

### 2. Electron Main Process

```
src/main/
├── AgentManager.ts     (node-pty 프로세스 관리)
├── MessageRouter.ts    (메시지 라우팅, 루프 방지)
├── IpcHandlers.ts      (Renderer ↔ Main IPC 핸들러)
├── ClaudeMdGenerator.ts (에이전트별 CLAUDE.md 자동 생성)
└── index.ts            (Electron app 진입점)
```

**AgentManager — 에이전트 라이프사이클:**
1. CLAUDE.md 생성 (역할 + 통신 프로토콜 주입)
2. .mcp.json에 채널 서버 등록
3. node-pty로 Claude Code 프로세스 시작 (`claude --dangerously-load-development-channels`)
4. 채널 서버 포트 대기
5. Message Router에 에이전트 등록
6. 상태 → 'running'

**MessageRouter — 메시지 라우팅:**
- @멘션 파싱 → 대상 에이전트 채널 서버로 HTTP 전달
- 왕복 횟수 추적 (conversationDepth) → 제한 초과 시 차단
- 파일 참조(절대경로) 감지 → 인라인 삽입 또는 경로 전달
- 모든 메시지 SQLite에 영속화

### 3. MCP Channel Server

에이전트당 하나의 채널 서버를 Bun으로 실행한다:

```
src/channel/
├── channel-server.ts   (MCP Server + HTTP 인바운드)
├── tools/
│   └── reply.ts        (reply 도구 정의)
└── types.ts            (메시지 포맷 타입)
```

채널 서버의 역할:
- Claude Code가 stdio 트랜스포트로 연결
- Message Router로부터 HTTP로 메시지 수신 → MCP notification으로 Claude에 전달
- Claude의 reply 도구 호출 → HTTP로 Message Router에 응답 전달

### 4. 안전장치
- **루프 방지**: maxConversationDepth (기본 5회) 초과 시 메시지 차단 + UI 경고
- **파일 쓰기 제한**: 에이전트는 자기 workingDirectory 외부에 쓰기 불가
- **쿨다운**: 동일 에이전트 쌍 간 30초 내 5회 이상 메시지 시 쿨다운
- **긴급 정지**: Kill All → 모든 node-pty 프로세스 SIGTERM

## 주의사항
- Spring API는 localhost만 바인딩 (외부 네트워크 미사용)
- 에이전트 간 통신은 항상 Message Router 경유 (Hub-and-Spoke)
- node-pty는 Electron electron-rebuild로 네이티브 리빌드 필요
- Channel Server는 에이전트 종료 시 함께 종료되어야 함 (좀비 프로세스 방지)
