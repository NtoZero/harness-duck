# ClaudeTeam -- Navigation Flow

**Version:** 0.1.0-draft
**Date:** 2026-03-31

---

## 1. 전체 화면 전환 흐름도

```
                        ┌───────────────┐
                        │   App Start   │
                        └───────┬───────┘
                                │
                    ┌───────────▼───────────┐
                    │  팀 프리셋 존재 여부?  │
                    └───────┬───────┬───────┘
                   있음     │       │  없음
                    ┌───────▼──┐ ┌──▼────────┐
                    │ 프리셋   │ │ 빈 메인    │
                    │ 로드     │ │ 레이아웃   │
                    │ 다이얼로그│ │ (Welcome)  │
                    └───────┬──┘ └──┬────────┘
                            │       │
                    ┌───────▼───────▼───────┐
                    │                       │
                    │    MAIN LAYOUT        │
                    │    (기본 상태)         │
                    │                       │
                    │ Sidebar + Terminal    │
                    │ + Chat Panel          │
                    │                       │
                    └───┬───┬───┬───┬───┬───┘
                        │   │   │   │   │
          ┌─────────────┘   │   │   │   └─────────────┐
          │         ┌───────┘   │   └───────┐         │
          ▼         ▼           ▼           ▼         ▼
    ┌──────────┐┌──────────┐┌──────────┐┌──────────┐┌──────────┐
    │ Agent    ││ Approval ││ Settings ││ File     ││ Quick    │
    │ Create   ││ Dashboard││ Panel    ││ Viewer   ││ Open     │
    │ Dialog   ││ (Modal)  ││ (Modal)  ││ (View)   ││ (Modal)  │
    │ (Modal)  ││          ││          ││          ││ Cmd+P    │
    └──────────┘└──────────┘└──────────┘└──────────┘└──────────┘
```

---

## 2. 유저 스토리별 네비게이션 경로

### US-01: 에이전트 팀 구성

```
메인 레이아웃
    │
    ├─ [+ 에이전트] 클릭
    │   └─ AgentCreateDialog 열림
    │       ├─ 이름/경로/역할 입력
    │       ├─ [에이전트 생성] 클릭
    │       │   ├─ 성공 -> 다이얼로그 닫힘
    │       │   │   ├─ Sidebar에 새 에이전트 추가
    │       │   │   ├─ TerminalTabBar에 새 탭 추가
    │       │   │   └─ 새 에이전트 탭 자동 선택
    │       │   └─ 실패 -> 에러 메시지 표시 (다이얼로그 유지)
    │       └─ [취소] 클릭 -> 다이얼로그 닫힘
    │
    ├─ AgentItem 클릭
    │   └─ 해당 에이전트 터미널 탭 활성화
    │
    ├─ AgentItem 우클릭
    │   └─ ContextMenu 표시
    │       ├─ "터미널 열기" -> 터미널 탭 활성화
    │       ├─ "재시작" -> 에이전트 재시작 (확인 다이얼로그)
    │       ├─ "중지" -> 에이전트 중지 (확인 다이얼로그)
    │       ├─ "CLAUDE.md 편집" -> 파일 뷰어에서 열기
    │       ├─ "작업 디렉토리 열기" -> OS 파일 탐색기
    │       ├─ "자동승인 규칙" -> ApprovalDashboard 열기 (규칙 탭)
    │       ├─ "모델 변경" -> 드롭다운
    │       └─ "삭제" -> 확인 다이얼로그 -> 에이전트 제거
    │
    └─ TerminalTab 클릭
        └─ 해당 에이전트 터미널 표시
```

### US-02: 에이전트 간 메시지 교환

