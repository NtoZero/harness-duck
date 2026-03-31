# ClaudeTeam -- Design Tokens

**Version:** 0.1.0-draft
**Date:** 2026-03-31

---

## 1. 색상 (Colors)

Catppuccin Mocha 기반 다크 테마. 에이전트 상태와 역할 구분에 최적화.

### 1.1 배경 (Background)

| 토큰 | 값 | 용도 |
|------|----|----|
| `--color-bg-base` | `#1e1e2e` | 앱 전체 배경 |
| `--color-bg-mantle` | `#181825` | 타이틀바, 사이드바 배경 |
| `--color-bg-crust` | `#11111b` | 가장 어두운 배경 (상태바) |
| `--color-bg-surface0` | `#313244` | 카드, 패널, 입력 필드 배경 |
| `--color-bg-surface1` | `#45475a` | hover 상태, 선택된 항목 |
| `--color-bg-surface2` | `#585b70` | active/pressed 상태 |
| `--color-bg-overlay` | `rgba(0, 0, 0, 0.5)` | 모달 오버레이 |

### 1.2 텍스트 (Text)

| 토큰 | 값 | 용도 |
|------|----|----|
| `--color-text-primary` | `#cdd6f4` | 기본 텍스트 |
| `--color-text-secondary` | `#a6adc8` | 보조 텍스트, placeholder |
| `--color-text-tertiary` | `#6c7086` | 비활성 텍스트, 힌트 |
| `--color-text-inverse` | `#1e1e2e` | 밝은 배경 위 텍스트 |

### 1.3 액센트 (Accent)

| 토큰 | 값 | 용도 |
|------|----|----|
| `--color-accent-blue` | `#89b4fa` | 링크, @멘션, 선택 강조 |
| `--color-accent-blue-hover` | `#b4d0fb` | 링크 hover |
| `--color-accent-mauve` | `#cba6f7` | Human 메시지 강조 |
| `--color-accent-teal` | `#94e2d5` | 파일 참조 카드 |

### 1.4 상태 (Status)

| 토큰 | 값 | 용도 |
|------|----|----|
| `--color-status-running` | `#a6e3a1` | 실행 중 (초록) |
| `--color-status-idle` | `#6c7086` | 대기 (회색) |
| `--color-status-waiting` | `#f9e2af` | 승인 대기 (노랑) |
| `--color-status-error` | `#f38ba8` | 오류 (빨강) |
| `--color-status-typing` | `#89b4fa` | 타이핑 중 (파랑) |

### 1.5 알림 (Notification)

| 토큰 | 값 | 용도 |
|------|----|----|
| `--color-notify-info` | `#89b4fa` | 정보 알림 |
| `--color-notify-warning` | `#fab387` | 경고 (루프 등) |
| `--color-notify-error` | `#f38ba8` | 에러 알림 |
| `--color-notify-success` | `#a6e3a1` | 성공 알림 |

### 1.6 보더 (Border)

| 토큰 | 값 | 용도 |
|------|----|----|
| `--color-border-default` | `#313244` | 기본 구분선 |
| `--color-border-subtle` | `#45475a` | 약한 구분선 |
| `--color-border-focus` | `#89b4fa` | 포커스 링 |

### 1.7 에이전트 아바타 색상 풀

에이전트별로 순환 할당. 최대 8색.

| 인덱스 | 토큰 | 값 |
|--------|------|----|
| 0 | `--color-agent-0` | `#89b4fa` (blue) |
| 1 | `--color-agent-1` | `#a6e3a1` (green) |
| 2 | `--color-agent-2` | `#f9e2af` (yellow) |
| 3 | `--color-agent-3` | `#cba6f7` (mauve) |
| 4 | `--color-agent-4` | `#fab387` (peach) |
| 5 | `--color-agent-5` | `#94e2d5` (teal) |
| 6 | `--color-agent-6` | `#f38ba8` (red) |
| 7 | `--color-agent-7` | `#74c7ec` (sapphire) |

Human 사용자 메시지는 항상 `--color-accent-mauve` (`#cba6f7`).

---

## 2. 타이포그래피 (Typography)

### 2.1 폰트 패밀리

