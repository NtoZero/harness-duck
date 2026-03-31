# ClaudeTeam — Agent Team Orchestrator

독립된 Claude Code 터미널 세션들을 하나의 에이전트 팀으로 조직화하는 Electron 데스크톱 앱.

## 제품 개요

마이크로서비스 아키텍처에서 프론트엔드/백엔드/인프라 레포가 분리되어 있을 때, 각 레포에 역할이 지정된 Claude Code 세션을 한 화면에서 관리하고 에이전트 간 구조화된 소통을 수행한다.

### 핵심 기능
- 에이전트 생성/관리 (이름, 작업 디렉토리, 역할 지정)
- @멘션 기반 팀 채팅 (에이전트 간 메시지 교환)
- 크로스 레포 파일 참조 및 공유
- xterm.js 기반 터미널 탭
- 파일 뷰어 (Monaco 코드 뷰어, 마크다운 렌더링)
- CLI/MCP 도구로 팀 제어 (tmux 스타일)
- 안전장치 (루프 방지, 권한 관리, 비용 모니터링)

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Desktop Shell | Electron |
| Renderer | React, TypeScript, xterm.js, Monaco Editor |
| Main Process | node-pty, SQLite, IPC |
| Backend API | Spring Boot |
| Channel Server | Bun, MCP SDK |
| Message Routing | HTTP (localhost), Hub-and-Spoke |

## 설계 문서

- [PRD](docs/design/01_PRD_ClaudeTeam.md) — 유저 스토리, 기능 요구사항, 마일스톤
- [기술 아키텍처](docs/design/02_Technical_Architecture_ClaudeTeam.md) — 시스템 구조, 컴포넌트 상세
- [구현 가이드](docs/design/03_Implementation_Guide_ClaudeTeam.md) — 환경 설정, 사용 시나리오

## 빌드 하네스

이 프로젝트는 Claude Code 에이전트 팀 하네스로 개발을 자동화한다.

### 에이전트 팀

| 에이전트 | 역할 | 스킬 |
|---------|------|------|
| `ui-designer` | 와이어프레임, 컴포넌트 구조, 디자인 토큰 | wireframe |
| `frontend-dev` | Electron Renderer UI (React/xterm.js) | electron-ui |
| `backend-dev` | Spring Boot API, Main Process, Channel Server | spring-api |
| `qa-inspector` | 경계면 교차 비교, 통합 정합성 검증 | integration-qa |

### 파이프라인

```
Phase 1: Design     → ui-designer가 PRD 기반 와이어프레임 생성
Phase 2: Build      → frontend-dev + backend-dev 병렬 구현 + incremental QA
Phase 3: Verify     → qa-inspector 최종 통합 검증
Phase 4: Package    → electron-builder 패키징
```

### 실행 방법

```
# 전체 파이프라인
ClaudeTeam 앱을 빌드해줘

# 개별 Phase
와이어프레임 설계해줘        # Phase 1만
Spring API 구현해줘         # backend-dev만
통합 QA 검증해줘            # qa-inspector만
```

## 프로젝트 구조

```
harness-duck/
├── docs/design/              # 설계 문서 (PRD, 아키텍처, 구현 가이드)
├── .claude/
│   ├── agents/               # 에이전트 정의 (4개)
│   ├── skills/               # 스킬 (5개 + commit, harness)
│   │   ├── claudeteam-build/ # 오케스트레이터 (파이프라인 조율)
│   │   ├── wireframe/        # 화면 설계
│   │   ├── electron-ui/      # 프론트엔드 구현
│   │   ├── spring-api/       # 백엔드 구현
│   │   └── integration-qa/   # 통합 QA 검증
│   └── mine/                 # 프롬프트 로그, 예시
├── src/                      # (빌드 시 생성)
│   ├── renderer/             # Electron Renderer
│   ├── main/                 # Electron Main Process
│   ├── api/                  # Spring Boot API
│   ├── channel/              # MCP Channel Server
│   └── shared/               # 공유 타입
└── _workspace/               # (빌드 시 생성) 중간 산출물
```
