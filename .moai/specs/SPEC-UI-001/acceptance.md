# Acceptance Criteria: SPEC-UI-001 3-Pane Application Layout

## Test Scenarios

### Scenario 1: 기본 3-Pane 레이아웃 렌더링

- **Given**: 애플리케이션이 처음 로드되고 localStorage에 저장된 설정이 없는 상태
- **When**: AppLayout 컴포넌트가 마운트될 때
- **Then**: 사이드바(너비 250px), 에디터, 프리뷰 세 영역이 렌더링되어야 한다
- **And**: Header가 상단에 "Untitled" 텍스트와 함께 표시되어야 한다
- **And**: Footer가 하단에 "Ln 1, Col 1 | UTF-8" 형태의 정보를 표시해야 한다

### Scenario 2: 패널 드래그 리사이즈

- **Given**: 3-Pane 레이아웃이 정상적으로 렌더링된 상태
- **When**: 사용자가 사이드바와 에디터 사이의 경계선을 오른쪽으로 50px 드래그할 때
- **Then**: 사이드바 너비가 300px로 증가해야 한다
- **And**: 에디터 영역이 해당 만큼 줄어들어야 한다
- **And**: 드래그 해제 시 uiStore의 sidebarWidth가 300으로 업데이트되어야 한다
- **And**: localStorage에 새로운 사이드바 너비가 저장되어야 한다

### Scenario 3: 패널 최소 너비 제약

- **Given**: 3-Pane 레이아웃이 렌더링된 상태
- **When**: 사용자가 사이드바 경계선을 왼쪽 끝까지 드래그할 때
- **Then**: 사이드바 너비가 180px 미만으로 줄어들지 않아야 한다
- **And**: 에디터 너비가 200px 미만으로 줄어들지 않아야 한다

### Scenario 4: 사이드바 토글

- **Given**: 사이드바가 펼쳐진 상태(너비 250px)
- **When**: 사용자가 사이드바 토글 버튼을 클릭할 때
- **Then**: 사이드바가 접혀야 한다 (너비 0 또는 최소 아이콘 너비)
- **And**: 에디터와 프리뷰 영역이 사이드바 공간만큼 확장되어야 한다
- **And**: uiStore의 sidebarCollapsed가 true로 변경되어야 한다

### Scenario 5: 사이드바 토글 복원

- **Given**: 사이드바가 접힌 상태(collapsed=true)
- **When**: 사용자가 사이드바 토글 버튼을 다시 클릭할 때
- **Then**: 사이드바가 이전 너비(250px 또는 마지막 저장된 너비)로 복원되어야 한다
- **And**: uiStore의 sidebarCollapsed가 false로 변경되어야 한다

### Scenario 6: 시스템 다크 모드 자동 감지

- **Given**: uiStore의 theme이 'system'으로 설정된 상태
- **When**: 운영체제의 다크 모드가 활성화될 때
- **Then**: 애플리케이션 전체(Header, Footer, 패널 배경, 경계선)에 다크 테마 색상이 적용되어야 한다
- **And**: `<html>` 요소에 `dark` 클래스가 추가되어야 한다

### Scenario 7: 시스템 라이트 모드 전환

- **Given**: 다크 모드가 적용된 상태에서 theme이 'system'인 경우
- **When**: 운영체제의 다크 모드가 비활성화될 때
- **Then**: 애플리케이션 전체에 라이트 테마 색상이 적용되어야 한다
- **And**: `<html>` 요소에서 `dark` 클래스가 제거되어야 한다

### Scenario 8: localStorage 설정 복원

- **Given**: localStorage에 `mdedit-ui-settings` 키로 저장된 설정이 존재 (sidebarWidth=320, theme='dark', fontSize=16)
- **When**: 애플리케이션이 시작될 때
- **Then**: 사이드바 너비가 320px로 복원되어야 한다
- **And**: 다크 테마가 적용되어야 한다
- **And**: 에디터 폰트 크기가 16px로 설정되어야 한다

### Scenario 9: Header 미저장 파일 표시

- **Given**: 파일이 열려 있고 editorStore의 dirty가 true인 상태
- **When**: Header가 렌더링될 때
- **Then**: 파일명 옆에 미저장 표시(dot 또는 asterisk)가 표시되어야 한다

### Scenario 10: Header 파일 없음 상태

- **Given**: 열린 파일이 없는 상태 (editorStore.currentFile이 null)
- **When**: Header가 렌더링될 때
- **Then**: "Untitled" 텍스트가 표시되어야 한다
- **And**: 미저장 표시가 나타나지 않아야 한다

