---
name: commit
description: "변경사항을 기능 단위로 분리하여 Conventional Commits 형식으로 커밋. '/commit', '커밋해줘', '커밋', 'commit' 입력 시 사용. Co-Authored-By 등 불필요 메타데이터를 추가하지 않는다."
---

# Commit — 기능 단위 커밋

변경사항을 논리적 기능 단위로 분리하고 Conventional Commits 형식으로 커밋한다.

## 메시지 형식

```
<type>(<scope>): <subject>

<body>
```

### type (필수)

| type | 용도 |
|------|------|
| feat | 새 기능 추가 |
| fix | 버그 수정 |
| refactor | 동작 변경 없는 코드 구조 개선 |
| docs | 문서 변경 |
| style | 포맷팅, 세미콜론 등 코드 의미 변경 없음 |
| test | 테스트 추가/수정 |
| chore | 빌드, 설정, 의존성 등 보조 작업 |
| perf | 성능 개선 |
| ci | CI/CD 설정 변경 |

### scope (선택)

변경 대상 모듈/영역. 예: `api`, `auth`, `hooks`, `ui`

### subject (필수)

- **한글로 작성**, 마침표 없음, 명령형
- 50자 이내
- "무엇을 했는가"가 아니라 "왜 했는가"에 집중

### body (선택)

- subject만으로 충분하면 생략
- **한글로 작성**
- 변경 동기나 이전 동작과의 차이를 설명할 때만 작성

## 워크플로우

### 1단계: 변경사항 분석

```bash
git status
git diff --staged
git diff
```

staged + unstaged 변경을 모두 확인한다.

### 2단계: 기능 단위 분리

변경 파일들을 논리적 단위로 그룹화한다. 분리 기준:

- **하나의 목적**을 가진 변경은 하나의 커밋
- 서로 다른 기능이 섞여 있으면 분리
- 리팩토링과 기능 추가가 섞여 있으면 분리
- 설정 변경과 코드 변경이 독립적이면 분리

한 커밋에 몰아도 되는 경우:
- 하나의 기능을 위해 여러 파일을 수정한 경우
- 변경이 작고 단일 목적인 경우

### 3단계: 커밋 실행

각 기능 단위별로:

1. 해당 파일만 `git add <파일들>` (git add -A 사용 금지)
2. 커밋 메시지 작성 (HEREDOC 사용)
3. `.env`, 자격 증명 등 민감 파일은 절대 커밋하지 않음

```bash
git add <specific-files>
git commit -m "$(cat <<'EOF'
type(scope): 한글 subject

한글 body (필요시)
EOF
)"
```

### 4단계: 검증

```bash
git log --oneline -5
```

## 금지 사항

- `Co-Authored-By` 헤더 추가 금지
- `git add -A` 또는 `git add .` 사용 금지
- 빈 커밋 금지
- pre-commit 훅 우회(`--no-verify`) 금지
- 기존 커밋 amend 금지 (사용자가 명시적으로 요청한 경우만 허용)
- push 금지 (사용자가 명시적으로 요청한 경우만 허용)
