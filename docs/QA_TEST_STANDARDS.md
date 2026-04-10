# ClaudeTeam QA 테스트 기준 및 원칙

**최초 작성:** 2026-04-10
**대상:** ClaudeTeam Electron Desktop App
**목적:** 반복 가능한 QA 검증 기준을 수립하여 코드 변경 시마다 일관된 품질 게이트를 적용

---

## 1. 검증 범위 및 계층

### 1.1 아키텍처 계층별 검증 대상

| 계층 | 핵심 파일 | 검증 항목 |
|------|-----------|-----------|
| **Message Router** | `src/main/message-router.ts` | @멘션 파싱, 루프 방지, 쿨다운, 메시지 영속화 |
| **HTTP Router Server** | `src/main/router-http-server.ts` | REST API 정합성, 입력 검증, 보안, SSE |
| **Agent Manager** | `src/main/agent-manager.ts` | 라이프사이클, PTY 관리, 승인 감지, 자동재시작 |
| **Session Store** | `src/main/session-store.ts` | 스키마 마이그레이션, 영속화, SQL 인젝션 방어 |
| **Channel Server** | `src/channel/channel-server.ts` | MCP 알림, HTTP 수신, 하트비트 |
| **MCP Tools Server** | `src/channel/mcp-tools-server.ts` | 환경변수, 도구 정합성, 에러 핸들링 |
| **Zustand Stores** | `src/renderer/stores/*.ts` | 상태 업데이트, 레이스컨디션, 에러 전파 |
| **IPC Layer** | `src/renderer/ipc/api.ts`, `src/main/preload.ts` | 채널명 일관성, 타입 안전성 |
| **React Components** | `src/renderer/components/**/*.tsx` | UX 완성도, 접근성, 데이터 플로우 |

### 1.2 검증 방식

| 방식 | 적용 대상 | 도구 |
|------|-----------|------|
| **정적 코드 분석** | 전 계층 | TypeScript strict, 수동 코드 리뷰 |
| **DB 상태 검증** | SessionStore | sql.js 직접 쿼리 (`~/.claudeteam/data.db`) |
| **API 테스트** | HTTP Router | curl / fetch 기반 엔드포인트 호출 |
| **빌드 검증** | 전체 | `tsc --noEmit`, `vite build`, `tsc -p tsconfig.main.json` |
| **MCP Preview** | 렌더러 UI | preview_start, preview_snapshot, preview_screenshot |

---

## 2. 심각도 분류 기준

| 등급 | 정의 | 기준 | SLA |
|------|------|------|-----|
| **CRITICAL** | 핵심 기능 불가 또는 데이터 유실 | 메시지 라우팅 실패, 데이터 미저장, 무한루프, 상태 불일치 | 즉시 수정 |
| **HIGH** | 보안 취약점 또는 주요 UX 결함 | 경로 순회, ReDoS, 에러 핸들링 누락, Optimistic Update 부재 | 다음 릴리스 전 |
| **MEDIUM** | 사용성 저하 또는 부분 기능 결함 | UI 오동작, 이벤트 누락, 폼 리셋 미흡 | 2주 내 |
| **LOW** | 개선 사항 또는 코드 품질 | 접근성, 코드 스타일, 미미한 UX 개선 | 백로그 |

---

## 3. 기능별 테스트 체크리스트

### 3.1 메시지 라우팅 (Message Router)

#### @멘션 파싱

- [ ] 기본: `@에이전트 메시지` → 정상 라우팅
- [ ] 구두점 후행: `@에이전트, 확인해주세요` → 쉼표가 이름에 포함되지 않음
- [ ] 마침표 후행: `@에이전트. 분석 완료` → 마침표가 이름에 포함되지 않음
- [ ] 콜론 후행: `@에이전트: 결과는` → 콜론이 이름에 포함되지 않음
- [ ] 한글 이름: `@백엔드 API 확인` → 한글 에이전트 정상 매칭
- [ ] 하이픈 이름: `@backend-dev 배포 확인` → 하이픈 포함 이름 매칭
- [ ] 다중 멘션: `@백엔드 @프론트 동기화` → 두 에이전트 모두 수신
- [ ] 미등록 이름: `@없는에이전트 테스트` → 무시, 에러 없음
- [ ] 이메일 주소: `user@email.com 참고` → 에이전트로 오인하지 않음
- [ ] 정규식 패턴: `/@([\w가-힣][\w가-힣-]*)/g` 사용 확인

