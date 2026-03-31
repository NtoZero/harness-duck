---
name: integration-qa
description: "통합 정합성 검증 스킬. API ↔ 프론트 훅 교차 비교, IPC 채널 정합성, 라우팅 매핑, 상태 전이 완전성을 검증한다. 'QA', '테스트', '검증', '경계면 확인', '통합 테스트', '정합성 확인' 키워드가 나오면 이 스킬을 사용할 것."
---

# Integration QA — 통합 정합성 검증

모듈 간 경계면을 교차 비교하여 통합 정합성을 검증한다. 개별 모듈의 "존재 확인"이 아닌 **경계면 교차 비교**에 집중한다.

## 검증 영역

### 1. Spring API ↔ 프론트 훅 교차 검증

**방법**: 각 Spring Controller의 반환 DTO와 대응 프론트 훅의 fetch 타입을 비교한다.

```
검증 단계:
1. src/api/controller/ 의 각 엔드포인트에서 반환하는 DTO 클래스의 필드 목록 추출
2. src/renderer/hooks/ 의 대응 훅에서 fetch 호출의 타입 파라미터 확인
3. DTO 필드명과 프론트 타입의 필드명이 일치하는지 비교
   - Java camelCase → JSON camelCase → TypeScript 타입 필드명
4. 래핑 여부 확인: API가 { success, data, error } 래핑 → 훅이 .data를 unwrap 하는지
5. 옵셔널 필드의 null/undefined 처리가 양쪽에서 일관된지 확인
```

**주의 패턴:**
- Java `Long` → JSON number → TypeScript `number` (범위 초과 가능)
- Java `LocalDateTime` → JSON string → 프론트에서 Date 파싱 여부
- Spring `@JsonProperty` 커스텀 이름 → 프론트 타입과 불일치 가능

### 2. IPC 채널 정합성

**방법**: Main Process의 ipcMain.handle과 Renderer의 preload invoke를 1:1 매핑한다.

```
검증 단계:
1. src/main/IpcHandlers.ts 에서 ipcMain.handle('{channel}', ...) 목록 추출
2. src/renderer/ipc/preload.ts 에서 ipcRenderer.invoke('{channel}', ...) 목록 추출
3. 채널명이 1:1로 매칭되는지 확인
4. 각 채널의 인자 타입(Main 핸들러의 파라미터 vs Renderer의 invoke 인자)이 일치하는지 확인
5. 반환 타입이 일치하는지 확인
6. on/send (이벤트) 채널도 동일하게 검증
```

### 3. 메시지 라우팅 정합성

**방법**: Channel Server의 reply 도구 출력과 Message Router의 입력 규격을 비교한다.

```
검증 단계:
1. src/channel/tools/reply.ts 의 reply 도구가 Message Router에 보내는 HTTP body 추출
2. src/main/MessageRouter.ts 의 routeMessage()가 기대하는 Message 인터페이스 확인
3. 필드명, 타입, 필수/옵셔널이 일치하는지 비교
4. parseMentions()의 @멘션 파싱 패턴이 Channel Server의 메시지 포맷과 호환되는지 확인
```

### 4. 라우팅 정합성

**방법**: 실제 파일/페이지 경로와 코드 내 모든 navigation 값을 대조한다.

```
검증 단계:
1. src/renderer/ 하위의 라우트/페이지 구조에서 경로 패턴 추출
2. 코드 내 모든 navigate(), href=, window.location 값 수집
3. 각 링크가 실제 존재하는 경로와 매칭되는지 확인
```

### 5. 상태 전이 완전성

**방법**: AgentState의 상태 정의와 실제 상태 변경 코드를 대조한다.

```
검증 단계:
1. AgentState 타입 정의에서 가능한 status 값 추출 ('idle'|'running'|'waiting_approval'|'error')
2. 코드에서 모든 status 변경 지점 검색 (status = '...', setState({status: '...'}))
3. 모든 전이가 유효한 상태값을 사용하는지 확인
4. 도달 불가능한 상태나 빠져나올 수 없는 상태가 없는지 확인
```

## 검증 리포트 형식

```markdown
# 통합 정합성 검증 리포트

## 요약
- 검증 항목: N개
- 통과: X개 | 실패: Y개 | 미검증: Z개

## 경계면 이슈

### [FAIL] {이슈 제목}
- **경계면**: {생산자} ↔ {소비자}
- **위치**: {생산자 파일}:{라인} ↔ {소비자 파일}:{라인}
- **내용**: {구체적 불일치 설명}
- **수정 방안**: {어느 쪽을 어떻게 수정해야 하는지}
- **심각도**: Critical | Major | Minor

### [PASS] {검증 항목}
- **경계면**: {생산자} ↔ {소비자}
- **확인 내용**: {무엇을 검증하여 통과했는지}

### [SKIP] {미검증 항목}
- **사유**: {왜 검증하지 못했는지 — 미구현, 접근 불가 등}
```

## incremental QA 프로토콜
- 각 API 엔드포인트 완성 즉시 → 해당 API + 대응 훅 교차 검증
- 각 IPC 핸들러 완성 즉시 → 해당 채널 + preload 호출 교차 검증
- 전체 구현 완료 후 → end-to-end 데이터 흐름 전체 추적
