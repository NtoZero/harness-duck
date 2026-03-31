---
name: wireframe
description: "Electron 데스크톱 앱의 와이어프레임, 컴포넌트 트리, 화면 흐름도, 디자인 토큰을 설계한다. PRD 유저 스토리를 화면 단위로 분해하고 ASCII 기반 와이어프레임을 생성한다. '와이어프레임', '화면 설계', 'UI 설계', '컴포넌트 구조', '디자인 시스템' 키워드가 나오면 이 스킬을 사용할 것."
---

# Wireframe — Electron 앱 화면 설계

PRD 유저 스토리를 화면 단위로 분해하여 와이어프레임, 컴포넌트 계층 구조, 화면 전환 흐름도, 디자인 토큰을 생성한다.

## 워크플로우

### 1. PRD 분석
1. `docs/design/01_PRD_ClaudeTeam.md` 읽기
2. 유저 스토리(US-01~US-08)를 화면 단위로 분해
3. 기능 요구사항 테이블(F-01~F-66)에서 UI 관련 항목 추출
4. 화면 우선순위 결정: P0 기능이 포함된 화면을 먼저 설계

### 2. 화면 목록 도출
PRD 기반으로 다음 핵심 화면을 식별한다:

| 화면 | 관련 유저 스토리 | 핵심 기능 |
|------|---------------|----------|
| 메인 레이아웃 | US-01 | 사이드바 + 터미널 탭 + 채팅 패널 |
| 에이전트 생성 다이얼로그 | US-01 | 이름, 경로, 역할, 모델 입력 |
| 팀 채팅 뷰 | US-02 | 메시지 흐름, @멘션, 파일 프리뷰 |
| 터미널 탭 뷰 | US-01 | xterm.js 터미널, 탭 전환 |
| 파일 뷰어 | US-03 | 크로스 레포 파일 트리, 코드 뷰 |
| 권한 승인 대시보드 | US-05 | 승인 대기 목록, 일괄 승인 |
| 설정 패널 | US-04 | 팀 프리셋, 공유 문서 경로, 규칙 |

### 3. 와이어프레임 작성
각 화면에 대해 ASCII 기반 와이어프레임을 작성한다:

```
┌─────────────────────────────────────────────────────┐
│ Title Bar (드래그 영역)                    [−][□][×] │
├────────┬────────────────────────┬───────────────────┤
│Sidebar │  Terminal Tabs         │  Team Chat        │
│        │  ┌────┬────┬────┐     │                   │
│ Agent1 │  │ A1 │ A2 │ A3 │     │  Messages...      │
│ Agent2 │  ├────┴────┴────┤     │                   │
│ Agent3 │  │              │     │  @mention input   │
│        │  │  xterm.js    │     │                   │
│ [+Add] │  │              │     │  [Send]           │
├────────┤  │              │     ├───────────────────┤
│ Status │  │              │     │  File Preview     │
│ Panel  │  └──────────────┘     │                   │
└────────┴────────────────────────┴───────────────────┘
```

**와이어프레임 규격:**
- 박스 문자(┌─┬┐│├─┼┤└─┴┘)를 사용하여 레이아웃 표현
- 각 영역에 컴포넌트명과 핵심 요소를 표기
- 리사이즈 가능한 경계는 `│` 대신 `║`로 표시
- 인터랙션 요소는 `[Button]`, `(Radio)`, `[x] Check`로 표기

### 4. 컴포넌트 트리 작성
React 컴포넌트 계층을 트리 구조로 정의한다:

```
App
├── TitleBar
├── MainLayout (flex)
│   ├── Sidebar
│   │   ├── AgentList
│   │   │   └── AgentItem (status indicator)
│   │   ├── AddAgentButton
│   │   └── StatusPanel (token usage, alerts)
│   ├── ContentArea (resizable)
│   │   ├── TerminalTabs
│   │   │   ├── TabBar
│   │   │   └── TerminalPane (xterm.js)
│   │   └── FileViewer (conditional)
│   └── ChatPanel (resizable)
│       ├── MessageList
│       │   └── MessageItem (avatar, content, file refs)
│       ├── MessageInput (@mention autocomplete)
│       └── FilePreview (conditional)
├── AgentCreateDialog (modal)
├── ApprovalDashboard (modal)
└── SettingsPanel (modal)
```

각 컴포넌트에 props 인터페이스 초안을 포함한다.

### 5. 디자인 토큰 정의
```
Colors:
  --bg-primary: #1e1e2e     (메인 배경)
  --bg-secondary: #313244   (사이드바/패널)
  --bg-surface: #45475a     (카드/입력)
  --text-primary: #cdd6f4
  --text-secondary: #a6adc8
  --accent: #89b4fa          (링크, 멘션)
  --status-running: #a6e3a1
  --status-waiting: #f9e2af
  --status-error: #f38ba8

Typography:
  --font-mono: 'JetBrains Mono', monospace
  --font-ui: 'Inter', system-ui
  --size-sm: 12px
  --size-md: 14px
  --size-lg: 16px

Spacing:
  --gap-xs: 4px
  --gap-sm: 8px
  --gap-md: 16px
  --gap-lg: 24px

Layout:
  --sidebar-width: 240px (min 180, max 360)
  --chat-panel-width: 320px (min 280, max 480)
```

### 6. 산출물 저장
모든 산출물을 `_workspace/01_design/`에 저장한다:
- `wireframes.md` — 화면별 와이어프레임 (우선순위순)
- `component-tree.md` — 컴포넌트 계층 + props 인터페이스 초안
- `navigation-flow.md` — 화면 전환 흐름 (상태 다이어그램)
- `design-tokens.md` — 색상/타이포/간격/레이아웃 토큰