#### 루프 방지

- [ ] conversationDepth가 maxConversationDepth 도달 시 loop_warning 발행
- [ ] loop_warning 후에도 메시지가 DB에 저장됨
- [ ] 쿨다운 발동 시에도 메시지가 DB에 저장됨
- [ ] 쿨다운 윈도우(30초) 경과 후 카운터 리셋

#### 메시지 영속화

- [ ] 정상 메시지 → messages 테이블에 INSERT
- [ ] depth 초과 메시지 → 저장됨
- [ ] 쿨다운 메시지 → 저장됨
- [ ] 메시지 ID 중복 없음 (UUID)

### 3.2 HTTP Router Server

#### 입력 검증

- [ ] 잘못된 JSON 바디 → 400 응답 (`Invalid JSON body`)
- [ ] 빈 바디 → 400 응답
- [ ] 1MB 초과 바디 → 연결 종료 (Request body too large)
- [ ] POST 핸들러 전체에 null 가드 적용 확인

#### 보안

- [ ] `/api/fs/read`: 절대 경로만 허용, 에이전트 workingDirectory 외부 접근 차단
- [ ] `/api/fs/list`: subpath가 workingDirectory 외부로 탈출 불가 (`../../../etc/passwd`)
- [ ] `/api/fs/search`: 유효하지 않은 정규식 → 400 응답 (`Invalid regex pattern`)
- [ ] CORS 헤더 정상 설정 (`Access-Control-Allow-Origin: *`)

#### SSE 스트림

- [ ] `message` 이벤트 전달
- [ ] `loop_warning` 이벤트 전달
- [ ] `delivery_failed` 이벤트 전달
- [ ] `approval_request` 이벤트 전달
- [ ] 클라이언트 연결 해제 시 리스너 정리

#### conversationDepth

- [ ] 외부 API 호출 시 `body.conversationDepth` 값 전달 가능
- [ ] 미전달 시 기본값 0

### 3.3 에이전트 라이프사이클 (Agent Manager)

#### 생성

- [ ] 유효한 이름 → 정상 생성, DB 저장
- [ ] 중복 이름 → 에러 (`already exists`)
- [ ] 유효하지 않은 이름 (특수문자, 50자 초과) → 에러
- [ ] 존재하지 않는 디렉토리 → 에러
- [ ] 이름 패턴: `/^[\w가-힣][\w가-힣-]{0,49}$/`

#### 시작

- [ ] PTY 프로세스 생성, PID 할당
- [ ] CLAUDE.md 생성 (마커 기반: `<!-- CLAUDETEAM:START -->` ~ `<!-- CLAUDETEAM:END -->`)
- [ ] 기존 CLAUDE.md 내용 보존 (마커 외부 콘텐츠)
- [ ] .mcp.json 채널 서버 등록
- [ ] 환경변수 설정: `CLAUDETEAM_AGENT_NAME`, `CLAUDETEAM_ROUTER_PORT`, `CLAUDETEAM_CHANNEL_PORT`
- [ ] 라우터 등록이 PTY 첫 출력 이후 또는 3초 타임아웃 후 수행
- [ ] `intentionallyStopped = false` 리셋

#### 중지

- [ ] `intentionallyStopped = true` 설정 후 PTY kill
- [ ] onExit에서 자동재시작 트리거되지 않음
- [ ] 라우터에서 에이전트 해제
- [ ] 상태 `idle`로 전이

#### 자동재시작

- [ ] 비정상 종료(exitCode != 0) 시 자동재시작 시도
- [ ] 최대 3회 제한 (60초 윈도우 내)
- [ ] 지수 백오프: 5초, 10초, 20초 (최대 30초)
- [ ] 의도적 종료 시 재시작하지 않음
- [ ] 3회 초과 시 `error` 상태 유지, 로그 출력

#### 삭제

- [ ] 실행 중인 에이전트 → `stopAgent` await 후 삭제
- [ ] DB에서 삭제
- [ ] 에이전트 맵에서 삭제

#### 포트 할당

- [ ] 기본 시작 포트 7700
- [ ] 저장된 에이전트의 최대 포트 + 1부터 시작

#### 승인 감지