```
ChatPanel
    │
    ├─ MessageInput에서 "@" 입력
    │   └─ MentionAutocomplete 드롭다운 표시
    │       ├─ 에이전트명 입력하여 필터링
    │       ├─ 항목 클릭 또는 Enter
    │       │   └─ "@에이전트명 " 삽입, 드롭다운 닫힘
    │       └─ Esc -> 드롭다운 닫힘
    │
    ├─ [Send] 클릭 또는 Cmd+Enter
    │   ├─ 메시지가 MessageList에 추가 (즉시)
    │   ├─ Main Process -> Message Router -> 대상 에이전트
    │   └─ 응답 수신 시 MessageList에 추가 (실시간)
    │
    ├─ 메시지 내 파일 참조 클릭
    │   └─ FilePreviewPanel 표시 (ChatPanel 하단)
    │       ├─ [열기] 클릭
    │       │   └─ ContentArea가 FileViewer로 전환
    │       │       해당 파일 선택 상태로 표시
    │       └─ [x] 클릭 -> FilePreviewPanel 닫힘
    │
    └─ LoopWarningBanner 표시 (conversationDepth >= max)
        └─ 대화 자동 중단. 사용자가 수동으로만 계속 가능
```

### US-03: 파일 참조 및 공유

```
ChatPanel
    │
    ├─ 메시지 내 "/path/to/file.ts" 감지
    │   └─ FileReferenceCard로 렌더링
    │       ├─ 카드 hover -> 미리보기 툴팁
    │       └─ 카드 클릭
    │           ├─ ChatPanel 내 FilePreviewPanel에 표시
    │           │   └─ [전체 열기] -> FileViewer로 전환
    │           └─ 또는 Cmd+Click -> FileViewer에서 직접 열기
    │
    └─ MessageInput [파일] 버튼 클릭
        └─ OS 파일 선택 다이얼로그
            └─ 선택된 파일 경로가 메시지에 삽입
```

### US-04: 기획 문서 기반 구현 검증

```
SettingsPanel
    │
    ├─ [팀] 탭 선택
    │   └─ "공유 문서 경로" 섹션
    │       ├─ [+ 추가] -> OS 파일 선택 -> 경로 추가
    │       └─ [x] -> 경로 제거
    │
    └─ 저장 시 -> 에이전트 CLAUDE.md에 반영
        └─ 에이전트가 커밋 전 검증 수행
            └─ 검증 결과가 ChatPanel에 메시지로 표시
```

### US-05: 권한 승인 관리

```
메인 레이아웃
    │
    ├─ NotificationToast (승인 요청 수신 시)
    │   ├─ [승인] -> 즉시 승인
    │   ├─ [거부] -> 즉시 거부
    │   └─ [상세] -> ApprovalDashboard 열기
    │
    ├─ Sidebar AlertBadge 클릭
    │   └─ ApprovalDashboard 열기
    │
    ├─ Sidebar [승인 대시보드] 클릭 또는 Cmd+Shift+A
    │   └─ ApprovalDashboard 열기
    │
    └─ ApprovalDashboard
        ├─ 탭 전환: 대기중 / 승인됨 / 거부됨
        ├─ 체크박스 선택 -> [일괄 승인] / [일괄 거부]
        ├─ 개별 항목 [승인] / [거부]
        ├─ [상세] 클릭
        │   └─ DiffPreview 펼침 (파일 변경 내역)
        │       └─ 파일 경로 클릭 -> FileViewer에서 열기
        └─ "자동 승인 규칙" 섹션
            ├─ [+ 규칙 추가]
            │   └─ 인라인 편집 행 추가
            ├─ 토글 -> 규칙 활성/비활성
            └─ [x] -> 규칙 삭제
```

### US-08: 크로스 레포 파일시스템 읽기

```
FileViewer
    │
    ├─ FileTree
    │   ├─ AgentRepoGroup (에이전트별 루트)
    │   │   └─ 에이전트명 클릭 -> 하위 디렉토리 펼침/접힘
    │   └─ FileTreeNode 클릭
    │       ├─ 파일 -> FileContentViewer에 내용 표시
    │       │   ├─ .ts/.js/.py 등 -> CodeViewer (구문 강조)
    │       │   ├─ .md -> MarkdownViewer (렌더링)
    │       │   └─ .png/.jpg -> ImageViewer
    │       └─ 디렉토리 -> 펼침/접힘 토글
    │
    └─ Quick Open (Cmd+P)
        ├─ SearchInput에 파일명/경로 입력
        ├─ 실시간 퍼지 검색 결과 표시
        └─ Enter 또는 클릭 -> FileContentViewer에 열기
```

