# ClaudeTeam E2E 테스트 자동화 계획

**작성일:** 2026-03-31
**대상:** ClaudeTeam Electron Desktop App v0.1.x

---

## 1. 테스트 프레임워크 선정

### 1.1 2계층 전략

| 계층 | 프레임워크 | 용도 | 선정 이유 |
|------|-----------|------|----------|
| **MCP 기반 E2E** | Claude Preview MCP | 개발 중 UI 검증 | Vite dev 서버 연동, 스크린샷/DOM 스냅샷/CSS 검사/클릭/입력 자동화, 코드 수정 즉시 반영 |
| **CI용 E2E** | Playwright + Electron | CI/CD 파이프라인 | Electron 공식 지원, headless 모드, 크로스 플랫폼, 빠른 실행 |
| **유닛/통합** | Vitest + @testing-library/react | Store/IPC/컴포넌트 | Vite 네이티브 통합, ESM 지원, Jest 호환 API |

### 1.2 MCP 도구 매핑

| MCP 도구 | 테스트 용도 | 대응 Playwright API |
|---------|-----------|-------------------|
| `preview_start` | Vite dev 서버 실행 | `electron.launch()` |
| `preview_screenshot` | 시각적 레이아웃 확인 | `page.screenshot()` |
| `preview_snapshot` | 접근성 트리 검증 (텍스트, 요소 존재) | `page.getByRole()` |
| `preview_inspect` | CSS 속성 검증 (색상, 폰트, 크기) | `expect(locator).toHaveCSS()` |
| `preview_click` | 버튼/요소 클릭 | `page.click()` |
| `preview_fill` | 입력 필드 값 입력 | `page.fill()` |
| `preview_eval` | JS 실행 (상태 검사, React 이벤트) | `page.evaluate()` |
| `preview_console_logs` | 콘솔 에러 감시 | `page.on('console')` |
| `preview_resize` | 반응형 레이아웃 테스트 | `page.setViewportSize()` |

### 1.3 launch.json 설정

```json
// .claude/launch.json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "claudeteam-dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 5173
    }
  ]
}
```

### 디렉토리 구조

```
tests/
├── e2e/                          # Playwright E2E
│   ├── fixtures/                 # 테스트 픽스처 (설정 파일, 더미 프로젝트)
│   │   └── dummy-project/        # 에이전트 작업 디렉토리용 더미 프로젝트
│   ├── app-launch.spec.ts        # T-001: 앱 실행 테스트
│   ├── agent-lifecycle.spec.ts   # T-002~005: 에이전트 CRUD
│   ├── settings.spec.ts          # T-006~008: 설정 영속화
│   ├── approval.spec.ts          # T-009~011: 승인 워크플로
│   ├── navigation.spec.ts        # T-012~014: 화면 전환
│   ├── terminal.spec.ts          # T-015~016: 터미널 뷰
│   ├── chat.spec.ts              # T-017~018: 팀 채팅
│   └── helpers/
│       ├── electron-app.ts       # Electron 앱 시작/종료 헬퍼
│       └── ipc-mock.ts           # IPC 목 헬퍼
├── unit/                         # Vitest 유닛 테스트
│   ├── stores/                   # Zustand 스토어 테스트
│   │   ├── agentStore.test.ts
│   │   ├── chatStore.test.ts
│   │   ├── approvalStore.test.ts
│   │   ├── fileStore.test.ts
│   │   └── uiStore.test.ts
│   ├── ipc/
│   │   └── api.test.ts           # API unwrap/mock 테스트
│   └── main/
│       ├── message-router.test.ts
│       ├── session-store.test.ts
│       └── agent-manager.test.ts
├── integration/                  # IPC 경계면 통합 테스트
│   ├── ipc-channels.test.ts      # 19개 IPC 채널 정합성
│   ├── approval-flow.test.ts     # 승인 요청 → 응답 전체 흐름
│   └── settings-persist.test.ts  # 설정 저장 → 재시작 → 로드
├── playwright.config.ts
├── vitest.config.ts
└── setup.ts                      # 전역 설정 (DB 초기화 등)
```

---

## 2. E2E 테스트 케이스

> 각 테스트는 **MCP 기반** (개발 중 수동/반자동 검증)과 **Playwright 기반** (CI 자동화) 두 가지 실행 방법을 제공합니다.

### T-001: 앱 정상 실행