- [ ] `[Y/n]` 패턴 감지 (ANSI 코드 스트리핑 후)
- [ ] 자동승인 규칙 매칭 시 `y\n` 자동 전송
- [ ] 수동 승인 요청 이벤트 발행
- [ ] `waiting_approval` 상태 전이

### 3.4 데이터베이스 (Session Store)

- [ ] 스키마 버전 2 마이그레이션 정상 동작
- [ ] 모든 쓰기 후 `persist()` 호출 (디스크 저장)
- [ ] SQL 인젝션 방어: 모든 쿼리에 parameterized binding 사용
- [ ] `PRAGMA foreign_keys = ON` 설정
- [ ] WAL pragma 미사용 (sql.js WASM에서 무효)

### 3.5 채널 서버 (Channel Server)

- [ ] 환경변수 `CLAUDETEAM_ROUTER_PORT` 사용 (ROUTER_URL 아님)
- [ ] MCP 알림 실패 시 HTTP 응답에 영향 없음 (별도 try/catch)
- [ ] HTTP 바디 1MB 제한
- [ ] SIGINT/SIGTERM 시 하트비트 인터벌 정리
- [ ] 데몬 등록 해제 시도

### 3.6 MCP Tools Server

- [ ] `CLAUDETEAM_ROUTER_PORT`에서 URL 구성 확인
- [ ] 5개 도구 전체 try/catch 적용
- [ ] 라우터 다운 시 에러 메시지 반환 (크래시 아님)

### 3.7 프론트엔드 Stores

#### chatStore

- [ ] Optimistic Update: 전송 즉시 UI에 임시 메시지 표시 (`temp-` prefix)
- [ ] 서버 에코 수신 시 임시 메시지 대체 (dedup)
- [ ] 전송 실패 시 임시 메시지 제거
- [ ] 동일 ID 메시지 중복 추가 방지

#### approvalStore

- [ ] approve/deny: 낙관적 상태 업데이트 먼저 수행
- [ ] IPC 호출 병렬 실행 (`Promise.all`)
- [ ] IPC 실패 시 상태 롤백
- [ ] 알림 onClick이 store 경유 (api 직접 호출 아님)

#### agentStore

- [ ] startAgent/stopAgent/restartAgent/killAll: try/catch 적용
- [ ] 에러 시 console.error + throw (상위에서 처리 가능)

### 3.8 UI 컴포넌트

#### 터미널 (TerminalPane)

- [ ] fontFamily: 리터럴 폰트 스택 사용 (CSS 변수 아님)
- [ ] xterm.js 정상 초기화, 리사이즈 동작
- [ ] 언마운트 시 정리 (dispose, ResizeObserver disconnect)

#### 채팅 (ChatPanel)

- [ ] LoopWarning: 경계점에서만 1회 표시 (depth < 4 → >= 4 전이 시)
- [ ] 미사용 FilePreviewPanel 코드 없음
- [ ] 자동 스크롤: 새 메시지 시 하단으로

#### 채팅 입력 (ChatInput)

- [ ] 파일첨부 버튼: `disabled`, 툴팁 "파일 첨부 (준비 중)"
- [ ] @멘션 자동완성 동작
- [ ] Cmd+Enter 전송

#### 에이전트 생성 다이얼로그 (AgentCreateDialog)

- [ ] 오버레이 클릭 시 폼 리셋 + 닫기
- [ ] 취소 버튼 클릭 시 폼 리셋 + 닫기
- [ ] 제출 후 폼 리셋

#### 사이드바 (Sidebar)

- [ ] 호버 스타일: React state 기반 (DOM 직접 조작 아님)
- [ ] 네비게이션 버튼 호버 스타일 동일

#### 메시지 아이템 (MessageItem)

- [ ] @멘션 하이라이트 regex: `/@([\w가-힣][\w가-힣-]*)/g` (라우터와 동일)
- [ ] 이메일 주소의 @ 오탐지 없음

#### App.tsx

- [ ] approvalStore 개별 셀렉터 사용 (전체 구독 아님)

---

## 4. 보안 테스트 기준

### 4.1 입력 검증

| 대상 | 검증 항목 | 기대 결과 |
|------|-----------|-----------|
| HTTP 바디 | 1MB 초과 | 연결 종료 |
| JSON 파싱 | 잘못된 JSON | 400 응답 |
| 파일 경로 | `../../etc/passwd` | 403 Forbidden |
| 정규식 | `(a+)+$` (ReDoS) | 400 응답 |
| 에이전트 이름 | `<script>alert(1)</script>` | 생성 거부 |