### Scenario 11: Footer 커서 위치 업데이트

- **Given**: 파일이 열려 있고 에디터에 포커스가 있는 상태
- **When**: 커서 위치가 행 15, 열 42로 변경될 때
- **Then**: Footer에 "Ln 15, Col 42" 형태로 표시되어야 한다

### Scenario 12: 창 리사이즈 대응

- **Given**: 애플리케이션 창이 1200px 너비에서 렌더링된 상태
- **When**: 창 너비가 900px로 줄어들 때
- **Then**: 각 패널의 비율이 유지되면서 너비가 재조정되어야 한다
- **And**: 최소 너비 제약이 여전히 적용되어야 한다

---

## Edge Cases

### Edge Case 1: 매우 작은 창 크기

- **Condition**: 창 너비가 모든 패널의 최소 너비 합(180+200+200=580px)보다 작을 때
- **Expected**: 패널이 최소 너비를 유지하고, 수평 스크롤이 발생하거나 프리뷰 패널이 자동으로 숨겨져야 한다

### Edge Case 2: 손상된 localStorage 데이터

- **Condition**: localStorage의 `mdedit-ui-settings`에 잘못된 JSON이 저장된 경우
- **Expected**: 파싱 오류를 무시하고 기본값으로 fallback해야 한다. 콘솔에 경고 로그를 출력한다.

### Edge Case 3: 매우 긴 파일명

- **Condition**: 파일명이 100자 이상인 경우
- **Expected**: Header에서 파일명이 말줄임표(ellipsis)로 잘려야 하며, 툴팁으로 전체 파일명을 표시해야 한다.

### Edge Case 4: 빠른 연속 리사이즈

- **Condition**: 사용자가 매우 빠르게 패널을 드래그할 때
- **Expected**: requestAnimationFrame 기반 throttling으로 60fps가 유지되어야 하며, 최종 위치만 uiStore에 저장되어야 한다.

### Edge Case 5: 폰트 크기 극단값

- **Condition**: 폰트 크기가 8px 미만 또는 32px 초과로 설정 시도될 때
- **Expected**: 최소 8px, 최대 32px로 클램핑되어야 한다.

---

## Performance Criteria

| 측정 항목 | 목표 | 측정 방법 |
|-----------|------|-----------|
| 레이아웃 리사이즈 프레임 레이트 | >= 60fps (< 16ms per frame) | Chrome DevTools Performance 패널 |
| 초기 레이아웃 렌더링 | < 200ms | `performance.mark()` / `performance.measure()` |
| 테마 전환 시간 | < 100ms | 테마 토글 이벤트 ~ DOM 업데이트 완료 |
| localStorage 읽기/쓰기 | < 10ms | Performance API timing |
| uiStore 상태 변경 ~ UI 반영 | < 16ms | React Profiler |

---

## Quality Gates

### TRUST 5 검증

- **Tested**: 모든 컴포넌트에 대한 단위 테스트, uiStore 상태 전이 테스트, useTheme Hook 테스트
- **Readable**: Tailwind 클래스 체계적 사용, 컴포넌트별 명확한 책임 분리, TypeScript strict mode
- **Unified**: Tailwind CSS 일관된 스타일링, Zustand 패턴 일관성
- **Secured**: XSS 방지 (사용자 입력 없음), localStorage 데이터 검증
- **Trackable**: SPEC-UI-001 태그로 커밋 추적, 요구사항별 테스트 매핑

### Definition of Done

- [ ] AppLayout, ResizablePanels, Header, Footer 컴포넌트 구현 완료
- [ ] uiStore (Zustand + persist) 구현 및 테스트 통과
- [ ] useTheme Hook 구현 및 시스템 테마 감지 테스트 통과
- [ ] 패널 드래그 리사이즈 60fps 이상 성능 확인
- [ ] 다크/라이트 테마 전환 시 FOUC 없음 확인
- [ ] localStorage 영속성 테스트 (저장/복원) 통과
- [ ] 최소 패널 너비 제약 테스트 통과
- [ ] 반응형 레이아웃 (창 리사이즈) 테스트 통과
- [ ] TypeScript 타입 에러 0건
- [ ] ESLint 경고 0건
- [ ] 85% 이상 테스트 커버리지 달성

---

## Traceability

- SPEC Reference: SPEC-UI-001
- Requirements Coverage: REQ-UI001-U01 ~ U06, E01 ~ E07, S01 ~ S05, N01 ~ N04, O01 ~ O03
