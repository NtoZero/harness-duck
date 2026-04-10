# ClaudeTeam QA 체크리스트 (실행용)

**사용법:** PR 리뷰 또는 릴리스 전 아래 체크리스트를 순서대로 실행한다.
**기준 문서:** [QA_TEST_STANDARDS.md](./QA_TEST_STANDARDS.md)

---

## Phase 0: 빌드 게이트

```bash
npx tsc --noEmit                          # 렌더러 타입 체크
npx tsc -p tsconfig.main.json --noEmit    # 메인 프로세스 타입 체크
npx vite build                            # 렌더러 번들
```

- [ ] 3개 명령 모두 에러 0건

---

## Phase 1: 백엔드 정적 검증

### 1-A. message-router.ts

- [ ] `parseMentions()` regex가 `/@([\w가-힣][\w가-힣-]*)/g` 인가
- [ ] 쿨다운 분기에서 `saveMessage()` 호출하는가
- [ ] depth 초과 분기에서 `saveMessage()` 호출하는가

### 1-B. router-http-server.ts

- [ ] `readBody()`에 MAX_BODY_SIZE 제한이 있는가
- [ ] JSON 파싱 실패 시 `null` 반환하는가 (빈 객체 아님)
- [ ] 모든 POST 핸들러에 `if (!body)` 가드가 있는가
- [ ] `handleFileRead`에 경로 검증이 있는가
- [ ] `handleFileList`에 경로 순회 방지가 있는가
- [ ] `handleFileSearch`에 regex 유효성 검사가 있는가
- [ ] SSE 핸들러가 모든 이벤트 타입을 전달하는가
- [ ] `handleMessage`에서 `conversationDepth`를 `body`에서 읽는가

### 1-C. agent-manager.ts

- [ ] `ManagedAgent`에 `intentionallyStopped`, `restartCount`, `lastRestartTime` 필드 존재
- [ ] `createAgent()`에 이름 검증 regex 적용
- [ ] `startAgent()`에서 `intentionallyStopped = false` 리셋
- [ ] `onExit`에서 `intentionallyStopped` 체크 → true면 자동재시작 건너뜀
- [ ] `onExit`에서 `MAX_RESTARTS(3)` + 지수 백오프 적용
- [ ] `stopAgent()`에서 `intentionallyStopped = true` 설정
- [ ] `deleteAgent()`가 async이고 `await stopAgent()` 호출
- [ ] CLAUDE.md 마커: `<!-- CLAUDETEAM:START -->` / `<!-- CLAUDETEAM:END -->`
- [ ] 승인 감지: ANSI 스트리핑 후 `[Y/n]` 테스트
- [ ] 라우터 등록: PTY 첫 출력 또는 3초 타임아웃 후

### 1-D. session-store.ts

- [ ] `PRAGMA journal_mode = WAL` 제거됨
- [ ] 모든 쿼리가 parameterized binding 사용

---

## Phase 2: 채널 정적 검증

### 2-A. mcp-tools-server.ts

- [ ] `CLAUDETEAM_ROUTER_PORT` 환경변수에서 URL 구성 (ROUTER_URL 직접 사용 아님)
- [ ] `CallToolRequestSchema` 핸들러 전체가 try/catch로 감싸져 있는가

### 2-B. channel-server.ts

- [ ] HTTP 바디 크기 제한 (Content-Length 체크)
- [ ] MCP 알림 별도 try/catch (HTTP 응답에 영향 없음)
- [ ] 하트비트 인터벌이 SIGINT/SIGTERM에서 `clearInterval` 되는가

---

## Phase 3: 프론트엔드 정적 검증

### 3-A. Stores

- [ ] `chatStore.sendMessage`: 낙관적 메시지 추가 → API 호출 → 실패 시 제거
- [ ] `chatStore.addMessage`: ID 기반 dedup + temp 메시지 대체
- [ ] `approvalStore.approve/deny`: 낙관적 업데이트 → 병렬 IPC → 실패 시 롤백
- [ ] `agentStore`: start/stop/restart/killAll에 try/catch

### 3-B. Hooks

- [ ] `useIpcListeners`: 승인 알림 onClick이 `approvalStore.approve/deny` 호출

### 3-C. Components

