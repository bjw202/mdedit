# Implementation Plan: SPEC-PREVIEW-002 Editor-Preview Scroll Synchronization

## Task Decomposition

### Milestone 1: data-line 속성 주입 플러그인 (Priority High - Primary Goal)

markdown-it 렌더링 파이프라인에 소스 라인 번호를 HTML 요소에 주입하는 플러그인을 구현한다.

**Task 1.1: data-line 주입 markdown-it 플러그인 작성**
- 파일: `src/lib/markdown/renderer.ts`
- markdown-it 플러그인 함수 작성:
  - `md.core.ruler.push('inject_line_numbers', ...)` 패턴 사용
  - 토큰 순회: `token.map`이 존재하는 블록 토큰에 `data-line` 속성 추가
  - 대상 토큰: `paragraph_open`, `heading_open`, `fence`, `blockquote_open`, `bullet_list_open`, `ordered_list_open`, `table_open`, `hr`
  - `token.attrSet('data-line', String(token.map[0]))` 호출
- 기존 mermaidPlugin, Shiki 통합에 영향 없도록 플러그인 순서 관리
- 성능: 10KB 문서 기준 5ms 미만 오버헤드

**Task 1.2: data-line 주입 검증 테스트**
- renderer.ts의 render() 출력에 `data-line` 속성이 올바르게 주입되는지 검증
- 각 블록 요소 유형별 data-line 값 정확성 확인
- 인라인 요소에는 data-line이 추가되지 않음 확인
- 기존 렌더링 결과(Shiki, Mermaid)에 영향 없음 확인

---

### Milestone 2: uiStore scrollSyncEnabled 상태 (Priority High - Primary Goal)

스크롤 동기화 설정을 uiStore에 추가하고 persist한다.

**Task 2.1: uiStore에 scrollSyncEnabled 추가**
- 파일: `src/store/uiStore.ts`
- 추가 상태:
  - `scrollSyncEnabled: boolean` - 스크롤 동기화 활성화 여부 (기본값: `true`)
- Action 함수:
  - `toggleScrollSync()` - 스크롤 동기화 토글
- Zustand persist middleware로 localStorage에 저장
- 앱 재시작 시 이전 설정 복원

---

### Milestone 3: useScrollSync 훅 구현 (Priority High - Primary Goal)

에디터 스크롤 위치에 따라 미리보기를 동기화하는 핵심 훅을 구현한다.

**Task 3.1: useScrollSync 훅 작성**
- 파일: `src/hooks/useScrollSync.ts` (신규)
- 파라미터:
  - `editorView: EditorView | null`
  - `previewRef: RefObject<HTMLDivElement>`
  - `enabled: boolean`
- 구현 로직:
  1. EditorView의 `scrollDOM`에 scroll 이벤트 리스너 등록
  2. `requestAnimationFrame`으로 스로틀링 (16ms)
  3. 에디터 최상단 보이는 라인 계산:
     - `view.lineBlockAtHeight(view.scrollDOM.scrollTop)` → Line 객체
     - `view.state.doc.lineAt(pos).number` → 라인 번호
  4. 미리보기 DOM에서 `[data-line]` 요소 탐색:
     - `previewRef.current.querySelectorAll('[data-line]')`
     - 이진 탐색으로 가장 가까운 data-line 요소 찾기
  5. 해당 요소로 미리보기 스크롤:
     - `element.offsetTop` 계산 → `previewRef.current.scrollTop` 설정
  6. 보간(interpolation): 정확한 data-line이 없을 때 이전/다음 요소 간 비율 계산
- cleanup: 이벤트 리스너 해제

**Task 3.2: 피드백 루프 방지**
- 미리보기 스크롤 이벤트가 에디터에 영향을 주지 않도록 방지
- `isSyncing` ref 플래그:
  - 동기화 시작 시 `true` 설정
  - requestAnimationFrame 후 `false` 복원
  - 미리보기 스크롤 이벤트 핸들러에서 `isSyncing`이 true이면 무시
- 현재 에디터 → 미리보기 단방향 동기화만 구현

**Task 3.3: 콘텐츠 변경 시 재동기화**
- editorStore의 `content` 변경 감지
- 미리보기 재렌더링 완료 후 (useEffect) 현재 에디터 스크롤 위치로 동기화
- MutationObserver 또는 렌더링 완료 콜백으로 타이밍 관리

---

### Milestone 4: 컴포넌트 연결 (Priority Medium - Secondary Goal)

EditorView와 미리보기 스크롤 컨테이너를 연결한다.

**Task 4.1: MarkdownPreview에 previewRef 추가**
- 파일: `src/components/preview/MarkdownPreview.tsx`
- 스크롤 가능한 컨테이너 div에 `ref` prop 전달
- `forwardRef` 패턴 또는 prop으로 ref 전달

**Task 4.2: AppLayout에서 useScrollSync 연결**
- 파일: `src/components/layout/AppLayout.tsx`
- `viewRef` (EditorView - onViewReady에서 설정, SPEC-EDITOR-002와 공유)
- `previewRef` (useRef<HTMLDivElement>)
- uiStore의 `scrollSyncEnabled` 구독
- `useScrollSync(viewRef.current, previewRef, scrollSyncEnabled)` 호출