---

## 3. 콘텐츠 영역 뷰 전환 상태도

```
                    ┌─────────────┐
                    │  Terminal   │ ← 기본 뷰
                    │  View       │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    [파일뷰어 탭]    [채팅에서 파일    [Cmd+P]
    클릭             참조 클릭]
          │                │                │
          ▼                ▼                ▼
    ┌─────────────────────────────────┐
    │        File Viewer View         │
    │  (FileTree + FileContentViewer) │
    └──────────────┬──────────────────┘
                   │
             [터미널 탭 클릭]
                   │
                   ▼
             ┌──────────┐
             │ Terminal  │
             │ View      │
             └──────────┘
```

---

## 4. 모달 상태 다이어그램

모달은 동시에 하나만 열림 (스택이 아닌 교체 방식).

```
         ┌───────────────────────────────────────────────┐
         │                 No Modal Open                  │
         └──┬──────┬──────┬──────┬──────┬───────────────┘
            │      │      │      │      │
     [+에이전트] [승인]  [설정]  [Cmd+P] [Esc/닫기]
            │      │      │      │      │
            ▼      ▼      ▼      ▼      │
         ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
         │Agent ├─┤Approv├─┤Setti├─┤Quick │
         │Create│ │al    │ │ngs  │ │Open  │
         │Dialog│ │Dashb.│ │Panel│ │Cmd+P │
         └──┬───┘ └──┬───┘ └──┬──┘ └──┬───┘
            │        │        │       │
            └────────┴────────┴───────┘
                       │
                    [Esc] 또는 [x]
                       │
                       ▼
              ┌────────────────┐
              │ No Modal Open  │
              └────────────────┘
```

---

## 5. 알림 흐름

```
Main Process 이벤트
    │
    ├─ agent:state-update
    │   └─ AgentItem 상태 변경 (Sidebar 즉시 반영)
    │
    ├─ approval:request
    │   ├─ NotificationToast 표시 (5초 자동 숨김)
    │   ├─ Sidebar AlertBadge 카운트 증가
    │   └─ ApprovalDashboard 목록에 추가 (열려 있으면 실시간)
    │
    ├─ chat:message
    │   ├─ MessageList에 추가 (실시간 스크롤)
    │   ├─ 채팅 패널이 닫혀 있으면 NotificationToast
    │   └─ 에이전트 응답이면 해당 AgentItem "typing" 애니메이션
    │
    ├─ chat:loop-warning
    │   ├─ MessageList에 LoopWarningBanner 삽입
    │   └─ NotificationToast (warning 타입)
    │
    └─ agent:error
        ├─ AgentItem 상태 = error (빨강)
        ├─ NotificationToast (error 타입)
        └─ TerminalTab에 에러 표시
```

---

## 6. 조건부 전환 규칙

| 조건 | 동작 |
|------|------|
| 에이전트 0개 | Welcome 메시지 + [에이전트 생성] CTA 표시 |
| 채팅 메시지 0개 | 채팅 패널에 안내 메시지 표시 |
| 승인 대기 0개 | AlertBadge 숨김 |
| 승인 대기 > 0 | AlertBadge 표시 + 번호 |
| 파일 참조 클릭 (ChatPanel 내) | FilePreviewPanel 열기 (ChatPanel 하단) |
| 파일 참조 Cmd+Click | FileViewer 뷰로 전환 + 해당 파일 열기 |
| conversationDepth >= max | LoopWarningBanner + 추가 전송 차단 |
| 에이전트 error 상태 | 터미널 탭에 빨강 인디케이터, 컨텍스트 메뉴에서 재시작 유도 |
| 앱 최소 해상도 미만 (1280x720) | 채팅 패널 자동 접힘, 토글 버튼 표시 |
