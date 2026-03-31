---
name: claudeteam-build
description: "ClaudeTeam Electron 앱의 풀스택 빌드를 조율하는 오케스트레이터. 와이어프레임부터 구현, QA, 배포까지 파이프라인으로 디자이너, 프론트엔드, 백엔드, QA 에이전트 팀을 운영한다. 'ClaudeTeam 빌드', '풀스택 구현', '앱 개발 시작', '전체 파이프라인 실행' 키워드가 나오면 이 스킬을 사용할 것."
---

# ClaudeTeam Build Orchestrator

ClaudeTeam Electron 앱의 풀스택 빌드를 조율한다. 와이어프레임 → 구현(병렬) → QA → 배포 준비의 파이프라인을 에이전트 팀으로 운영한다.

## 실행 모드: 에이전트 팀 (Phase별 팀 재구성)

## 아키텍처 패턴: 파이프라인 + 팬아웃

```
Phase 1: [ui-designer] → 와이어프레임/컴포넌트 설계
              ↓ (산출물 파일 전달)
Phase 2: [frontend-dev] ←SendMessage→ [backend-dev]  (병렬 구현)
              ↕                            ↕
         [qa-inspector] ← incremental QA → [qa-inspector]
              ↓
Phase 3: [qa-inspector] → 최종 통합 검증
              ↓
Phase 4: 배포 준비 (빌드, 패키징)
```

## 에이전트 구성

| 팀원 | 에이전트 타입 | 역할 | 스킬 | 출력 |
|------|-------------|------|------|------|
| ui-designer | ui-designer | 와이어프레임, 컴포넌트 구조 | wireframe | `_workspace/01_design/` |
| frontend-dev | frontend-dev | Electron Renderer UI | electron-ui | `src/renderer/` |
| backend-dev | backend-dev | Spring API, Main Process | spring-api | `src/api/`, `src/main/`, `src/channel/` |
| qa-inspector | qa-inspector | 통합 정합성 검증 | integration-qa | `_workspace/qa/` |

## 워크플로우

### Phase 1: 설계 (Design)

1. `_workspace/` 디렉토리 생성
2. `docs/design/` 경로의 PRD, 기술 아키텍처 문서를 `_workspace/00_input/`에 복사
3. ui-designer를 서브 에이전트로 호출 (단독 작업이므로 팀 불필요):

   ```
   Agent(
     name: "ui-designer",
     subagent_type: "ui-designer",
     model: "opus",
     prompt: "docs/design/ 의 PRD와 기술 아키텍처를 읽고 와이어프레임, 컴포넌트 트리, 화면 흐름도, 디자인 토큰을 생성하라. Skill 도구로 /wireframe 호출하여 작업한다. 산출물은 _workspace/01_design/ 에 저장."
   )
   ```

4. 산출물 확인: `_workspace/01_design/` 에 wireframes.md, component-tree.md, navigation-flow.md, design-tokens.md 존재 여부 검증

### Phase 2: 구현 (Build) — 에이전트 팀

1. 팀 생성:
   ```
   TeamCreate(
     team_name: "claudeteam-build",
     members: [
       {
         name: "frontend-dev",
         agent_type: "frontend-dev",
         model: "opus",
         prompt: "_workspace/01_design/ 의 와이어프레임과 컴포넌트 트리를 기반으로 Electron Renderer UI를 구현하라. Skill 도구로 /electron-ui 호출하여 작업한다. backend-dev와 IPC/API 인터페이스를 협의하고, 구현 완료된 모듈은 qa-inspector에게 알려라."
       },
       {
         name: "backend-dev",
         agent_type: "backend-dev",
         model: "opus",
         prompt: "docs/design/02_Technical_Architecture_ClaudeTeam.md 와 _workspace/01_design/ 의 데이터 요구사항을 기반으로 Spring Boot API, Electron Main Process, MCP Channel Server를 구현하라. Skill 도구로 /spring-api 호출하여 작업한다. frontend-dev와 IPC/API 인터페이스를 협의하고, 구현 완료된 API는 qa-inspector에게 알려라."
       },
       {
         name: "qa-inspector",
         agent_type: "qa-inspector",
         model: "opus",
         prompt: "frontend-dev와 backend-dev의 구현을 점진적으로 검증하라. Skill 도구로 /integration-qa 호출하여 작업한다. API ↔ 프론트 훅, IPC 채널, 라우팅, 상태 전이의 경계면을 교차 비교한다. 이슈 발견 시 해당 에이전트에게 즉시 알려라. 검증 결과는 _workspace/qa/ 에 저장."
       }
     ]
   )
   ```