---

### Milestone 5: Footer 토글 버튼 (Priority Medium - Secondary Goal)

Footer에 스크롤 동기화 활성화/비활성화 토글을 추가한다.

**Task 5.1: Footer 스크롤 동기화 토글 구현**
- 파일: `src/components/layout/Footer.tsx`
- uiStore의 `scrollSyncEnabled` 구독
- 토글 버튼:
  - 활성화: 연결 아이콘 (파란색/강조) + "Sync On"
  - 비활성화: 연결 해제 아이콘 (회색) + "Sync Off"
- 클릭 시 `uiStore.toggleScrollSync()` 호출
- SPEC-EDITOR-002의 saveStatus, word count 영역과 조화로운 배치

---

## Technology Stack

| 기술 | 버전 | 역할 |
|------|------|------|
| React | 18.x | UI 프레임워크 (useRef, useEffect, useCallback) |
| TypeScript | 5.x+ | 타입 안전성 |
| CodeMirror | 6.x | EditorView.scrollDOM, lineBlockAtHeight API |
| markdown-it | 14.x | 토큰 기반 data-line 주입 플러그인 |
| Zustand | 5.x | scrollSyncEnabled persist |
| Tailwind CSS | 3.x | Footer 토글 버튼 스타일링 |

---

## Risk Analysis

### Risk 1: 스크롤 동기화 정확도

- **확률**: Medium
- **영향**: Medium (사용자가 위치 불일치를 느낌)
- **완화 전략**: 라인 번호 기반 매핑 (퍼센트 기반보다 정확). data-line이 없는 구간은 보간(interpolation). 이미지, 다이어그램 등 높이가 크게 다른 요소는 offset 보정.
- **대안**: 블록 단위 매핑 대신 라인 단위 세밀 매핑 (성능 트레이드오프)

### Risk 2: 스크롤 이벤트 피드백 루프

- **확률**: High
- **영향**: High (무한 스크롤 루프 → 앱 정지)
- **완화 전략**: `isSyncing` ref 플래그로 에디터 → 미리보기 단방향만 처리. 미리보기 스크롤 이벤트는 isSyncing 기간 동안 무시. requestAnimationFrame 스로틀링.
- **대안**: 동기화 트리거를 스크롤 이벤트 대신 에디터 커서 변경으로 한정

### Risk 3: data-line 주입이 기존 렌더링에 영향

- **확률**: Low
- **영향**: High (미리보기 렌더링 깨짐)
- **완화 전략**: 플러그인은 기존 토큰 구조를 변경하지 않고 속성만 추가. Mermaid, Shiki 플러그인과 독립적으로 동작. 회귀 테스트 필수.
- **대안**: 렌더링 후 DOM 후처리로 data-line 주입 (성능 저하 가능)

### Risk 4: 대용량 문서 스크롤 동기화 성능

- **확률**: Medium
- **영향**: Medium (스크롤 지연)
- **완화 전략**: `requestAnimationFrame` 스로틀링으로 최대 60fps. querySelectorAll 결과 캐싱 (콘텐츠 변경 시 갱신). 이진 탐색으로 O(log N) 요소 탐색.
- **대안**: data-line 요소를 Map으로 인덱싱하여 O(1) 접근

### Risk 5: EditorView 인스턴스 라이프사이클

- **확률**: Low
- **영향**: Medium (null 참조 에러)
- **완화 전략**: `onViewReady`로 EditorView 생성 시점에만 참조 전달. useScrollSync 내부에서 null 체크 필수. 컴포넌트 언마운트 시 이벤트 리스너 정리.
- **대안**: EditorView 상태를 Observable 패턴으로 관리

---

## File Manifest

| 파일 경로 | 유형 | 설명 |
|-----------|------|------|
| `src/hooks/useScrollSync.ts` | Hook (신규) | 에디터-미리보기 스크롤 동기화 핵심 훅 |
| `src/lib/markdown/renderer.ts` | Utility (수정) | data-line 주입 markdown-it 플러그인 추가 |
| `src/store/uiStore.ts` | Store (수정) | scrollSyncEnabled 상태 추가 (persist) |
| `src/components/layout/Footer.tsx` | Component (수정) | 스크롤 동기화 토글 버튼 추가 |
| `src/components/preview/MarkdownPreview.tsx` | Component (수정) | 스크롤 컨테이너 ref 추가 |
| `src/components/editor/MarkdownEditor.tsx` | Component (수정) | onViewReady prop (SPEC-EDITOR-002와 공유) |
| `src/components/layout/AppLayout.tsx` | Component (수정) | viewRef, previewRef 연결, useScrollSync 호출 |

---

## Traceability

- SPEC Reference: SPEC-PREVIEW-002
- Product Reference: product.md - Core Feature 2 (Real-Time Preview), UX Enhancement (Scroll Sync)
- Structure Reference: structure.md - `src/hooks/`, `src/lib/markdown/`, `src/components/preview/`, `src/components/layout/`
