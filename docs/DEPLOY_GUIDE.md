# ClaudeTeam — 배포 및 실행 가이드

**버전:** v0.1.0-draft
**최종 업데이트:** 2026-03-31

---

## 1. 사전 요구사항

| 도구 | 최소 버전 | 확인 명령 | 용도 |
|------|----------|----------|------|
| Homebrew | - | `brew -v` | macOS 패키지 관리 |
| Node.js | 20.x+ | `node -v` | Electron, Renderer 빌드 |
| npm | 10.x+ | `npm -v` | 패키지 관리 (Node.js에 포함) |
| Bun | 1.x+ | `bun -v` | MCP Channel Server 빌드 |
| Python | 3.x | `python3 --version` | node-pty 네이티브 빌드 (node-gyp) |
| Xcode CLI Tools | - | `xcode-select -p` | macOS 네이티브 모듈 컴파일 |

### macOS 사전 설치

Homebrew 기반으로 관리하되, Bun은 Homebrew에 없으므로 자체 설치 스크립트를 사용한다.

```bash
# 1. Homebrew 설치 (없는 경우)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Xcode CLI Tools (네이티브 모듈 빌드에 필요, brew 설치 시 자동 설치될 수 있음)
xcode-select --install

# 3. Node.js, Python 설치 (Homebrew)
brew install node python@3

# 4. Bun 설치 (자체 설치 스크립트)
curl -fsSL https://bun.sh/install | bash
source ~/.zshrc   # 또는 터미널 재시작

# 5. 설치 확인
node -v && npm -v && bun -v && python3 --version
```

> **참고:** `brew install node`는 npm을 함께 설치한다. Python은 macOS에 기본 포함되어 있지만 node-gyp 호환성을 위해 Homebrew 버전을 권장한다. Bun은 Homebrew formula가 없으므로 공식 설치 스크립트를 사용한다.

---

## 2. 프로젝트 구조

```
claudeteam/
├── src/
│   ├── renderer/          # Electron Renderer (React)
│   │   ├── components/    # 43개 React 컴포넌트
│   │   ├── stores/        # 5개 Zustand 스토어
│   │   ├── ipc/api.ts     # IPC facade 레이어
│   │   ├── hooks/         # IPC listeners, keyboard shortcuts
│   │   └── styles/        # CSS 변수 (디자인 토큰)
│   ├── main/              # Electron Main Process
│   │   ├── index.ts       # 앱 진입점 (BrowserWindow)
│   │   ├── preload.ts     # contextBridge (ElectronAPI 노출)
│   │   ├── agent-manager.ts    # node-pty 에이전트 관리
│   │   ├── message-router.ts   # Hub-and-Spoke 라우팅
│   │   ├── ipc-handlers.ts     # IPC 핸들러 19채널
│   │   ├── session-store.ts    # SQLite 영속화
│   │   └── router-http-server.ts # HTTP API
│   ├── channel/           # MCP Channel Server (Bun)
│   │   ├── channel-server.ts   # stdio ↔ HTTP 브릿지
│   │   └── mcp-tools-server.ts # MCP 도구 5개
│   └── shared/
│       └── types.ts       # 공유 타입 정의
├── package.json
├── tsconfig.json          # Renderer 타입 체크
├── tsconfig.main.json     # Main Process 컴파일
├── vite.config.ts         # Vite 빌드 설정
└── index.html             # Renderer HTML 엔트리
```

### 빌드 산출물

```
dist/
├── renderer/              # Vite 빌드 결과 (HTML, JS, CSS)
│   └── index.html
├── main/                  # Main Process 컴파일 결과
│   ├── index.js
│   ├── preload.js
│   └── ...
└── channel/               # Channel Server 빌드 결과
    └── channel-server.js
```

---

## 3. 빌드 설정 파일 안내

프로젝트에 포함된 빌드 설정 파일의 역할을 설명한다.

### 3-1. `tsconfig.main.json` — Main Process 컴파일