**MCP 실행:**
```
1. preview_start(configName: "claudeteam-dev")     → Vite dev 서버 기동
2. preview_screenshot(serverId)                      → 초기 화면 렌더링 확인
3. preview_inspect(serverId, selector: "body")       → background-color 검증
4. preview_snapshot(serverId)                         → 접근성 트리에서 UI 요소 존재 확인
5. preview_console_logs(serverId)                     → 콘솔 에러 없음 검증
```

**Playwright:**
```
Given  앱이 빌드된 상태
When   npm start로 앱 실행
Then   BrowserWindow가 열리고
       body background-color가 rgb(30, 30, 46) (다크 테마)
       #root에 자식 요소가 존재
       Router HTTP 서버가 127.0.0.1:7632에서 리스닝
       title이 "ClaudeTeam"
```

### T-002: 에이전트 생성 — 정상

**MCP 실행:**
```
1. preview_click(serverId, selector: "[에이전트 추가 버튼]")
2. preview_snapshot(serverId)                         → 모달 열림 확인
3. preview_fill(serverId, selector: "input[name]", value: "test-agent")
4. preview_fill(serverId, selector: "input[workdir]", value: "/tmp/test")
5. preview_click(serverId, selector: "[에이전트 생성 버튼]")
6. preview_snapshot(serverId)                         → 모달 닫힘, 사이드바에 에이전트 표시
7. preview_console_logs(serverId)                     → 에러 없음 확인
```

**Playwright:**
```
Given  앱이 실행된 상태
When   "에이전트 추가" 버튼 클릭
       → 이름: "test-agent", 작업 디렉토리: 유효한 경로 입력
       → "에이전트 생성" 버튼 클릭
Then   모달이 닫히고
       사이드바에 "test-agent"가 표시
       상태 인디케이터가 idle (회색)
       토큰 표시가 "0"
       activeAgentId가 해당 에이전트로 설정
```

### T-003: 에이전트 생성 — 필수 필드 미입력

**MCP 실행:**
```
1. preview_click(serverId, selector: "[에이전트 추가 버튼]")
2. preview_inspect(serverId, selector: "[에이전트 생성 버튼]")  → disabled 속성 확인
3. preview_click(serverId, selector: "[에이전트 생성 버튼]")
4. preview_snapshot(serverId)                                    → 모달 여전히 열림 확인
```

**Playwright:**
```
Given  에이전트 생성 모달이 열린 상태
When   이름이 비어 있는 채로 "에이전트 생성" 클릭
Then   버튼이 disabled 상태
       모달이 닫히지 않음
```

### T-004: 에이전트 생성 — 존재하지 않는 디렉토리

**MCP 실행:**
```
1. preview_fill(serverId, selector: "input[name]", value: "bad-agent")
2. preview_fill(serverId, selector: "input[workdir]", value: "/nonexistent/path")
3. preview_click(serverId, selector: "[에이전트 생성 버튼]")
4. preview_console_logs(serverId)                                → 에러 로그 확인 (크래시 없음)
5. preview_snapshot(serverId)                                    → 사이드바에 에이전트 미추가 확인
```

**Playwright:**
```
Given  에이전트 생성 모달이 열린 상태
When   이름: "bad-agent", 작업 디렉토리: "/nonexistent/path"
       → "에이전트 생성" 클릭
Then   에러가 발생하되 앱이 크래시하지 않음
       사이드바에 에이전트가 추가되지 않음
```

### T-005: 에이전트 생성 — 디렉토리 탐색기

**MCP 실행:** *(Vite dev 서버에서는 네이티브 다이얼로그 미지원, mock 반환값 검증)*
```
1. preview_eval(serverId, expression: "window.electronAPI?.dialog")  → mock 존재 확인
2. preview_click(serverId, selector: "[폴더 탐색 버튼]")
3. preview_snapshot(serverId)                                        → 입력 필드 상태 확인
```

**Playwright:**
```
Given  에이전트 생성 모달이 열린 상태
When   📁 버튼 클릭
Then   OS 네이티브 디렉토리 선택 대화상자가 열림
       디렉토리 선택 시 입력 필드에 경로가 채워짐
```

### T-006: 설정 — 저장 및 영속화