| 토큰 | 값 | 용도 |
|------|----|----|
| `--font-family-ui` | `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` | UI 텍스트 |
| `--font-family-mono` | `'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', monospace` | 코드, 터미널 |

### 2.2 폰트 크기

| 토큰 | 값 | 용도 |
|------|----|----|
| `--font-size-xs` | `11px` | 상태바, 타임스탬프, 뱃지 |
| `--font-size-sm` | `12px` | 보조 텍스트, 파일 트리 |
| `--font-size-md` | `14px` | 기본 UI 텍스트, 채팅 메시지 |
| `--font-size-lg` | `16px` | 섹션 헤딩 |
| `--font-size-xl` | `18px` | 다이얼로그 타이틀 |
| `--font-size-2xl` | `24px` | 페이지 타이틀 (설정 등) |
| `--font-size-terminal` | `13px` | xterm.js 터미널 |

### 2.3 폰트 굵기

| 토큰 | 값 | 용도 |
|------|----|----|
| `--font-weight-normal` | `400` | 본문 텍스트 |
| `--font-weight-medium` | `500` | 에이전트명, 라벨 |
| `--font-weight-semibold` | `600` | 헤딩, 버튼 |
| `--font-weight-bold` | `700` | 강조 타이틀 |

### 2.4 줄 높이

| 토큰 | 값 | 용도 |
|------|----|----|
| `--line-height-tight` | `1.2` | 헤딩, 뱃지 |
| `--line-height-normal` | `1.5` | 기본 텍스트 |
| `--line-height-relaxed` | `1.7` | 채팅 메시지, 긴 텍스트 |

---

## 3. 스페이싱 (Spacing)

4px 기반 스케일.

| 토큰 | 값 | 용도 |
|------|----|----|
| `--space-0` | `0px` | -- |
| `--space-1` | `4px` | 인라인 요소 간격 |
| `--space-2` | `8px` | 아이콘-텍스트 간격, 작은 패딩 |
| `--space-3` | `12px` | 리스트 아이템 패딩 |
| `--space-4` | `16px` | 카드 패딩, 섹션 간격 |
| `--space-5` | `20px` | 패널 패딩 |
| `--space-6` | `24px` | 큰 섹션 간격 |
| `--space-8` | `32px` | 모달 내부 패딩 |
| `--space-10` | `40px` | 페이지 레벨 여백 |
| `--space-12` | `48px` | 대형 간격 |

---

## 4. 레이아웃 (Layout)

### 4.1 패널 크기

| 토큰 | 기본 | 최소 | 최대 |
|------|------|------|------|
| `--sidebar-width` | `240px` | `180px` | `360px` |
| `--chat-panel-width` | `320px` | `280px` | `480px` |
| `--file-tree-width` | `200px` | `150px` | `300px` |
| `--content-min-width` | `400px` | -- | -- |

### 4.2 타이틀바

| 토큰 | 값 |
|------|----|
| `--titlebar-height` | `36px` |
| `--titlebar-button-width` | `46px` |

### 4.3 탭

| 토큰 | 값 |
|------|----|
| `--tab-height` | `36px` |
| `--tab-min-width` | `80px` |
| `--tab-max-width` | `160px` |

### 4.4 모달

| 토큰 | 값 |
|------|----|
| `--modal-width-sm` | `400px` |
| `--modal-width-md` | `480px` |
| `--modal-width-lg` | `640px` |
| `--modal-max-height` | `80vh` |

---

## 5. 보더 (Border)

| 토큰 | 값 | 용도 |
|------|----|----|
| `--border-radius-sm` | `4px` | 버튼, 입력 필드 |
| `--border-radius-md` | `6px` | 카드, 드롭다운 |
| `--border-radius-lg` | `8px` | 모달, 패널 |
| `--border-radius-xl` | `12px` | 토스트 알림 |
| `--border-radius-full` | `9999px` | 뱃지, 아바타 |
| `--border-width-default` | `1px` | 기본 보더 |
| `--border-width-focus` | `2px` | 포커스 링 |

---

## 6. 그림자 (Shadow)