`npm run build:main` 스크립트가 이 파일을 참조하여 `src/main/`을 `dist/main/`으로 컴파일한다. Renderer용 `tsconfig.json`과 분리되어 있으며, CommonJS 모듈로 출력한다.

### 3-2. `electron-builder.yml` — macOS 패키징

`npm run package` 스크립트가 이 파일을 참조하여 .dmg 및 .zip을 생성한다. 코드 서명이 필요한 경우 9절을 참조.

### 3-3. `vite.config.ts` — Renderer 빌드

Vite + React 플러그인으로 `src/renderer/`를 `dist/renderer/`로 번들링한다. `@shared`, `@renderer` 경로 alias를 정의한다.

---

## 4. 설치 및 빌드

### 4-1. 의존성 설치

```bash
npm install
```

> **주의:** `node-pty`와 `better-sqlite3`는 네이티브 모듈이다. 컴파일 실패 시:
> - `xcode-select --install` 실행 확인
> - `npm rebuild` 시도
> - Electron 버전과 Node 버전이 호환되는지 확인 (`npx electron -v` vs `node -v`)

네이티브 모듈 리빌드가 필요한 경우:

```bash
npx electron-rebuild
```

### 4-2. 빌드 (3단계)

```bash
# 1단계: Renderer 빌드 (React → dist/renderer/)
npx vite build

# 2단계: Main Process 빌드 (TypeScript → dist/main/)
npx tsc -p tsconfig.main.json

# 3단계: Channel Server 빌드 (Bun)
bun build src/channel/channel-server.ts --outdir dist/channel --target bun
```

또는 npm 스크립트:

```bash
npm run build          # Renderer (vite build)
npm run build:main     # Main Process (tsc)
npm run build:channel  # Channel Server (bun)
```

### 4-3. 빌드 확인

```bash
# 산출물 확인
ls dist/renderer/index.html    # Renderer HTML
ls dist/main/index.js          # Main Process 진입점
ls dist/main/preload.js        # Preload 스크립트
ls dist/channel/channel-server.js  # Channel Server
```

---

## 5. 실행

### 5-1. 개발 모드

터미널 2개를 열어 Renderer와 Main Process를 각각 실행한다.

```bash
# 터미널 1: Vite 개발 서버 (핫 리로드)
npm run dev

# 터미널 2: Main Process 실행
npm run build:main && npm start
```

개발 모드에서는 `src/main/index.ts`가 `http://localhost:5173`을 로드하고 DevTools를 자동으로 연다.

### 5-2. 프로덕션 모드

```bash
# 전체 빌드
npm run build && npm run build:main && npm run build:channel

# 실행
npm start
```

프로덕션에서는 `dist/renderer/index.html`을 로드한다.

### 5-3. Electron 직접 실행

```bash
npx electron dist/main/index.js
```

---

## 6. 주요 환경 변수

| 변수 | 기본값 | 설명 |
|------|-------|------|
| `NODE_ENV` | `production` | `development`로 설정하면 DevTools 자동 오픈, Vite dev server 연결 |
| `ROUTER_PORT` | `3456` (AppSettings) | Message Router HTTP 서버 포트 |

---

## 7. 아키텍처 실행 흐름