**MCP 실행:**
```
1. preview_click(serverId, selector: "[설정 버튼]")
2. preview_snapshot(serverId)                         → 설정 모달 4개 탭 확인 (일반, 팀, 안전장치, 고급)
3. preview_click(serverId, selector: "[모델 셀렉트]")
4. preview_click(serverId, selector: "[opus 옵션]")
5. preview_click(serverId, selector: "[저장 버튼]")
6. preview_eval(serverId, expression: "...")           → 저장된 설정 값 확인
```

**Playwright:**
```
Given  설정 모달이 열린 상태
When   기본 모델을 "opus"로 변경 → "저장" 클릭
       → 앱 재시작
Then   설정 모달에서 기본 모델이 "opus"로 표시
```

### T-007: 설정 — 팀 프리셋 탭

**MCP 실행:**
```
1. preview_click(serverId, selector: "[팀 탭]")
2. preview_snapshot(serverId)                         → 팀 탭 UI 확인
3. preview_click(serverId, selector: "[프리셋 추가]")
4. preview_fill(serverId, selector: "[프리셋 이름]", value: "test-preset")
5. preview_snapshot(serverId)                         → 프리셋 목록에 추가 확인
```

**Playwright:**
```
Given  설정 모달 → "팀" 탭
When   "프리셋 추가" 클릭 → 이름 입력 → 에이전트 추가
Then   프리셋 목록에 새 항목 표시
       "저장" 후 재열기 시 데이터 유지
```

### T-008: 설정 — 고급 설정 탭

**MCP 실행:**
```
1. preview_click(serverId, selector: "[고급 탭]")
2. preview_snapshot(serverId)                         → 고급 탭 UI 확인 (포트, 깊이, 토큰 임계)
3. preview_fill(serverId, selector: "[포트 입력]", value: "8000")
4. preview_click(serverId, selector: "[저장 버튼]")
5. preview_eval(serverId, expression: "...")           → 저장 후 값 확인
```

**Playwright:**
```
Given  설정 모달 → "고급" 탭
When   Router 포트를 8000으로 변경 → "저장"
Then   저장 후 재열기 시 포트가 8000으로 표시
```

### T-009: 승인 — 대시보드 열기

**MCP 실행:**
```
1. preview_click(serverId, selector: "[승인 대시보드 버튼]")
2. preview_snapshot(serverId)                         → 모달 열림, "대기 중"/"히스토리" 탭 확인
3. preview_screenshot(serverId)                       → 시각적 레이아웃 검증
```

**Playwright:**
```
Given  앱이 실행된 상태
When   사이드바 "승인 대시보드" 클릭
Then   ApprovalDashboard 모달이 열림
       "대기 중" 탭과 "히스토리" 탭이 표시
```

### T-010: 승인 — AutoApproveRule 관리

**MCP 실행:**
```
1. preview_click(serverId, selector: "[규칙 추가 버튼]")
2. preview_fill(serverId, selector: "[에이전트 패턴]", value: "*")
3. preview_fill(serverId, selector: "[도구 패턴]", value: "Read(*)")
4. preview_snapshot(serverId)                         → 규칙 목록에 표시 확인
5. preview_eval(serverId, expression: "...")           → store 상태에서 규칙 영속화 확인
```

**Playwright:**
```
Given  승인 대시보드가 열린 상태
When   자동 승인 규칙 추가 → 에이전트: "*", 패턴: "Read(*)"
Then   규칙이 목록에 표시
       앱 재시작 후에도 규칙이 유지 (IPC 영속화)
```

### T-011: 승인 — 승인/거부 동작 (Mock)

**MCP 실행:**
```
1. preview_eval(serverId, expression: "/* approvalStore에 mock 요청 주입 */")
2. preview_snapshot(serverId)                         → 대기 중 요청 표시 확인
3. preview_click(serverId, selector: "[승인 버튼]")
4. preview_snapshot(serverId)                         → 대기 목록에서 제거, 히스토리로 이동 확인
```

**Playwright:**
```
Given  대기 중인 승인 요청이 있는 상태 (Mock 주입)
When   "승인" 버튼 클릭
Then   요청이 대기 목록에서 제거
       히스토리에 "approved" 상태로 이동
```

### T-012: 화면 전환 — 터미널 뷰

**MCP 실행:**
```
1. /* T-002로 에이전트 생성 후 */
2. preview_click(serverId, selector: "[사이드바 에이전트 항목]")
3. preview_snapshot(serverId)                         → ContentArea에 터미널 뷰, 탭 바에 이름 확인
4. preview_screenshot(serverId)                       → 레이아웃 시각 검증
```