| 토큰 | 값 | 용도 |
|------|----|----|
| `--shadow-sm` | `0 1px 2px rgba(0, 0, 0, 0.3)` | 드롭다운, 툴팁 |
| `--shadow-md` | `0 4px 8px rgba(0, 0, 0, 0.4)` | 카드, 토스트 |
| `--shadow-lg` | `0 8px 24px rgba(0, 0, 0, 0.5)` | 모달 |
| `--shadow-xl` | `0 12px 48px rgba(0, 0, 0, 0.6)` | 팝오버 |

---

## 7. 애니메이션 (Animation)

| 토큰 | 값 | 용도 |
|------|----|----|
| `--duration-fast` | `100ms` | hover, 상태 전환 |
| `--duration-normal` | `200ms` | 패널 토글, 드롭다운 |
| `--duration-slow` | `300ms` | 모달 열기/닫기 |
| `--duration-typing` | `1500ms` | 타이핑 인디케이터 |
| `--easing-default` | `cubic-bezier(0.4, 0, 0.2, 1)` | 기본 이징 |
| `--easing-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 바운스 효과 |

---

## 8. Z-Index 레이어

| 토큰 | 값 | 용도 |
|------|----|----|
| `--z-base` | `0` | 기본 콘텐츠 |
| `--z-sidebar` | `10` | 사이드바 |
| `--z-panel` | `20` | 리사이즈 핸들 |
| `--z-dropdown` | `100` | 드롭다운, 자동완성 |
| `--z-sticky` | `200` | 고정 헤더/탭바 |
| `--z-overlay` | `500` | 모달 배경 |
| `--z-modal` | `510` | 모달 콘텐츠 |
| `--z-toast` | `600` | 토스트 알림 |
| `--z-tooltip` | `700` | 툴팁 |
| `--z-context-menu` | `800` | 컨텍스트 메뉴 |

---

## 9. 아이콘 (Icon)

| 토큰 | 값 | 용도 |
|------|----|----|
| `--icon-size-sm` | `16px` | 인라인 아이콘 |
| `--icon-size-md` | `20px` | 버튼 내 아이콘 |
| `--icon-size-lg` | `24px` | 네비게이션 아이콘 |

아이콘 라이브러리: **Lucide React** (MIT, 일관된 스트로크 스타일)

---

## 10. 포커스/접근성 (Focus & Accessibility)

| 토큰 | 값 | 용도 |
|------|----|----|
| `--focus-ring-color` | `#89b4fa` | 포커스 링 색상 |
| `--focus-ring-width` | `2px` | 포커스 링 두께 |
| `--focus-ring-offset` | `2px` | 포커스 링 오프셋 |
| `--focus-ring-style` | `0 0 0 var(--focus-ring-width) var(--focus-ring-color)` | box-shadow |

키보드 네비게이션 시 `:focus-visible`에만 포커스 링 표시.
마우스 클릭 시에는 포커스 링 숨김.

---

## 11. CSS 변수 적용 예시

```css
:root {
  /* Background */
  --color-bg-base: #1e1e2e;
  --color-bg-mantle: #181825;
  --color-bg-crust: #11111b;
  --color-bg-surface0: #313244;
  --color-bg-surface1: #45475a;
  --color-bg-surface2: #585b70;

  /* Text */
  --color-text-primary: #cdd6f4;
  --color-text-secondary: #a6adc8;
  --color-text-tertiary: #6c7086;

  /* Accent */
  --color-accent-blue: #89b4fa;
  --color-accent-mauve: #cba6f7;
  --color-accent-teal: #94e2d5;

  /* Status */
  --color-status-running: #a6e3a1;
  --color-status-idle: #6c7086;
  --color-status-waiting: #f9e2af;
  --color-status-error: #f38ba8;

  /* Typography */
  --font-family-ui: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-family-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --font-size-md: 14px;

  /* Spacing */
  --space-4: 16px;

  /* Layout */
  --sidebar-width: 240px;
  --chat-panel-width: 320px;
  --titlebar-height: 36px;

  /* Border */
  --border-radius-md: 6px;
  --border-width-default: 1px;
  --color-border-default: #313244;

  /* Animation */
  --duration-normal: 200ms;
  --easing-default: cubic-bezier(0.4, 0, 0.2, 1);
}
```
