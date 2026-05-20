# SPEC-PREVIEW-005 — 구현 계획

> 기존 프리뷰 라우팅 단일 진입점(SPEC-PREVIEW-004 `PreviewContainer`/`getFileViewType`)을 확장한다. 마크다운 파이프라인(SPEC-PREVIEW-001/002/003)·`.html` 보기(SPEC-PREVIEW-004)는 변경하지 않는다. 신규 npm 의존성 0.

## 기술 접근

- **재사용 우선**: 이미 설치된 Shiki 싱글톤(`getHighlighter()`, `github-dark`/`github-light` + 사전 로드 언어)을 그대로 사용한다. 신규 패키지 추가 없음.
- **단일 라우팅 진입점 확장**: `getFileViewType`의 반환 타입을 `'html' | 'markdown'` → `'html' | 'code' | 'markdown'`으로 확장하고 분기 1개만 추가한다. 아키텍처 재작성 없음.
- **명시적 매핑 분리**: 확장자→Shiki 언어 매핑을 `src/lib/preview/extensionLangMap.ts` 순수 모듈로 분리하여 테스트·확장이 쉽도록 한다.

## 설계 결정 (승인됨)

### 결정 1 — 렌더 소스: 에디터 버퍼 라이브 렌더 (채택)

- **채택**: (a) 에디터 버퍼(`useEditorStore.content`)에서 라이브 렌더 — `usePreview`의 디바운스(300ms) + 테마 구독 + 하이라이터 초기화 패턴을 복제한다.
- **근거**: 파일을 열면 텍스트가 이미 `useEditorStore.content`에 적재되어 CodeMirror에 표시되므로, 코드/데이터 파일도 별도 파일 재읽기 IO 없이 버퍼에서 즉시 강조 가능하다. 마크다운 경로와 동일한 라이브 갱신 일관성을 얻는다. `.html`만 파일 경로(iframe)인 이유는 외부 스크립트/asset 실행이 필요했기 때문이며, 코드 뷰어는 단순 텍스트→HTML이라 그 제약이 없다.
- **회귀 방지 제약**: `usePreview`는 마크다운 전용(`renderMarkdown` 호출)이므로 **직접 수정하지 않는다.** 코드 경로는 전용 훅 `useCodePreview` 또는 `CodeFileViewer` 내부 effect로 패턴만 복제한다(둘 중 하나만 채택). 이로써 마크다운 렌더 경로 회귀 위험을 0으로 유지한다.
- **기각**: (b) 파일 경로(HtmlFileViewer 패턴)는 추가 IO·`convertFileSrc`·로드 에러 처리가 필요하고 라이브 갱신이 없어 에디터 콘텐츠와 괴리될 수 있다. 본 기능에는 과하다.

### 결정 2 — 확장자→Shiki 언어 매핑 (v1) + `getFileViewType` 확장 방식

- **v1 매핑 (작고 명시적)**:

  | 확장자 | Shiki lang | 싱글톤 사전 로드 |
  |---|---|---|
  | `.py` | `python` | 이미 로드됨 |
  | `.js`, `.mjs`, `.cjs` | `javascript` | 이미 로드됨 |
  | `.ts` | `typescript` | 이미 로드됨 |
  | `.json` | `json` | 이미 로드됨 |
  | `.jsonl` | `json` | json 재사용 |
  | `.yaml`, `.yml` | `yaml` | 이미 로드됨 |
  | `.toml` | `toml` | **싱글톤에 추가 필요** |
  | `.sh`, `.bash` | `bash` | 이미 로드됨 |
  | `.css` | `css` | 이미 로드됨 |

- **`getFileViewType` 확장 (회귀 안전)**:
  1. 반환 타입 `'html' | 'code' | 'markdown'`로 확장.
  2. 분기 순서: `.html` 먼저(기존) → 코드 매핑 조회 시 `'code'` → 그 외 전부 `'markdown'`(기존 폴백 유지).
  3. 매핑은 `extensionLangMap` 단일 객체로 분리.
  4. 안전장치: 매핑에는 있으나 싱글톤 미로드 언어는 plaintext 폴백 처리(앱 중단 금지).

## 위험 분석

| 위험 | 심각도 | 대비책 | 검증 |
|------|--------|--------|------|
| `usePreview` 재사용 시 마크다운 경로 회귀 | 높음 | `usePreview` 직접 수정 금지. 별도 `useCodePreview` 또는 `CodeFileViewer` 내부 effect로 패턴만 복제 | 회귀 시나리오(마크다운 렌더 무변경) |
| 매핑에 있으나 싱글톤 미로드 언어(`toml`) → Shiki throw | 중간 | 싱글톤 `langs`에 `toml` 추가 + 미로드 언어 plaintext 폴백 | 시나리오 C·E (강조 출력 / 폴백) |
| 대용량 코드/데이터 파일 강조 시 메인스레드 블로킹 | 중간 | v1 비범위로 명시(Exclusions). 디바운스가 일부 완화. 후속 SPEC 대상 | 리스크 기록만 |
| `.html`/`.md` 기존 라우팅 회귀 | 높음 | 분기 우선순위 `.html` → `'code'` → `'markdown'`로 기존 경로 보존 | 시나리오 A·B (라우팅/폴백) |
| 코드 뷰어 출력의 XSS 오해 | 낮음 | Shiki는 입력 텍스트를 escape하여 토큰화 — 기존 `PreviewRenderer` posture와 동일, 추가 sanitize 불요 | MX:NOTE로 명시 |