**Playwright:**
```
Given  에이전트가 1개 이상 있는 상태
When   사이드바에서 에이전트 클릭
Then   ContentArea에 터미널 뷰가 표시
       탭 바에 에이전트 이름 표시
```

### T-013: 화면 전환 — 파일 탐색기

**MCP 실행:**
```
1. preview_click(serverId, selector: "[파일 탐색기 버튼]")
2. preview_snapshot(serverId)                         → FileViewerView 표시, 파일 트리 존재 확인
3. preview_screenshot(serverId)                       → 레이아웃 검증
```

**Playwright:**
```
Given  앱이 실행된 상태
When   사이드바 "파일 탐색기" 클릭
Then   FileViewerView가 표시
       파일 트리 패널이 좌측에 표시
```

### T-014: 화면 전환 — 키보드 단축키

**MCP 실행:** *(MCP에서 키보드 이벤트는 preview_eval로 시뮬레이션)*
```
1. preview_eval(serverId, expression: "document.dispatchEvent(new KeyboardEvent('keydown', {key:'1', metaKey:true}))")
2. preview_snapshot(serverId)                         → 첫 번째 에이전트 뷰 활성화 확인
```

**Playwright:**
```
Given  에이전트가 3개 있는 상태
When   Cmd+1, Cmd+2, Cmd+3 입력
Then   각 에이전트의 터미널 뷰로 전환
```

### T-015: 터미널 — xterm.js 렌더링

**MCP 실행:**
```
1. preview_eval(serverId, expression: "document.querySelector('.xterm')?.clientHeight")
2. preview_inspect(serverId, selector: ".xterm")      → 렌더링 상태, 크기 속성 확인
3. preview_screenshot(serverId)                        → 터미널 시각적 렌더링 확인
```

**Playwright:**
```
Given  에이전트가 running 상태
When   터미널 뷰로 이동
Then   xterm.js 터미널이 렌더링됨
       터미널 높이/너비가 컨테이너에 맞게 조절
```

### T-016: 터미널 — 입력 전송

**MCP 실행:**
```
1. preview_eval(serverId, expression: "/* terminal write mock 호출 카운터 설정 */")
2. preview_eval(serverId, expression: "/* 키보드 이벤트 시뮬레이션 */")
3. preview_eval(serverId, expression: "/* mock 호출 확인 */")
```

**Playwright:**
```
Given  터미널이 표시된 상태
When   키보드로 "ls\n" 입력
Then   IPC terminal:input이 호출됨
```

### T-017: 팀 채팅 — 메시지 전송

**MCP 실행:**
```
1. preview_click(serverId, selector: "[채팅 탭]")
2. preview_fill(serverId, selector: "[채팅 입력]", value: "@all 안녕하세요")
3. preview_eval(serverId, expression: "/* Enter 키 이벤트 발행 */")
4. preview_snapshot(serverId)                         → MessageItem 추가 확인
5. preview_console_logs(serverId)                     → IPC 호출 로그 확인
```

**Playwright:**
```
Given  ChatPanel이 표시된 상태
When   입력창에 "@all 안녕하세요" 입력 → Enter
Then   IPC chat:send가 호출됨
       MessageItem이 채팅 목록에 추가
```

### T-018: 팀 채팅 — @멘션 자동완성

**MCP 실행:**
```
1. preview_fill(serverId, selector: "[채팅 입력]", value: "@ba")
2. preview_snapshot(serverId)                         → MentionAutocomplete 팝업 표시 확인
3. preview_screenshot(serverId)                       → 자동완성 시각 확인
```

**Playwright:**
```
Given  에이전트 "backend"가 있는 상태
When   채팅 입력에 "@ba" 입력
Then   MentionAutocomplete이 표시
       "backend" 항목이 자동완성 목록에 표시
```

---

## 3. 유닛 테스트 (Vitest)

### 3.1 Zustand Store 테스트

| 파일 | 테스트 항목 |
|------|-----------|
| `agentStore.test.ts` | createAgent, startAgent, stopAgent, updateAgentState, setActiveAgent |
| `chatStore.test.ts` | addMessage, sendMessage, clearMessages |
| `approvalStore.test.ts` | addRequest, approve, deny, setAutoRules, loadRules |
| `fileStore.test.ts` | openFile, readFileLines, searchFiles |
| `uiStore.test.ts` | openModal, closeModal, setActiveView, setSidebarWidth |

