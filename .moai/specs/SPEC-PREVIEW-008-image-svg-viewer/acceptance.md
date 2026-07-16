# SPEC-PREVIEW-008 — 수용 기준

> 게이트 = tsc + vitest + Playwright(eslint 아님). 렌더·라우팅·sanitize는 Vitest + @testing-library/react로, 줌·팬·토글 상호작용과 XSS 미실행은 Playwright로 검증한다. 보안 시나리오(F·G)와 회귀 차단(H)이 must-pass.

## 사전 준비

- **픽스처(파일)**: `logo.png`(투명 PNG), `photo.jpg`, `anim.gif`, `pic.webp`, `icon.svg`(정상 도형), `evil.svg`(내부 `<script>`·`onload` 포함), `big.png`(> 5MB), `big.svg`(> 5MB), 비교용 `README.md`·`app.ts`·`index.html`·`.gitignore`.
- **픽스처(마크다운)**: 인라인 `<svg>` 포함 `.md`, `<script>`/`<iframe onerror>` 포함 `.md`, 코드블록 안에 `<svg>` 텍스트가 든 `.md`, `![](icon.svg)` 이미지 문법 포함 `.md`.
- **mock**: `useFileStore.currentFile`/`previewStatus`, `convertFileSrc`(asset:// URL 반환), `readFile`(svg 성공/래스터 reject), `FileNode.size` 주입, `useUIStore.theme`.

---

## 기능 시나리오

### 시나리오 A: 래스터 이미지 뷰어 라우팅 (REQ-001) — must-pass
- **Given** `logo.png`가 주어지고
- **When** 사용자가 파일을 선택하면
- **Then** `getFileViewType`가 `'image'`를 반환하고 `ImageFileViewer`가 렌더되며, `UnsupportedFileViewer`(binary)로 라우팅되지 않는다
- **And** `previewStatus='binary'`가 설정되더라도 확장자 분기가 우선하여 이미지 뷰가 유지된다(D1)
- **And** 편집기 버퍼에 파일 내용이 로드되지 않는다.

### 시나리오 B: 이미지 뷰어 기능 (REQ-002)
- **Given** 이미지 뷰어가 열린 상태에서
- **When** fit/100%/확대/축소/팬을 조작하면
- **Then** 각 조작이 이미지 스케일·위치에 반영되고
- **And** 투명 PNG는 체커보드 배경 위에 표시되며 픽셀 크기(예: `128×128`, `naturalWidth/Height`)와 파일 크기(`FileNode.size`)가 표시되고
- **And** 이미지는 `convertFileSrc`(asset://)로 로드된다(base64 아님, D2).

### 시나리오 C: 대용량 이미지 미리보기 유지 (REQ-003) — must-pass
- **Given** `big.png`(> 5MB)가 주어지고
- **When** 사용자가 선택하면
- **Then** `'too-large'` 플레이스홀더가 아니라 `ImageFileViewer`가 표시되고
- **And** 이미지는 asset://로 로드되어 `FILE_SIZE_THRESHOLD` 가드가 적용되지 않는다.

### 시나리오 D: SVG 렌더 뷰 기본 + 토글 (REQ-004) — must-pass
- **Given** `icon.svg`가 주어지고
- **When** 사용자가 선택하면
- **Then** `getFileViewType`가 `'svg'`를 반환하고 `SvgFileViewer`가 렌더 뷰(그림)를 기본 표시하며 `'text'` 평문 뷰로 라우팅되지 않고(D6)
- **When** 소스 토글을 조작하면
- **Then** Shiki 강조된 XML 소스 뷰로 전환되고 다시 토글하면 렌더 뷰로 복귀한다.

### 시나리오 E: SVG 렌더 뷰 줌/팬 + 대용량 소스 처리 (REQ-004)
- **Given** SVG 렌더 뷰가 활성인 상태에서
- **When** 줌·팬을 조작하면
- **Then** 이미지 뷰어와 동일하게 스케일·위치가 반영되고
- **Given** `big.svg`(> 5MB)에서
- **When** 소스 뷰로 토글하면
- **Then** 소스 뷰에만 대용량 안내가 적용되고 렌더 뷰는 계속 표시된다(D3).

### 시나리오 F: 악성 SVG 스크립트 미실행 (REQ-005) — must-pass (보안)
- **Given** `<script>`·`onload` 핸들러를 포함한 `evil.svg`가 주어지고
- **When** SVG 렌더 뷰로 표시하면
- **Then** 스크립트가 실행되지 않고(전역 부작용·window 플래그 없음) 위험 노드(`<script>`, `on*`, `<foreignObject>`)는 DOM에서 제거되며
- **And** sanitize/파싱 실패 시 앱이 중단되지 않고 안전 폴백(빈 렌더 또는 소스 뷰)이 표시된다.

### 시나리오 G: 마크다운 인라인 SVG 허용 + 일반 HTML 차단 (REQ-006, 007) — must-pass (보안)
- **Given** 인라인 `<svg>`와 `<script>`/`<iframe onerror>`를 각각 포함한 마크다운, 그리고 코드블록 안에 `<svg>` 텍스트가 든 마크다운이 주어지고
- **When** 마크다운을 렌더하면
- **Then** 본문의 `<svg>` 도형은 sanitize된 뒤 프리뷰에 렌더되고
- **And** `<script>`·`<iframe>`·이벤트 핸들러는 렌더되지 않으며(html:false 유지) 스크립트가 실행되지 않고
- **And** 코드블록 안 `<svg>` 텍스트는 렌더되지 않고 코드로 그대로 표시된다(placeholder 오치환 방지).

### 시나리오 H: 기존 경로 회귀 차단 (REQ-008) — must-pass
- **Given** `README.md`·`app.ts`·`index.html`·`.gitignore`·`![](icon.svg)` 포함 마크다운이 주어지고
- **When** 각각을 선택/렌더하면
- **Then** `.md`→마크다운, `.ts`→코드 뷰어, `.html`→HTML 뷰어, `.gitignore`→평문, 이미지 문법 `![](icon.svg)`→imageResolver(asset:// 변환) 경로가 **변경 없이** 동작한다.

---

## 테스트 매핑 (REQ → 시나리오 → 도구)

| REQ | 시나리오 | 도구 | must-pass |
|-----|----------|------|-----------|
| REQ-PREVIEW008-001 | A | Vitest(라우팅 순수 함수 `getFileViewType`, 렌더 분기) | Y |
| REQ-PREVIEW008-002 | B | Vitest(메타 표시) + Playwright(줌·팬 상호작용) | - |
| REQ-PREVIEW008-003 | C | Vitest(too-large 미적용 라우팅) | Y |
| REQ-PREVIEW008-004 | D, E | Vitest(라우팅·토글 상태) + Playwright(줌·팬·토글) | Y(D) |
| REQ-PREVIEW008-005 | F | Vitest(sanitize 노드 제거) + Playwright(스크립트 미실행) | Y |
| REQ-PREVIEW008-006 | G | Vitest(placeholder-and-restore, sanitize) | Y |
| REQ-PREVIEW008-007 | G | Vitest(일반 HTML 차단) + Playwright(스크립트 미실행) | Y |
| REQ-PREVIEW008-008 | H | Vitest(기존 라우팅 회귀) + Playwright(이미지 문법) | Y |

## Definition of Done

- [ ] 시나리오 A~H 전체 통과, must-pass(A·C·D·F·G·H) 100%.
- [ ] `tsc` 0 에러, `vitest` 전체 그린, Playwright E2E(줌·팬·토글·XSS 미실행) 그린.
- [ ] 악성 SVG(`evil.svg`, 인라인 `<script>`) 픽스처에서 스크립트 미실행 가드 고정.
- [ ] 기존 라우팅(.md/.html/code/text/binary)·이미지 문법(`![]()`) 회귀 없음.
- [ ] `html:false` 유지 확인(renderer.ts 변경이 전역 원시 HTML을 허용하지 않음).
- [ ] `fileStore.ts` `PreviewStatus` 미확장 확인(D1).
- [ ] 신규 컴포넌트·유틸에 @MX 태그(plan.md @MX Tag Targets) 부여.