```
1. Electron 시작 (npm start)
   └─→ src/main/index.ts
       ├─→ SessionStore 초기화 (SQLite)
       ├─→ MessageRouter 초기화 (Hub-and-Spoke)
       ├─→ AgentManager 초기화 (node-pty)
       ├─→ IPC 핸들러 등록 (19채널)
       ├─→ Router HTTP 서버 시작 (localhost:3456)
       └─→ BrowserWindow 생성
           └─→ preload.ts → contextBridge로 ElectronAPI 노출
               └─→ Renderer 로드 (React)
                   └─→ App.tsx → MainLayout → Sidebar + ContentArea + ChatPanel

2. 에이전트 생성 (UI에서 + 버튼)
   └─→ Renderer: api.agent.create(config)
       └─→ IPC: 'agent:create'
           └─→ AgentManager.createAgent()
               ├─→ node-pty로 Claude Code 프로세스 spawn
               ├─→ Channel Server 프로세스 spawn (Bun)
               └─→ SessionStore에 영속화

3. 팀 메시지 라우팅
   └─→ ChatInput에서 메시지 전송 (@멘션 포함)
       └─→ IPC: 'chat:send'
           └─→ MessageRouter.route()
               ├─→ @멘션 파싱 → 대상 에이전트 식별
               ├─→ 루프 방지 체크 (depth ≤ 5)
               └─→ HTTP POST → Channel Server (해당 에이전트)
                   └─→ MCP stdio → Claude Code
                       └─→ 응답 → Channel Server
                           └─→ HTTP POST → Router
                               └─→ IPC event → Renderer ChatPanel
```

---

## 8. 트러블슈팅

### 네이티브 모듈 빌드 실패

```bash
# node-pty, better-sqlite3 빌드 실패 시
npx electron-rebuild

# 그래도 실패하면 캐시 정리 후 재설치
rm -rf node_modules
npm install
npx electron-rebuild
```

### Electron 버전 호환

`electron`과 `node-pty`, `better-sqlite3`는 Node ABI 버전이 일치해야 한다.

```bash
# Electron의 Node 버전 확인
npx electron -e "console.log(process.versions.node)"

# 시스템 Node 버전
node -v
```

버전이 다르면 `electron-rebuild`로 네이티브 모듈을 Electron 버전에 맞게 재빌드한다.

### Vite 개발 서버 연결 실패

Main Process가 `http://localhost:5173`에 연결하지 못하는 경우:

```bash
# Vite 서버가 실행 중인지 확인
curl http://localhost:5173

# 포트 충돌 시 vite.config.ts에서 포트 변경
# server: { port: 5174 }
```

### Channel Server (Bun) 실행 실패

```bash
# Bun 설치 확인
bun -v

# 수동 실행 테스트
bun run src/channel/channel-server.ts
```

### SQLite 데이터 초기화

세션 데이터를 초기화하려면:

```bash
# 데이터 파일 위치 (기본)
ls ~/Library/Application\ Support/ClaudeTeam/

# 초기화
rm -rf ~/Library/Application\ Support/ClaudeTeam/*.db
```

---

## 9. 패키징 (macOS .dmg)

### 빌드 및 패키징

`electron-builder`와 `electron-builder.yml`은 이미 프로젝트에 포함되어 있다.

```bash
# 전체 빌드 + 패키징 (한 줄)
npm run package
```

산출물: `release/ClaudeTeam-0.1.0.dmg`

### 코드 서명 (배포용)

Apple 배포를 위해서는 코드 서명이 필요하다:

```bash
# 환경 변수 설정
export CSC_LINK="path/to/certificate.p12"
export CSC_KEY_PASSWORD="password"

# 서명된 빌드
npx electron-builder --mac --publish never
```

---

## 10. 알려진 제한사항

| 항목 | 상태 | 영향 |
|------|------|------|
| `waiting_approval` 상태 전이 | TODO | 권한 승인 시 UI 상태 미갱신 |
| Settings 영속화 | TODO | 설정 변경이 재시작 시 초기화 |
| Spring Boot API (`src/api/`) | 미구현 | Main Process에 기능 통합됨 |
| E2E 테스트 | 미작성 | 수동 테스트만 가능 |
| Claude Code 경로 | 하드코딩 가능 | `claude` CLI가 PATH에 있어야 함 |

---

## 11. 빠른 시작 (Quick Start)

```bash
# 1. 설치
npm install
npx electron-rebuild

# 2. 빌드
npm run build:all

# 3. 실행
npm start
```

개발 모드:

```bash
# 터미널 1
npm run dev

# 터미널 2
npm run build:main && NODE_ENV=development npx electron dist/main/index.js
```