2. 작업 등록:
   ```
   TaskCreate(tasks: [
     // Backend 작업
     { title: "Spring Boot 프로젝트 초기화 + API 엔드포인트 정의", assignee: "backend-dev" },
     { title: "Electron Main Process 구현 (AgentManager, IPC)", assignee: "backend-dev" },
     { title: "Message Router 구현", assignee: "backend-dev" },
     { title: "MCP Channel Server 구현", assignee: "backend-dev" },
     { title: "SQLite 세션 스토어 구현", assignee: "backend-dev" },

     // Frontend 작업
     { title: "프로젝트 구조 + IPC 통신 레이어 생성", assignee: "frontend-dev" },
     { title: "메인 레이아웃 + 사이드바 구현", assignee: "frontend-dev" },
     { title: "xterm.js 터미널 탭 구현", assignee: "frontend-dev" },
     { title: "팀 채팅 뷰 구현 (@멘션, 파일 프리뷰)", assignee: "frontend-dev" },
     { title: "파일 뷰어 구현 (Monaco, 마크다운)", assignee: "frontend-dev" },
     { title: "에이전트 생성 다이얼로그 + 권한 승인 대시보드", assignee: "frontend-dev" },

     // QA 작업 (구현 진행 중 점진적)
     { title: "API ↔ 프론트 훅 교차 검증", assignee: "qa-inspector", depends_on: ["Spring Boot 프로젝트 초기화"] },
     { title: "IPC 채널 정합성 검증", assignee: "qa-inspector", depends_on: ["Electron Main Process 구현", "프로젝트 구조 + IPC 통신 레이어 생성"] },
     { title: "메시지 라우팅 정합성 검증", assignee: "qa-inspector", depends_on: ["Message Router 구현", "MCP Channel Server 구현"] },
   ])
   ```

3. **팀원 간 통신 규칙:**
   - frontend-dev ↔ backend-dev: IPC 채널 규격과 API 인터페이스를 SendMessage로 협의
   - backend-dev → qa-inspector: API 엔드포인트 완성 시 알림
   - frontend-dev → qa-inspector: 컴포넌트 구현 완료 시 알림
   - qa-inspector → frontend-dev/backend-dev: 경계면 이슈 발견 시 양쪽 동시 알림

4. **리더 모니터링:**
   - TaskGet으로 진행률 확인
   - 팀원 유휴 알림 시 추가 작업 할당 또는 도움
   - 경계면 이슈가 3개 이상 누적되면 개입하여 인터페이스 정렬 회의 주재

### Phase 3: 최종 통합 검증

1. 모든 구현 작업 완료 대기 (TaskGet)
2. qa-inspector에게 최종 통합 검증 요청 (SendMessage):
   - end-to-end 데이터 흐름 추적 (사용자 입력 → Spring API → Main Process → Channel Server → Claude → 응답 → UI)
   - PRD 유저 스토리 커버리지 확인
   - 안전장치(루프 방지, 권한 관리) 동작 확인
3. 최종 검증 리포트 수집: `_workspace/qa/final-report.md`

### Phase 4: 배포 준비

1. 팀 정리 (TeamDelete)
2. 빌드 스크립트 실행:
   ```bash
   npm run build          # TypeScript 컴파일
   npx electron-builder   # Electron 패키징 (macOS .dmg)
   ```
3. `_workspace/` 디렉토리 보존 (사후 검증/감사 추적용)
4. 사용자에게 결과 요약 보고:
   - 구현 완료 기능 목록
   - QA 통과/실패 항목
   - 빌드 산출물 경로
   - 미해결 이슈 (있는 경우)

## 데이터 흐름

```
[docs/design/] → [ui-designer] → _workspace/01_design/
                                      ↓
                    ┌─────────────────┴──────────────────┐
                    ↓                                    ↓
              [frontend-dev]  ←─ SendMessage ─→  [backend-dev]
              src/renderer/                      src/api/, src/main/
                    ↓                                    ↓
                    └──── qa-inspector (incremental) ────┘
                                    ↓
                           _workspace/qa/
                                    ↓
                          최종 빌드 산출물
```

## 에러 핸들링

| 상황 | 전략 |
|------|------|
| ui-designer 실패 | 1회 재시도. 재실패 시 기본 레이아웃 템플릿으로 Phase 2 진행 |
| 팀원 1명 실패/중지 | 리더가 SendMessage로 상태 확인 → 재시작 또는 남은 팀원에 작업 재할당 |
| 팀원 과반 실패 | 사용자에게 알리고 진행 여부 확인 |
| frontend-dev ↔ backend-dev 인터페이스 충돌 | 리더가 개입하여 공유 타입 파일(src/shared/types.ts)을 먼저 정의하도록 지시 |
| QA에서 Critical 이슈 3개 이상 | Phase 2를 일시 중단하고 이슈 해소 먼저 진행 |
| 빌드 실패 | 에러 로그 분석 → 해당 에이전트(frontend 또는 backend)에게 수정 요청 |

## 테스트 시나리오

### 정상 흐름
1. 사용자가 "ClaudeTeam 앱을 빌드해줘" 입력
2. Phase 1: ui-designer가 와이어프레임 4개 파일 생성 (2~3분)
3. Phase 2: 팀 구성(3명) + 작업 14개 등록 → 병렬 구현
   - frontend-dev와 backend-dev가 IPC 채널 규격 협의 (SendMessage 2~3회)
   - qa-inspector가 API 완성 즉시 교차 검증 (incremental)
4. Phase 3: 최종 통합 검증 리포트 생성
5. Phase 4: 빌드 + 패키징 완료
6. 예상 결과: `dist/` 에 macOS .dmg 파일 생성

### 에러 흐름
1. Phase 2에서 backend-dev의 Message Router 구현 중 에러 발생
2. 리더가 유휴 알림 수신 → SendMessage로 상태 확인
3. backend-dev 재시작 시도 → 성공 시 작업 속개
4. 재실패 시: Message Router 작업을 frontend-dev에게 재할당 (TypeScript 역량 보유)
5. qa-inspector는 Message Router 제외한 나머지 경계면 검증 계속 진행
6. 최종 보고서에 "Message Router 구현 부분 지연됨" 명시
