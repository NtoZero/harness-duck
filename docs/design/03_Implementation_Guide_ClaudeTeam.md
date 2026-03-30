# ClaudeTeam — 구현 가이드 및 사용 시나리오

**Version:** 0.1.0-draft  
**Date:** 2026-03-26

---

## 1. 사전 요구사항 및 환경 설정

### 1.1 필수 설치 항목

```bash
# Claude Code (v2.1.80+)
claude -v  # 버전 확인
claude update  # 업데이트

# Bun (채널 서버 런타임)
curl -fsSL https://bun.sh/install | bash
bun --version

# Node.js 20 LTS (Electron 빌드)
node --version

# 프로젝트 클론 및 설치
git clone https://github.com/your-org/claudeteam.git
cd claudeteam
npm install
npx electron-rebuild  # node-pty 네이티브 리빌드
```

### 1.2 Claude 인증

Claude Code Channels는 `claude.ai` 로그인만 지원한다. API 키는 사용할 수 없다.

```bash
# 사전에 Claude Code에 로그인되어 있어야 함
claude  # 첫 실행 시 브라우저 인증
```

---

## 2. 팀 프리셋 설정 예시

### 2.1 설정 파일 구조

```json
{
  "teamName": "쇼핑몰 프로젝트",
  "sharedDocuments": [
    "/Users/dev/docs/prd.md",
    "/Users/dev/docs/api-spec.yaml",
    "/Users/dev/docs/db-schema.sql"
  ],
  "agents": [
    {
      "name": "프론트엔드",
      "workingDirectory": "/Users/dev/repos/shop-frontend",
      "model": "sonnet",
      "role": "React/Next.js 기반 프론트엔드를 담당합니다. UI 컴포넌트 개발, API 클라이언트 코드 생성, 상태 관리를 수행합니다.",
      "fileAccessMode": "inline",
      "autoApprovePatterns": ["Read(*)", "Grep(*)"]
    },
    {
      "name": "백엔드",
      "workingDirectory": "/Users/dev/repos/shop-backend",
      "model": "sonnet",
      "role": "NestJS 기반 백엔드 API를 담당합니다. REST API 구현, DB 쿼리 작성, 인증/인가 로직을 수행합니다. 커밋 전에는 반드시 PRD를 참조하여 구현 적합성을 검토합니다.",
      "fileAccessMode": "inline",
      "autoApprovePatterns": ["Read(*)", "Grep(*)"]
    },
    {
      "name": "인프라",
      "workingDirectory": "/Users/dev/repos/shop-infra",
      "model": "sonnet",
      "role": "Terraform/K8s 기반 인프라를 담당합니다. IaC 코드 검토, 배포 설정, 환경 변수 관리를 수행합니다.",
      "fileAccessMode": "direct",
      "allowedReadPaths": [
        "/Users/dev/repos/shop-backend/docker-compose.yml",
        "/Users/dev/repos/shop-backend/Dockerfile"
      ],
      "autoApprovePatterns": ["Read(*)"]
    }
  ],
  "rules": {
    "maxConversationDepth": 5,
    "cooldownThreshold": { "messages": 5, "windowSeconds": 30 },
    "fileOwnership": {
      "프론트엔드": ["*.tsx", "*.css", "*.ts (frontend repo only)"],
      "백엔드": ["*.controller.ts", "*.service.ts", "*.entity.ts", "*.migration.ts"],
      "인프라": ["*.tf", "*.yaml (infra repo only)", "Dockerfile"]
    }
  }
}
```

---

## 3. 사용 시나리오

### 시나리오 1: API 스펙 불일치 해결

**상황:** 프론트엔드에서 회원가입 API를 호출했는데, 응답에 `ci` 필드가 누락됨.

#### 채팅 흐름