### 3.2 IPC api.ts 테스트

| 테스트 항목 |
|-----------|
| unwrap: success response → data 반환 |
| unwrap: failure response → IpcError throw |
| mock: electronAPI 미존재 시 mock 사용 |
| 각 api.* 메서드가 올바른 IPC 채널 호출 |

### 3.3 Main Process 테스트

| 파일 | 테스트 항목 |
|------|-----------|
| `session-store.test.ts` | saveAgent, getAgent, saveMessage, getAppSettings, saveAutoApproveRules |
| `message-router.test.ts` | @멘션 파싱, 루프 감지, 대화 깊이 제한, cooldown |
| `agent-manager.test.ts` | createAgent 유효성 검증, 포트 할당, 승인 패턴 감지, 토큰 파싱 |

---

## 4. 통합 테스트 (IPC 경계면)

### 4.1 IPC 채널 정합성 (21개 채널)

```typescript
// ipc-channels.test.ts
// types.ts에 정의된 모든 IPC_CHANNELS가:
// 1. ipc-handlers.ts에 핸들러가 등록되어 있는지
// 2. preload.ts에 메서드가 노출되어 있는지
// 3. api.ts에 unwrap 레이어가 있는지
// 를 정적 분석으로 검증
```

### 4.2 승인 흐름 통합 테스트

```
1. AgentManager.createAgent() 호출
2. 에이전트 터미널 출력에 "[Y/n]" 패턴 시뮬레이션
3. → AgentManager가 ApprovalRequest 이벤트 발행 확인
4. → 에이전트 상태가 waiting_approval로 전이 확인
5. handleApprovalResponse(id, true) 호출
6. → 터미널에 "y\n" 전송 확인
7. → 에이전트 상태가 running으로 복원 확인
```

### 4.3 설정 영속화 통합 테스트

```
1. SessionStore.saveAppSettings(modified) 호출
2. SessionStore 새 인스턴스 생성 (재시작 시뮬레이션)
3. getAppSettings()로 수정된 값 확인
```

---

## 5. 테스트 인프라 구성

### 5.1 package.json 스크립트

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:e2e"
  }
}
```

### 5.2 의존성

```json
{
  "devDependencies": {
    "vitest": "^3.x",
    "@testing-library/react": "^16.x",
    "@playwright/test": "^1.x",
    "playwright": "^1.x",
    "electron": "^41.x"
  }
}
```

### 5.3 Playwright 설정 (playwright.config.ts)

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 1,
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'electron',
      use: {
        // Playwright Electron 지원
      },
    },
  ],
});
```

### 5.4 Electron 앱 헬퍼

```typescript
// tests/e2e/helpers/electron-app.ts
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'path';

export async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: [path.join(__dirname, '../../../dist/main/main/index.js')],
    env: { ...process.env, NODE_ENV: 'test' },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { app, page };
}

export async function closeApp(app: ElectronApplication): Promise<void> {
  await app.close();
}
```

---

## 6. 실행 전략

### 6.1 우선순위

| 순서 | 범위 | 테스트 수 | 예상 시간 |
|------|------|----------|----------|
| 1단계 | 유닛 (Store + API) | ~30개 | 1일 |
| 2단계 | 통합 (IPC 경계면) | ~10개 | 1일 |
| 3단계 | E2E 핵심 (T-001~T-008) | 8개 | 2일 |
| 4단계 | E2E 전체 (T-009~T-018) | 10개 | 2일 |

### 6.2 CI 통합

```yaml
# GitHub Actions
name: Test
on: [push, pull_request]
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:unit

  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:integration

  e2e:
    runs-on: macos-latest  # Electron E2E는 macOS에서 실행
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build:all
      - run: npx playwright install
      - run: npm run test:e2e
```

### 6.3 커버리지 목표

| 레이어 | 목표 | 핵심 측정 |
|--------|------|----------|
| 유닛 | 80% line coverage | Store 메서드, API unwrap, Router 로직 |
| 통합 | IPC 채널 100% | 21개 채널 전수 검증 |
| E2E | 18개 시나리오 | 사용자 핵심 워크플로 |

---

## 7. 이번에 발견된 버그 유형과 테스트 매핑