## 작업 분해 (Run 단계 순서)

> 순서: 매핑 모듈 → 뷰어 컴포넌트 → 라우팅 연결 → Shiki 싱글톤에 toml 추가. development_mode = tdd이므로 각 단계는 RED(실패 테스트) → GREEN(최소 구현) → REFACTOR 순으로 진행한다.

### Phase 1 — 확장자→언어 매핑 모듈 (선행, 순수 함수)

- **Task 1.1** `src/lib/preview/extensionLangMap.ts` 신규 작성 — v1 매핑 객체 + 조회 헬퍼(예: `getLangForExtension(path): string | null`). 순수 함수, 대소문자 무관.
- **Task 1.2** (RED) `src/test/extensionLangMap.test.ts` — 매핑/조회/미등록 폴백 단위 테스트 먼저 작성.

### Phase 2 — 코드 뷰어 컴포넌트 (에디터 버퍼 라이브 렌더)

- **Task 2.1** `src/components/preview/CodeFileViewer.tsx` 신규 작성 — `useEditorStore.content` 구독, 디바운스(300ms) + 테마 구독 + 하이라이터 초기화 패턴 복제(전용 effect 또는 `useCodePreview`). `usePreview` 무수정. 강조 실패/미로드 언어 plaintext 폴백.
- **Task 2.2** (RED) `src/test/CodeFileViewer.test.tsx` — 강조 출력 렌더·테마 전환 재강조·미로드 언어 폴백 테스트.

### Phase 3 — 라우팅 연결

- **Task 3.1** `getFileViewType` 반환 타입 확장 + `'code'` 분기 추가(`PreviewContainer.tsx`). 분기 순서 `.html` → `'code'` → `'markdown'` 유지.
- **Task 3.2** (RED→GREEN) `src/test/PreviewContainer.test.tsx` 보강 — `'code'` 라우팅 케이스 + 미지원 확장자 폴백 케이스 추가.

### Phase 4 — Shiki 싱글톤 언어 보강

- **Task 4.1** `src/lib/markdown/codeHighlight.ts`의 `getHighlighter()` `langs`에 `toml` 추가. 다른 언어는 그대로 둠.
- **Task 4.2** (회귀) 마크다운 렌더 경로가 영향받지 않음을 기존 `renderer.test.ts`/`usePreview.test.ts`로 확인.

### Phase 5 — MX 태그 계획

- `getFileViewType` (`PreviewContainer.tsx`): 기존 `@MX:ANCHOR` 갱신 — 반환 타입 변경 + 새 분기 반영, `@MX:SPEC: SPEC-PREVIEW-005 REQ-PREVIEW005-001` 추가. fan_in 유지 → ANCHOR 유지. `@MX:REASON` 갱신.
- `CodeFileViewer` (신규): `@MX:NOTE` — 에디터 버퍼 구독 + Shiki 재사용 의도, XSS posture(Shiki escape) 명시. `@MX:SPEC: SPEC-PREVIEW-005 REQ-PREVIEW005-002/003`.
- `extensionLangMap` (신규): `@MX:NOTE` — v1 매핑 범위가 의도적으로 작다는 점 + 확장 가이드.
- `getHighlighter` (`codeHighlight.ts`): 기존 `@MX:ANCHOR` 유지. `langs` 변경 시 `@MX:SPEC`에 005 추가(fan_in 증가: renderer/usePreview/exportHtml + CodeFileViewer).
- 코드 주석 언어: `language.yaml`의 `code_comments: ko` 준수.

## 마일스톤 (우선순위 기반, 시간 추정 없음)

- **M1 (Priority High)**: Phase 1 — 매핑 모듈 + 단위 테스트.
- **M2 (Priority High)**: Phase 2 — `CodeFileViewer` + 강조/테마 테스트.
- **M3 (Priority Medium)**: Phase 3 — 라우팅 연결 + `PreviewContainer` 테스트 보강.
- **M4 (Priority Medium)**: Phase 4 — Shiki 싱글톤 `toml` 추가 + 마크다운 회귀 확인.
- **M5 (Priority Low)**: Phase 5 — MX 태그 부착.

순서 제약: M1(매핑) 완료 후 M2(뷰어) 시작, M2 후 M3(라우팅 연결) 시작. Phase 4는 매핑에 `.toml`이 포함되므로 M3 전까지 완료 권장.

## Definition of Done

- spec.md의 5개 EARS 요구 모듈이 모두 구현·검증됨.
- acceptance.md의 모든 Given/When/Then 시나리오 통과 — 특히 라우팅(A)·폴백(B)·회귀(`.html`/`.md` 무변경).
- 프런트엔드 타입체크 및 vitest 테스트 통과(development_mode = tdd, RED 우선).
- 신규 npm 의존성 0 확인 (`package.json` diff 없음).
- MX 태그 계획(Phase 5)에 따라 `@MX:ANCHOR`/`@MX:NOTE` 부착 + `@MX:REASON`/`@MX:SPEC` 포함.

## 미해결 사항 (run 단계 확인 필요)

- **#1 `useCodePreview` 분리 여부** — 전용 훅으로 분리할지 `CodeFileViewer` 내부 effect로 흡수할지는 run 단계 구현 시 더 단순한 쪽으로 확정. 핵심 제약(`usePreview` 무수정)만 고정.
- **#2 plaintext 폴백 표시 형태** — 미로드/미지원 언어를 plaintext로 보일지, 안내 문구를 곁들일지 run 단계에서 확정.