```
┌─────────────────────────────────────────────────────────────┐
│                     팀 채팅 — #general                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  👤 나 (10:30)                                              │
│  @프론트엔드 회원가입 API 연동 진행해주세요.                     │
│                                                             │
│  🤖 프론트엔드 (10:31)                                       │
│  네, /api/auth/signup 엔드포인트 연동을 시작하겠습니다.         │
│  API 스펙 문서를 확인해보겠습니다.                              │
│  ...                                                        │
│  @백엔드 회원가입 API 응답에서 필수값 `ci` 가 리스폰스에        │
│  포함되지 않는 것 같습니다. 현재 응답 스키마를 확인해주세요.      │
│  참조: /Users/dev/docs/api-spec.yaml                         │
│                                                             │
│  🤖 백엔드 (10:32)                                          │
│  api-spec.yaml과 실제 구현을 대조 확인했습니다.                 │
│                                                             │
│  원인: SignupResponseDto에 ci 필드가 정의되어 있지 않습니다.    │
│  api-spec.yaml에는 ci: string (required)로 명시되어 있으나,    │
│  /src/auth/dto/signup-response.dto.ts에 해당 프로퍼티가        │
│  누락되어 있었습니다.                                          │
│                                                             │
│  수정을 진행하겠습니다:                                        │
│  - signup-response.dto.ts에 ci 필드 추가                      │
│  - auth.service.ts의 signup()에서 ci 값 매핑 로직 추가         │
│                                                             │
│  📎 diff: /Users/dev/repos/shop-backend/src/auth/dto/       │
│      signup-response.dto.ts                                  │
│                                                             │
│  🤖 프론트엔드 (10:33)                                       │
│  확인했습니다. 업데이트된 응답 스키마에 맞춰 타입 정의와         │
│  API 클라이언트를 수정하겠습니다.                               │
│                                                             │
│  ⚠️ 시스템: 대화 깊이 3/5 — 정상 범위                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 내부 동작 흐름

```
1. 사용자 메시지 → Message Router
   - @프론트엔드 멘션 감지 → 프론트엔드 채널 서버로 전달

2. 프론트엔드 Claude 처리 → reply tool 호출
   - 메시지에 @백엔드 멘션 포함 → Message Router로 전달

3. Message Router → 백엔드 채널 서버로 전달
   - api-spec.yaml 파일 인라인 삽입 (inline 모드)
   - depth: 1

4. 백엔드 Claude 처리
   - 자기 레포에서 dto 파일 검색 및 분석
   - 수정 진행 → reply tool 호출
   - @멘션 없음 → 대화 자동 종료 방향

5. 프론트엔드 Claude가 응답 수신 (depth: 2)
   - 자기 레포에서 타입 수정
   - @멘션 없는 응답 → 대화 종료
```

### 시나리오 2: 커밋 전 기획 문서 대조 검증

**상황:** 백엔드 에이전트가 주문 기능 구현을 완료하고 커밋 전 PRD 검증을 수행.

```
┌─────────────────────────────────────────────────────────────┐
│                     팀 채팅 — #general                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  👤 나 (14:00)                                              │
│  @백엔드 주문 생성 API 구현 완료되면 커밋 전에 PRD 대조       │
│  검토 후 결과 공유해주세요.                                    │
│                                                             │
│  🤖 백엔드 (14:15)                                          │
│  주문 생성 API 구현을 완료했습니다. PRD 대조 검토 결과:        │
│                                                             │
│  ✅ 충족 항목:                                               │
│  - 주문 생성 시 재고 확인 (PRD 3.2.1)                        │
│  - 결제 실패 시 주문 롤백 (PRD 3.2.4)                        │
│  - 주문 번호 형식 YYYYMMDD-XXXX (PRD 3.2.2)                 │
│                                                             │
│  ⚠️ 불일치 항목:                                             │
│  - PRD 3.2.3: "주문 시 포인트 적립률 3%"                     │
│    → 현재 구현: 포인트 적립 로직 미구현                        │
│  - PRD 3.2.5: "주문 확인 이메일 발송"                         │
│    → 현재 구현: 이메일 서비스 연동 미완                        │
│                                                             │
│  커밋을 보류하고 포인트 적립 로직부터 구현할까요?               │
│                                                             │
│  👤 나 (14:16)                                              │
│  포인트 적립은 2차 스프린트로 미루겠습니다. 현재 상태로        │
│  커밋하되, TODO 주석 남겨주세요.                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 시나리오 3: 인프라 ↔ 백엔드 환경 변수 동기화

