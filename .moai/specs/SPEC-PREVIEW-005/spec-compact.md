# SPEC-PREVIEW-005 (Compact)

> 자동 생성 압축본. EARS 요구사항 + 수용 기준 + 변경 파일 + Exclusions만 포함. 전체 맥락은 spec.md / plan.md / acceptance.md 참조.

- id: SPEC-PREVIEW-005
- status: draft
- priority: medium
- dependencies: SPEC-PREVIEW-001, SPEC-PREVIEW-004

## EARS Requirements

### REQ-PREVIEW005-001 (Ubiquitous) — 파일 종류 분기 순수 함수 확장
- The system **shall** `getFileViewType(path)`가 코드 매핑 등록 확장자(대소문자 무관)에 `'code'`, `.html`에 `'html'`, 그 외 전부 `'markdown'`을 반환한다.
- The system **shall** 분기 우선순위 `.html` → `'code'` → `'markdown'`로 평가하여 기존 라우팅을 변경하지 않는다.
- The system **shall** 확장자→언어 매핑을 단일 `extensionLangMap` 모듈에 명시한다.

### REQ-PREVIEW005-002 (Event-driven) — 코드 보기 모드 라우팅
- **WHEN** 코드 매핑 등록 파일을 선택하면, **the system shall** `PreviewContainer`가 `CodeFileViewer`를 렌더한다.
- **WHEN** 코드 보기에서 마크다운 파일을 선택하면, **the system shall** 마크다운 렌더링 모드로 복귀한다.

### REQ-PREVIEW005-003 (Event-driven) — 에디터 버퍼 라이브 재렌더
- **WHEN** 코드 파일의 에디터 버퍼(`useEditorStore.content`)가 변경되면, **the system shall** 공유 Shiki 하이라이터로 디바운스(300ms) 후 재렌더한다.
- The system **shall** 코드 경로를 `usePreview` 수정 없이 별도 경로로 구현하여 마크다운 회귀를 방지한다.

### REQ-PREVIEW005-004 (State-driven) — 다크/라이트 테마 연동
- **WHILE** 다크 모드(`dark` 클래스) 동안 **the system shall** `github-dark`로 강조한다.
- **WHILE** 비다크 동안 **the system shall** `github-light`로 강조한다.
- **WHEN** 테마 전환(`useUIStore.theme`) 시 **the system shall** 재강조한다.

### REQ-PREVIEW005-005 (Unwanted behavior) — 미지원 확장자 폴백 / 회귀 차단
- **IF** 확장자가 매핑 미등록이면 **then the system shall** 코드 보기로 라우팅하지 않고 마크다운으로 폴백한다(`.html`/`.md` 무변경).
- **IF** 매핑에는 있으나 Shiki 미로드 언어이면 **then the system shall** plaintext 폴백/안전 표시로 처리(앱 중단 금지)한다.
- **IF** 강조·렌더 중 오류 발생 시 **then the system shall** 앱을 중단하지 않고 직전 출력 유지 또는 안전 상태로 처리한다.

## Acceptance Criteria

- 시나리오 A (must-pass): `getFileViewType` — `.py`/`.json`/`.yaml`/`.ts` → `'code'`, `.html` → `'html'`, `.md`/확장자 없음 → `'markdown'`; `PreviewContainer`가 `'code'`에서 `CodeFileViewer` 렌더.
- 시나리오 B (must-pass): 미지원 확장자(`archive.xyz`) → `'markdown'` 폴백, `CodeFileViewer` 미렌더; `.html`/`.md` 기존 라우팅 무변경.
- 시나리오 C: 코드 파일 + 버퍼 텍스트 → 디바운스 후 Shiki 강조 HTML(`<pre class="shiki">` + 토큰 span) DOM 표시.
- 시나리오 D: 테마 dark 전환 시 `github-dark`로 재강조.
- 시나리오 E: 미로드/미지원 언어·강조 오류 시 plaintext 폴백/안전 처리(앱 중단 없음).
- 엣지: 대문자 확장자 동일 라우팅, 빈 파일 안전 표시, `.jsonl`→json 강조, 빠른 반복 전환 정상.
- 게이트: 타입체크 + vitest 통과, 신규 npm 의존성 0, `.html`/마크다운 회귀 없음, MX 태그 부착.

## Files to Modify

- [MODIFY] `src/components/preview/PreviewContainer.tsx` — `getFileViewType` 반환 타입 `'html' | 'code' | 'markdown'` 확장 + `'code'` 분기 추가.
- [MODIFY] `src/lib/markdown/codeHighlight.ts` — `getHighlighter()` `langs`에 `toml` 추가.
- [NEW] `src/lib/preview/extensionLangMap.ts` — 확장자→Shiki 언어 명시 매핑 + 조회 헬퍼.
- [NEW] `src/components/preview/CodeFileViewer.tsx` — 에디터 버퍼 구독 + Shiki 강조 보기 전용 컴포넌트.
- [NEW] `src/hooks/useCodePreview.ts` (선택) — 디바운스/테마/하이라이터 패턴 코드용 분리(또는 컴포넌트 내부 effect로 흡수).
- [EXISTING] `src/components/preview/MarkdownPreview.tsx`, `PreviewRenderer.tsx`, `src/hooks/usePreview.ts`, `src/components/preview/HtmlFileViewer.tsx` — 변경 없음.

## Exclusions (What NOT to Build)

- 신규 npm 의존성 추가 미포함 (Shiki 등 이미 설치 — 재사용만).
- 의미론적 렌더링 미포함 (JSON 트리·CSV 테이블·다이어그램 등).
- 코드 편집·포매팅·린팅·라인 번호·코드 폴딩·인라인 검색 미포함 (보기 전용).
- 대용량 파일 가상 스크롤·청크 렌더 미포함 (후속 SPEC).
- `.html` 라우팅 동작 변경 미포함 (SPEC-PREVIEW-004 유지).
- Shiki 싱글톤 언어 대량 확장 미포함 (`toml`만 최소 추가).