### 4.2 경로 순회 (Path Traversal)

```
테스트 케이스:
POST /api/fs/read  {"path": "/etc/passwd"}               → 403 또는 404
POST /api/fs/read  {"path": "../../../etc/shadow"}        → 403
POST /api/fs/list  {"target": "agent", "subpath": "../../"} → 403
```

### 4.3 SQL 인젝션

- 모든 DB 쿼리에 parameterized binding 사용 확인
- 사용자 입력이 SQL 문자열에 직접 삽입되는 곳 없음

### 4.4 XSS / 인젝션

- 에이전트 이름에 HTML/XML 특수문자 불가 (이름 검증 regex)
- 채널 메시지 XML 태그에 이름 삽입 시 이스케이프 확인

---

## 5. 데이터 플로우 검증

### 5.1 채팅 메시지 라이프사이클

```
[사용자 입력] → ChatInput.handleSend()
  → chatStore.sendMessage()
    → (1) 낙관적 메시지 추가 (temp-* ID)
    → (2) api.chat.send() → IPC → Main Process
      → MessageRouter.routeMessage()
        → parseMentions() → 대상 에이전트 결정
        → store.saveMessage() → DB 영속화
        → fetch → Channel Server → MCP 알림 → Claude Code
        → emitToUI('message') → IPC → Renderer
      → chatStore.addMessage()
        → temp 메시지 대체 (dedup)
        → UI 업데이트
```

**검증 포인트:**
1. 낙관적 메시지가 즉시 UI에 표시되는가
2. 서버 에코가 temp 메시지를 대체하는가 (중복 없음)
3. 전송 실패 시 temp 메시지가 제거되는가
4. DB에 메시지가 정확히 1건 저장되는가

### 5.2 승인 플로우

```
[PTY 출력 [Y/n]] → AgentManager.processTerminalOutput()
  → ANSI 스트리핑 → APPROVAL_PATTERN 매칭
  → shouldAutoApprove() 체크
    → 자동승인: ptyProcess.write('y\n')
    → 수동승인:
      → state → 'waiting_approval'
      → emit('approval-request') → IPC → Renderer
        → useIpcListeners → approvalStore.addRequest()
        → UI 알림 표시
        → 사용자 클릭 → approvalStore.approve/deny()
          → (1) 낙관적 상태 업데이트
          → (2) api.approval.respond() → IPC → Main
            → AgentManager.handleApprovalResponse()
              → ptyProcess.write('y\n' 또는 'n\n')
```

**검증 포인트:**
1. ANSI 코드가 포함된 출력에서도 [Y/n] 감지 가능한가
2. 알림 버튼이 store를 경유하는가 (api 직접 호출 아님)
3. 낙관적 업데이트 후 IPC 실패 시 롤백되는가
4. pending → history 전이가 정확한가

### 5.3 에이전트 라이프사이클

```
[생성] → createAgent() → DB 저장 → 상태 'idle'
[시작] → startAgent()
  → CLAUDE.md 생성 (마커 기반)
  → .mcp.json 등록
  → PTY spawn → 상태 'running'
  → PTY 첫 출력 → 라우터 등록
[중지] → stopAgent()
  → intentionallyStopped = true
  → PTY kill → onExit → 상태 'idle' (재시작 안 함)
[크래시] → onExit(exitCode != 0)
  → intentionallyStopped == false
  → restartCount < MAX_RESTARTS → 백오프 후 재시작
  → restartCount >= MAX_RESTARTS → 상태 'error' 유지
[삭제] → deleteAgent()
  → await stopAgent() → DB 삭제
```

---

## 6. IPC 채널 정합성

### 6.1 채널명 일관성 검증

`src/shared/types.ts`의 `IPC_CHANNELS` 상수가 아래 3곳에서 동일하게 사용되는지 확인:

| 위치 | 파일 | 역할 |
|------|------|------|
| 정의 | `src/shared/types.ts` | 채널명 상수 |
| Main | `src/main/preload.ts` | contextBridge 노출 |
| Renderer | `src/renderer/ipc/api.ts` | API 래퍼 |