```
┌─────────────────────────────────────────────────────────────┐
│                     팀 채팅 — #general                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🤖 백엔드 (11:00)                                          │
│  @인프라 Redis 연결 설정이 필요합니다.                        │
│  .env.example에 다음 변수를 추가했는데,                       │
│  K8s ConfigMap에도 반영이 필요합니다:                         │
│  - REDIS_HOST                                               │
│  - REDIS_PORT                                               │
│  - REDIS_PASSWORD (Secret)                                  │
│                                                             │
│  참조: /Users/dev/repos/shop-backend/.env.example            │
│                                                             │
│  🤖 인프라 (11:01)                                          │
│  .env.example 확인했습니다. K8s 리소스를 업데이트합니다:       │
│  - configmap.yaml에 REDIS_HOST, REDIS_PORT 추가              │
│  - secret.yaml에 REDIS_PASSWORD 추가                         │
│  - deployment.yaml의 envFrom에 매핑 확인 완료                 │
│                                                             │
│  📎 diff: /Users/dev/repos/shop-infra/k8s/configmap.yaml    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 시나리오 4: CLI MCP 도구로 팀 조작 (tmux 스타일)

**상황:** 개발자가 별도 터미널에서 CLI로 에이전트 팀을 조작한다.

```bash
# 터미널 A: ClaudeTeam Electron 앱이 실행 중 (에이전트 3개 활성)

# 터미널 B: 개발자가 CLI로 조작
$ claudeteam status
🟢 프론트엔드    running           /Users/dev/repos/shop-frontend
🟢 백엔드       running           /Users/dev/repos/shop-backend
🟢 인프라       running           /Users/dev/repos/shop-infra

# 메시지 전송
$ claudeteam msg 백엔드 "POST /api/orders 엔드포인트에서 재고 차감 로직 확인해줘"
✓ 메시지 전송됨 (chat_id: conv-a1b2c3)

# 실시간 로그 스트리밍 (tail -f 방식)
$ claudeteam logs --follow
10:30:01 [human] @백엔드 POST /api/orders 엔드포인트에서 재고 차감 로직 확인해줘
10:30:18 [백엔드] 확인했습니다. OrderService.create()에서 재고 차감은
         InventoryService.deduct()를 호출하고 있으며, 트랜잭션 내에서
         처리됩니다. 다만 동시성 제어가 optimistic lock으로 되어 있어
         높은 트래픽에서 충돌 가능성이 있습니다.
^C