| 버그 | 원인 | 방지 테스트 |
|------|------|-----------|
| 에이전트 생성 후 빈 화면 | IPC가 AgentConfig 반환 → tokenUsage 없음 → React 크래시 | T-002 + agentStore.test.ts |
| CSP가 JS 차단 | file:// + script-src 'self' | T-001 (body bg 검증) |
| Vite crossorigin | file://에서 CORS 실패 | T-001 (#root 자식 검증) |
| Settings 초기값 불일치 | frontend vs backend 기본값 | settings-persist.test.ts |
| Preload/api.ts 누락 | IPC 핸들러만 있고 Renderer 미연결 | ipc-channels.test.ts (정적 분석) |

---

## 8. MCP 기반 테스트 실행 가이드

### 8.1 MCP vs Playwright 역할 분담

| 구분 | MCP (Claude Preview) | Playwright |
|------|---------------------|------------|
| **실행 시점** | 개발 중 (코드 변경 직후 즉시) | CI/CD 파이프라인 |
| **환경** | Vite dev 서버 (mock IPC) | Electron 빌드 (실제 IPC) |
| **장점** | 코드 수정 → 즉시 검증, 스크린샷/DOM 동시 확인, 에이전트가 버그 발견 시 바로 수정 가능 | 실제 Electron 환경, 자동화, 회귀 방지 |
| **한계** | 네이티브 다이얼로그/IPC 실제 동작 불가 | 빌드 필요, 느림 |
| **테스트 대상** | UI 렌더링, 상태 전이, 컴포넌트 상호작용, CSS | 전체 파이프라인 (IPC → Main → DB) |

### 8.2 MCP 테스트 워크플로

```
┌─────────────────────────────────────────────────┐
│  1. preview_start("claudeteam-dev")             │
│     → Vite dev 서버 기동 (port 5173)            │
├─────────────────────────────────────────────────┤
│  2. preview_screenshot → 초기 상태 캡처          │
│  3. preview_snapshot   → 접근성 트리 검증         │
│  4. preview_console_logs → 에러 없음 확인         │
├─────────────────────────────────────────────────┤
│  5. preview_click / preview_fill                 │
│     → 사용자 인터랙션 시뮬레이션                   │
├─────────────────────────────────────────────────┤
│  6. preview_snapshot + preview_screenshot         │
│     → 결과 상태 검증                              │
├─────────────────────────────────────────────────┤
│  7. 버그 발견 시:                                 │
│     → 코드 수정 → Vite HMR 자동 반영              │
│     → preview_screenshot으로 재검증               │
├─────────────────────────────────────────────────┤
│  8. preview_stop → 서버 종료                      │
└─────────────────────────────────────────────────┘
```

### 8.3 실제 테스트 세션 기록 (v0.1.1)

아래는 개발 중 MCP Preview로 실행한 실제 테스트 세션입니다:

| 테스트 | 결과 | 발견 사항 |
|--------|------|----------|
| T-001 앱 실행 | PASS | body 렌더링 정상, 콘솔 에러 없음 |
| T-002 에이전트 생성 | FAIL → FIX → PASS | Mock `agent.create`가 `{}`를 반환 → `tokenUsage` 접근 시 크래시. Mock을 완전한 AgentState로 수정 후 통과 |
| T-006 설정 모달 | FAIL → FIX → PASS | Mock `settings.get`이 `undefined` 반환 → 설정 로드 시 크래시. Mock에 완전한 AppSettings 기본값 추가 후 4개 탭 (일반/팀/안전장치/고급) 모두 정상 검증 |

### 8.4 MCP 테스트에서 발견 가능한 버그 유형

| 버그 유형 | MCP 도구 | 설명 |
|----------|---------|------|
| React 크래시 | `preview_console_logs` | `Uncaught TypeError` 등 런타임 에러 감지 |
| 렌더링 누락 | `preview_snapshot` | 접근성 트리에서 기대 요소 부재 감지 |
| CSS 깨짐 | `preview_inspect` | computed style 값이 기대와 불일치 |
| 레이아웃 오류 | `preview_screenshot` | 시각적 확인으로 overflow, 정렬 문제 감지 |
| 상태 불일치 | `preview_eval` | Zustand store 상태를 직접 읽어 검증 |
| Mock 불완전 | `preview_console_logs` | undefined 접근 에러로 mock 누락 감지 |