### 6.2 타입 안전성

- `preload.ts`의 `ElectronAPI` 타입과 `api.ts`의 사용이 일치하는가
- invoke 반환값 `{ success, data?, error? }` 패턴 통일

---

## 7. 외부 프로젝트 연동 검증

### 7.1 Quroup 프로젝트 호환성

| 항목 | 검증 기준 |
|------|-----------|
| 에이전트 생성 | Quroup BE/FE/Plan 디렉토리를 workingDirectory로 지정 가능 |
| 모델 호환 | ClaudeTeam은 `sonnet`, `opus`만 지원 (`haiku` 불가) |
| 스킬 연동 | `.claude/skills/` 내 스킬은 ClaudeTeam 채널로 직접 호출 불가 (Claude Code 내장) |
| 에이전트 형식 | `.claude/agents/*.md`(네이티브) ↔ `AgentConfig`(JSON) 형식 비호환 |
| MCP 도구 | ClaudeTeam 5개 도구: team_message, team_read_file, team_list_files, team_search_files, team_status |

### 7.2 채팅 데이터 검증

- [ ] messages 테이블 스키마 정합 (id, chat_id, sender, recipients, content, files, type, conversation_depth, created_at)
- [ ] 메시지 저장 후 `GET /api/messages?limit=N`으로 조회 가능
- [ ] 채팅 세션 ID별 메시지 그룹화 (`chat_id`)
- [ ] 메시지 타입 제약 (`request`, `response`, `broadcast`)

---

## 8. 빌드 검증 게이트

모든 PR 병합 전 아래 명령이 에러 없이 통과해야 한다:

```bash
# 1. 렌더러 타입 체크
npx tsc --noEmit

# 2. 메인 프로세스 타입 체크
npx tsc -p tsconfig.main.json --noEmit

# 3. 렌더러 빌드
npx vite build

# 4. (선택) 메인 프로세스 빌드
npx tsc -p tsconfig.main.json

# 5. (선택) 채널 서버 빌드
bun build src/channel/channel-server.ts --outdir dist/channel --target bun
```

---

## 9. DB 상태 검증 스크립트

```javascript
// QA 검증 시 DB 상태 확인용
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function inspectDB() {
  const SQL = await initSqlJs();
  const dbPath = path.join(require('os').homedir(), '.claudeteam', 'data.db');
  const db = new SQL.Database(fs.readFileSync(dbPath));

  // 테이블별 레코드 수
  const tables = ['agents', 'messages', 'team_presets', 'settings', 'audit_log', 'auto_approve_rules'];
  for (const t of tables) {
    const r = db.exec(`SELECT COUNT(*) FROM ${t}`);
    console.log(`${t}: ${r[0]?.values[0][0]} rows`);
  }

  // 에이전트 목록
  const agents = db.exec('SELECT name, working_directory, model FROM agents');
  if (agents[0]) agents[0].values.forEach(a => console.log(`Agent: ${a[0]} (${a[2]}) → ${a[1]}`));

  // 최근 메시지
  const msgs = db.exec('SELECT sender, substr(content,1,80), type, created_at FROM messages ORDER BY created_at DESC LIMIT 5');
  if (msgs[0]) msgs[0].values.forEach(m => console.log(`[${m[2]}] ${m[0]}: ${m[1]}`));

  db.close();
}
inspectDB();
```

---

## 10. 점수 기준

| 영역 | 가중치 | 만점 기준 |
|------|--------|-----------|
| 아키텍처 설계 | 15% | MCP 기반 채널, PTY 에이전트, HTTP+IPC 이중 접근 |
| 핵심 기능 구현 | 25% | 라우팅, 영속화, 라이프사이클에 CRITICAL 결함 0건 |
| 보안 | 20% | 경로 순회 차단, 바디 크기 제한, ReDoS 방어, SQL 인젝션 방어 |
| UX 완성도 | 15% | Optimistic update, 에러 피드백, 폼 리셋, 접근성 |
| 외부 연동 | 10% | Quroup 프로젝트 에이전트 생성/통신 가능 |
| 데이터 관리 | 15% | 스키마 정합, 영속화, 메시지 dedup, 이벤트 전달 완전성 |

**합격 기준:**
- CRITICAL 결함: 0건
- HIGH 결함: 3건 이하
- 종합 점수: 70점 이상