# 다른 에이전트 레포의 파일 직접 읽기
$ claudeteam read /Users/dev/repos/shop-backend/src/order/order.service.ts --lines 45-80
 45 │  async create(dto: CreateOrderDto): Promise<Order> {
 46 │    return this.dataSource.transaction(async (manager) => {
 47 │      // 재고 확인 및 차감
 48 │      await this.inventoryService.deduct(dto.items, manager);
 ...

# 파일에 첨부하면서 메시지 전송
$ claudeteam msg 프론트엔드 "이 API 스펙에 맞춰 주문 폼 타입 수정해줘" \
  --file /Users/dev/docs/api-spec.yaml
✓ 메시지 전송됨 (chat_id: conv-d4e5f6)

# 팀 전체 레포에서 패턴 검색
$ claudeteam search "deduct.*inventory" --agent 백엔드
/Users/dev/repos/shop-backend/src/order/order.service.ts:48: await this.inventoryService.deduct(dto.items, manager);
/Users/dev/repos/shop-backend/src/inventory/inventory.service.ts:12: async deduct(items: OrderItem[], manager: EntityManager) {

# 에이전트 디렉토리 구조 탐색
$ claudeteam ls 백엔드/src/order
src/order/
├── dto/
│   ├── create-order.dto.ts
│   └── order-response.dto.ts
├── order.controller.ts
├── order.module.ts
└── order.service.ts

# tmux attach 방식으로 에이전트 터미널 직접 연결
$ claudeteam attach 백엔드
연결됨. Ctrl+B, D로 디태치합니다.
# (백엔드 에이전트의 Claude Code 터미널이 그대로 표시됨)
# (직접 타이핑하여 Claude Code에 프롬프트 입력 가능)
```

### 시나리오 5: Claude Code 세션 내에서 MCP 도구로 팀 소통

**상황:** 프론트엔드 에이전트가 작업 중 백엔드 코드를 직접 확인해야 한다. 채팅 메시지 대신 MCP 도구를 사용한다.

```
┌─────────────────────────────────────────────────────────────┐
│  Claude Code 세션 (프론트엔드 에이전트)                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  > 회원가입 폼에서 API 응답 타입을 정의해야 합니다.           │
│    백엔드의 DTO를 직접 확인하겠습니다.                        │
│                                                             │
│  [Tool: team_list_files]                                    │
│  agent: "백엔드", subpath: "src/auth/dto"                   │
│  → src/auth/dto/                                            │
│    ├── signup-request.dto.ts                                │
│    ├── signup-response.dto.ts                               │
│    └── login-response.dto.ts                                │
│                                                             │
│  [Tool: team_read_file]                                     │
│  path: "/Users/dev/repos/shop-backend/src/auth/dto/         │
│         signup-response.dto.ts"                              │
│  → export class SignupResponseDto {                          │
│      id: string;                                            │
│      email: string;                                         │
│      name: string;                                          │
│      ci: string;        // ← 추가됨                         │
│      createdAt: Date;                                       │
│    }                                                        │
│                                                             │
│  > 확인했습니다. 이 DTO에 맞춰 프론트엔드 타입을 생성합니다.  │
│    (src/types/auth.ts 수정 중...)                            │
│                                                             │
│  [Tool: team_message]                                       │
│  content: "@백엔드 signup-response.dto.ts 확인 완료.          │
│  프론트 타입 동기화했습니다. ci 필드 추가 확인 감사합니다."    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 시나리오 6: Headless 모드 — Electron 없이 독립 터미널로 운용

**상황:** 서버 환경이나 GUI 없는 머신에서, 또는 개발자가 tmux 분할 화면을 선호하는 경우.

```bash
# ===== 터미널 1: 데몬 시작 =====
$ claudeteam daemon start --config /Users/dev/project/.claudeteam.json
ClaudeTeam 데몬 시작됨 (port: 7632)
팀: 쇼핑몰 프로젝트
등록된 에이전트 정의: 프론트엔드, 백엔드, 인프라
대기 중...

# ===== 터미널 2: 프론트엔드 에이전트 시작 =====
$ cd /Users/dev/repos/shop-frontend
$ claude --dangerously-load-development-channels \
    server:claudeteam-agent \
    -- --team shop --name 프론트엔드 --router http://127.0.0.1:7632

# Claude Code가 시작되면서 다음 메시지 표시:
# [ClaudeTeam] 데몬에 등록됨: 프론트엔드 (port: 9001)
# [ClaudeTeam] 팀 채팅 수신 대기 중...

# ===== 터미널 3: 백엔드 에이전트 시작 =====
$ cd /Users/dev/repos/shop-backend
$ claude --dangerously-load-development-channels \
    server:claudeteam-agent \
    -- --team shop --name 백엔드 --router http://127.0.0.1:7632

# ===== 터미널 4: 사용자 CLI로 팀 조작 =====
$ claudeteam status
🟢 프론트엔드    running    /Users/dev/repos/shop-frontend    (port: 9001)
🟢 백엔드       running    /Users/dev/repos/shop-backend     (port: 9002)
⚪ 인프라       not joined  /Users/dev/repos/shop-infra

$ claudeteam msg 프론트엔드 "로그인 페이지 구현 시작해줘. API 스펙은 공유 문서 참조."
✓ 메시지 전송됨

$ claudeteam logs --follow
11:00:01 [human] @프론트엔드 로그인 페이지 구현 시작해줘...
11:00:15 [프론트엔드] 네, /Users/dev/docs/api-spec.yaml의 POST /api/auth/login
         스펙을 확인하고 구현을 시작하겠습니다...
11:01:42 [프론트엔드] @백엔드 로그인 API의 refresh token 갱신 엔드포인트가
         api-spec에 없습니다. POST /api/auth/refresh 스펙을 추가해주세요.
11:02:01 [백엔드] 확인했습니다. POST /api/auth/refresh 엔드포인트를 구현하고
         api-spec.yaml에도 추가하겠습니다...
```

---

## 5. CLAUDE.md 템플릿 상세

에이전트 시작 시 자동 생성되는 CLAUDE.md의 전체 구조.

```markdown
<!-- ============================================
     ClaudeTeam 자동 생성 — {{timestamp}}
     에이전트: {{agentName}}
     팀: {{teamName}}
     ============================================ -->

# 역할 정의

{{roleDescription}}

# 팀 구성

현재 팀에는 다음 에이전트가 있습니다:
{{#each agents}}
- **{{name}}**: {{workingDirectory}} ({{briefRole}})
{{/each}}

# 공유 참조 문서

다음 문서는 팀 전체가 공유하는 기준 문서입니다:
{{#each sharedDocuments}}
- {{this}}
{{/each}}

# 통신 프로토콜

## 메시지 수신

팀 채팅 메시지가 `<channel>` 태그로 도착합니다:

```xml
<channel source="claudeteam" sender="프론트엔드" chat_id="conv-123" type="request">
메시지 내용
</channel>
```

## 응답 규칙

1. **@{{agentName}}** 으로 멘션된 메시지에만 응답하세요.
2. 응답할 때는 반드시 `reply` 도구를 사용하세요. 터미널에 텍스트를 출력하지 마세요.
3. 파일 경로가 포함된 메시지를 받으면, 해당 파일을 직접 읽어서 분석하세요.
4. 응답이 끝나면 **추가 질문을 하지 마세요**. 필요한 정보가 부족하면 그 사실을 응답에 명시하세요.
5. 다른 에이전트에게 요청할 때만 **@에이전트명** 멘션을 사용하세요.
6. 코드 변경 결과를 공유할 때는 변경된 파일의 절대경로를 포함하세요.

## MCP 도구 사용

채팅 메시지 외에도, 다음 MCP 도구를 직접 호출하여 팀과 상호작용할 수 있습니다:

- `team_read_file`: 다른 에이전트의 레포 파일을 직접 읽습니다. 메시지를 보내기 전에 직접 확인이 필요할 때 사용하세요.
- `team_list_files`: 다른 에이전트의 레포 디렉토리 구조를 탐색합니다.
- `team_search_files`: 팀 전체 레포에서 텍스트 패턴을 검색합니다.
- `team_message`: 팀 채팅에 메시지를 보냅니다. reply 도구 대신 사용할 수도 있습니다.
- `team_status`: 다른 에이전트의 현재 상태를 확인합니다.

예: 백엔드의 DTO를 확인해야 할 때, @백엔드에게 물어보기 전에 `team_read_file`로 직접 확인하세요.
이렇게 하면 불필요한 메시지 왕복을 줄이고 대화 깊이 제한을 절약할 수 있습니다.

## 파일 소유권

{{#each fileOwnership}}
- **{{@key}}**: {{this}}
{{/each}}

자신의 소유가 아닌 파일은 수정하지 마세요. 수정이 필요하면 해당 에이전트에게 요청하세요.

# 작업 지침

{{#if commitReviewEnabled}}
## 커밋 전 검증

코드 변경을 커밋하기 전에 다음을 수행하세요:
1. 공유 PRD 문서를 읽고 변경사항이 요구사항에 부합하는지 확인
2. 부합하지 않는 항목이 있으면 팀 채팅에 보고
3. 모든 항목 충족 시에만 커밋 진행
{{/if}}
```

---

## 6. 주요 구현 체크리스트

### Phase 1: Alpha — 코어 인프라 + 메시징 기본 (4주)

**Week 1-2: Core Infrastructure**
- [ ] Electron Forge 프로젝트 초기 설정
- [ ] node-pty + xterm.js 기본 터미널 통합
- [ ] Agent Manager — 생성/시작/중지 구현
- [ ] SQLite 데이터베이스 스키마 및 마이그레이션
- [ ] Message Router HTTP 서버 + REST API 엔드포인트

**Week 3-4: Channel & Basic Messaging**
- [ ] Custom Channel Server (Bun + MCP SDK) 구현
- [ ] @멘션 파싱 및 에이전트 간 메시지 라우팅
- [ ] 기본 채팅 UI (메시지 송수신만 동작하는 최소 버전)
- [ ] CLAUDE.md 자동 생성기
- [ ] CLI 기본 명령 (`msg`, `status`)
- [ ] MCP 도구 서버 기본 (`team_message`, `team_status`)
- [ ] 루프 방지 메커니즘 (depth limit, cooldown)

### Phase 2: Beta — 관리자 채팅 뷰 + 파일 뷰어 (3주)

**Week 5: Admin Chat View**
- [ ] 3-패널 레이아웃 셸 (Sidebar / Main / Right)
- [ ] 에이전트별 메시지 시각 구분 (아바타, 색상 뱃지, 역할 아이콘)
- [ ] 메시지 본문 내 코드블록 구문 강조 (shiki)
- [ ] 메시지 본문 내 diff 블록 하이라이팅
- [ ] @멘션 자동완성 입력 컴포넌트
- [ ] 에이전트 상태 인디케이터 (작업 중/대기/오류)
- [ ] 시스템 메시지 (루프 경고, 전달 실패 등) 스타일링

**Week 6: File Inline Preview + File Viewer**
- [ ] 채팅 내 파일 경로 인라인 프리뷰 (코드 20줄, 접기/펼치기)
- [ ] 채팅 내 마크다운 파일 렌더링 프리뷰
- [ ] 파일 프리뷰 "파일 뷰어에서 열기" 버튼 → Right Panel 연동
- [ ] 코드 뷰어 (Monaco Editor 읽기전용, 구문강조, 라인넘버)
- [ ] 마크다운 뷰어 (react-markdown + GFM, 원본/렌더링 토글)
- [ ] 파일 확장자 기반 자동 모드 판별 (code / markdown / image)

**Week 7: File Explorer + Cross-Repo Tools**
- [ ] 크로스 레포 파일 트리 탐색기 (react-arborist)
- [ ] 파일 트리에서 클릭 → 코드/마크다운 뷰어 열기
- [ ] FileSystemService 구현 (`read`, `list`, `search`)
- [ ] 파일 접근 제어 (allowedReadPaths 검증)
- [ ] CLI `read`, `ls`, `search` 명령
- [ ] MCP 도구 `team_read_file`, `team_list_files`, `team_search_files`
- [ ] 파일 접근 감사 로그

### Phase 3: RC — 안전장치 + 마무리 (2주)

**Week 8: Safety & Permissions**
- [ ] 중앙 권한 승인 대시보드 (Bottom Bar 알림 연동)
- [ ] 에이전트별 자동 승인 규칙
- [ ] Kill All 긴급 정지 기능
- [ ] 토큰 사용량 실시간 추적 (Sidebar 모니터)
- [ ] CLI `attach` 명령 (WebSocket PTY 연결)
- [ ] CLI `logs --follow` SSE 스트리밍

**Week 9: Polish & Release Prep**
- [ ] 팀 프리셋 JSON 저장/불러오기
- [ ] 대화 로그 내보내기
- [ ] 3-패널 레이아웃 반응형 조절 (패널 리사이즈, 토글)
- [ ] 에러 처리 및 자동 복구 (에이전트 크래시 재시작)
- [ ] E2E 테스트 작성
- [ ] CLI npm 패키지 배포 준비

### Phase 4: v1.1 — Headless 모드 (3주)

**Week 10-11: Daemon & Standalone**
- [ ] Message Router 데몬 분리 (`claudeteam daemon start/stop`)
- [ ] PID 파일 관리 및 프로세스 라이프사이클
- [ ] 독립 터미널용 채널 서버 (`agent-channel.ts`)
- [ ] 에이전트 자동 등록/해제 (heartbeat 포함)
- [ ] 공유 설정 파일 (`.claudeteam.json`) 스키마 및 로더

**Week 12: Hybrid Mode**
- [ ] Electron 앱이 데몬 역할을 겸하는 모드
- [ ] 데몬 독립 실행 + Electron UI-only 모드
- [ ] 독립 터미널에서 팀 합류 시 자동 CLAUDE.md 생성
- [ ] 데몬 자동 시작/종료 (마지막 에이전트 종료 시)
- [ ] Headless 모드 통합 테스트

### Phase 5: v1.2 — 고급 기능 (2주)

**Week 13-14: Advanced Features**
- [ ] Git diff 뷰어 (에이전트 수정 파일 변경내역 시각화)
- [ ] 파일 변경 실시간 감지 (에이전트 수정 시 뷰어 자동 갱신)
- [ ] Quick Open (Cmd+P 스타일 크로스 레포 퍼지 파일 검색)
- [ ] 대화 스레드 (주제별 분기)
- [ ] 에이전트별 모델 선택 (Sonnet/Opus)
- [ ] CI/CD 웹훅 연동 (GitHub Actions → 팀 채팅)
- [ ] 에이전트별 토큰 예산 제한
- [ ] 워크플로우 자동화 (JSON 기반 작업 시퀀스)

---

## 7. 알려진 제약 및 워크어라운드

### 7.1 `--dangerously-load-development-channels`

리서치 프리뷰 기간에는 커스텀 채널을 로드하려면 이 플래그가 필수다. 프로덕션에서의 위험을 완화하기 위해:

- 채널 서버는 `127.0.0.1`에만 바인딩 (외부 접근 불가)
- Message Router가 모든 인바운드 메시지를 검증
- 에이전트별 파일 쓰기 범위를 제한

향후 Anthropic의 채널 마켓플레이스가 정식 오픈되면, 플러그인으로 등록하여 플래그 없이 사용 가능해질 전망이다.

### 7.2 디스코드 메시지 길이 제한과의 비교

자체 내장 채널을 사용하므로 디스코드의 2000자 제한이 적용되지 않는다. 다만 Claude의 컨텍스트 윈도우 관리를 위해 단일 메시지는 4000자 이내를 권장하고, 파일 인라인 삽입 시 10,000자를 초과하면 요약 모드로 전환한다.

### 7.3 동시 Git 작업 충돌

두 에이전트가 같은 파일을 수정하면 Git conflict가 발생한다. CLAUDE.md의 "파일 소유권" 규칙으로 예방하지만, 공유 파일(예: `package.json`)에 대해서는:

- Message Router가 동일 파일에 대한 동시 쓰기를 감지하면 경고 발생
- 선착순 원칙 적용 (먼저 수정을 시작한 에이전트 우선)
- 사용자가 수동으로 해결할 수 있도록 충돌 알림 표시

### 7.4 Headless 모드 제약사항

**데몬 단일 인스턴스:** 동일 포트(7632)에서 하나의 데몬만 실행 가능하다. 여러 팀을 동시에 운용하려면 포트를 분리해야 한다.

```bash
# 팀 A
claudeteam daemon start --config teamA.json --port 7632
# 팀 B  
claudeteam daemon start --config teamB.json --port 7633
```

**에이전트 세션 유지:** 독립 터미널에서 에이전트를 실행할 경우, 터미널이 닫히면 세션도 종료된다. 장시간 운용 시 tmux/screen 사용을 권장한다.

```bash
# tmux로 에이전트 세션 유지
tmux new -s backend -d \
  "cd /repos/backend && claude --dangerously-load-development-channels \
   server:claudeteam-agent -- --team shop --name 백엔드"
```

**메시지 큐 부재 (Headless 특이사항):** 에이전트가 아직 합류하지 않은 상태에서 해당 에이전트에게 메시지를 보내면, 데몬이 큐잉하고 에이전트 합류 시 재전송한다. 단, 큐 크기 제한(100개)이 있으며 초과 시 오래된 메시지부터 폐기된다.

### 7.5 파일시스템 도구 제약사항

**읽기 전용:** `team_read_file`, `team_list_files`, `team_search_files`는 모두 읽기 전용이다. 다른 에이전트의 레포에 파일을 쓰는 기능은 의도적으로 제공하지 않는다. 파일 수정이 필요하면 반드시 해당 에이전트에게 메시지로 요청해야 한다.

**파일 크기 제한:** 단일 파일 읽기 시 50,000자를 초과하면 자동으로 잘린다. 라인 범위 지정(`--lines 1-50`)으로 필요한 부분만 읽는 것을 권장한다.

**바이너리 파일:** 이미지, 컴파일된 바이너리 등은 읽기 대상에서 자동 제외된다. `.gitignore` 패턴도 기본적으로 검색에서 제외된다.

---

## 8. 향후 확장 가능성

### 8.1 외부 이벤트 연동 (v1.2+)

Channels의 웹훅 수신 기능을 활용하면 CI/CD 파이프라인 이벤트를 팀 채팅에 주입 가능:

- GitHub Actions 빌드 실패 → 관련 에이전트에게 자동 알림
- PR 리뷰 요청 → 에이전트가 코드 리뷰 수행

### 8.2 에이전트 간 서브태스킹

특정 에이전트가 다른 에이전트에게 세부 작업을 위임하는 패턴:

```
사용자: @백엔드 결제 모듈 구현해줘
백엔드: (구현 중 인프라 설정 필요 감지)
백엔드: @인프라 Stripe webhook URL을 ConfigMap에 추가해주세요
인프라: (처리 후 응답)
백엔드: (인프라 응답 확인 후 구현 계속)
```

### 8.3 클라우드 세션 지원

Claude Code의 Web Sessions(`claude.ai/code`)이 안정화되면, 로컬 터미널 대신 클라우드 샌드박스에서 에이전트를 실행하는 옵션을 추가할 수 있다.

### 8.4 LAN 멀티머신 지원

Headless 데몬의 `host`를 `0.0.0.0`으로 바인딩하면 LAN 내 다른 머신에서 에이전트를 참여시킬 수 있다. `terminal-manager`의 LAN Tunneling 패턴(mDNS + DH key exchange + AES-256-GCM)을 참고하여 보안 통신 구현 가능.

```
머신 A (개발 서버)          머신 B (개발자 랩톱)
┌──────────────────┐       ┌──────────────────┐
│ Daemon (:7632)   │◄─────►│ CLI / Electron   │
│ 백엔드 에이전트   │  LAN  │ 프론트엔드 에이전트│
└──────────────────┘       └──────────────────┘
```

### 8.5 MCP 도구 마켓플레이스 등록

리서치 프리뷰가 종료되면 `claudeteam-channel`과 `claudeteam-tools`를 Anthropic의 채널 플러그인 마켓플레이스에 등록하여, `--dangerously-load-development-channels` 플래그 없이 사용 가능하게 할 수 있다.

### 8.6 에이전트 워크플로우 자동화

반복적인 팀 워크플로우를 JSON으로 정의하여 자동 실행:

```json
{
  "workflow": "feature-implementation",
  "steps": [
    { "agent": "백엔드", "action": "implement", "input": "PRD 섹션 참조" },
    { "agent": "백엔드", "action": "review", "input": "PRD 대조 검증" },
    { "agent": "프론트엔드", "action": "sync-types", "input": "백엔드 DTO 기반" },
    { "agent": "인프라", "action": "update-config", "input": "새 환경변수 반영" }
  ]
}
```