- [ ] `TerminalPane`: fontFamily가 리터럴 폰트 스택
- [ ] `ChatPanel`: LoopWarning이 경계점에서만 표시, FilePreviewPanel 코드 없음
- [ ] `ChatInput`: 파일첨부 버튼 `disabled` + `title="파일 첨부 (준비 중)"`
- [ ] `AgentCreateDialog`: 오버레이/취소 클릭 시 `resetForm()` 호출
- [ ] `App.tsx`: approvalStore 개별 셀렉터 사용
- [ ] `Sidebar`: 호버 스타일이 React state 기반
- [ ] `MessageItem`: @멘션 regex `/@([\w가-힣][\w가-힣-]*)/g`

---

## Phase 4: IPC 정합성

- [ ] `preload.ts`의 채널명 ↔ `ipc-handlers.ts`의 핸들러 ↔ `api.ts`의 래퍼 일치
- [ ] `delivery_failed` 이벤트가 렌더러에 전달되는가
- [ ] `ElectronAPI` 타입과 `api.ts` 사용이 일치하는가

---

## Phase 5: DB 상태 검증 (앱 실행 후)

```bash
# node로 실행 (프로젝트 루트에서)
node -e "
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(path.join(require('os').homedir(), '.claudeteam', 'data.db')));
  ['agents','messages','team_presets','settings','audit_log','auto_approve_rules'].forEach(t => {
    const r = db.exec('SELECT COUNT(*) FROM ' + t);
    console.log(t + ': ' + r[0]?.values[0][0]);
  });
  db.close();
})();
"
```

- [ ] agents 테이블에 기대 에이전트 수 존재
- [ ] messages 테이블에 전송한 메시지 수 일치
- [ ] audit_log에 승인/거부 이력 기록

---

## Phase 6: 기능 시나리오 테스트 (앱 실행 후)

### S1. 에이전트 생성 및 시작

1. [ ] 에이전트 추가 버튼 → 다이얼로그 열림
2. [ ] 이름, 디렉토리, 역할 입력 후 생성
3. [ ] 사이드바에 에이전트 표시
4. [ ] 에이전트 시작 → 터미널에 Claude Code 출력
5. [ ] 상태 indicator가 running으로 변경

### S2. 채팅 메시지 전송

1. [ ] `@에이전트이름 안녕하세요` 입력 → Cmd+Enter
2. [ ] 메시지가 즉시 UI에 표시 (Optimistic)
3. [ ] 서버 에코 후 메시지 ID 업데이트 (중복 없음)
4. [ ] 에이전트가 메시지 수신 (터미널에서 확인)

### S3. @멘션 구두점 테스트

1. [ ] `@에이전트, 확인해주세요` → 정상 라우팅
2. [ ] `@에이전트. 끝.` → 정상 라우팅
3. [ ] `user@email.com` → 에이전트로 오인 안 함

### S4. 승인 시스템

1. [ ] 에이전트가 도구 사용 시 [Y/n] 프롬프트 감지
2. [ ] 알림 팝업 표시
3. [ ] 승인 클릭 → pending에서 history로 이동
4. [ ] 에이전트 터미널에 `y` 전달

### S5. 에이전트 중지 / 재시작

1. [ ] 컨텍스트 메뉴 → 중지 → 상태 idle
2. [ ] 중지 후 자동재시작 발생하지 않음
3. [ ] 컨텍스트 메뉴 → 재시작 → 정상 기동

### S6. 폼 리셋

1. [ ] 에이전트 생성 다이얼로그에서 값 입력 후 취소 → 다시 열었을 때 빈 폼
2. [ ] 오버레이 클릭으로 닫기 → 다시 열었을 때 빈 폼

---

## 결과 기록

| 항목 | 날짜 | 결과 | 비고 |
|------|------|------|------|
| Phase 0 빌드 | | PASS / FAIL | |
| Phase 1 백엔드 | | _건 / _건 | |
| Phase 2 채널 | | _건 / _건 | |
| Phase 3 프론트 | | _건 / _건 | |
| Phase 4 IPC | | _건 / _건 | |
| Phase 5 DB | | PASS / FAIL | |
| Phase 6 시나리오 | | _건 / _건 | |
| **종합** | | **_점 / 100** | |

### 심각도별 이슈 수

| 등급 | 수량 | 목표 |
|------|------|------|
| CRITICAL | | 0건 |
| HIGH | | 3건 이하 |
| MEDIUM | | - |
| LOW | | - |
