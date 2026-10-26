# SPEC-PREVIEW-015 — 설계

> spec.md(무엇·왜)와 plan.md(마일스톤·변경 파일) 사이의 설계 결정을 모은 문서다. 결정 번호 D1–D15는 plan.md·acceptance.md가 그대로 참조한다. 코드 근거는 research.md에 있다.
> M1 판정에 따라 값이 정해지는 결정(D2의 `responsive`, D5의 변수 목록, D14의 단위 테스트 측정기)은 M1 판정 뒤 이 문서에 결과를 적는다.

## 1. 확정 결정 (Locked Decisions)

| # | 결정 | 내용 | 근거 |
|---|------|------|------|
| D1 | 엔진 = pele 1.10.0 전면 교체 (사용자 결정) | `npm i -E pele@1.10.0`으로 설치한다. 두 라이브러리 병행, 렌더러 토글, mermaid 폴백은 두지 않는다. 입력 문법은 Mermaid 그대로다. | spec HISTORY 0.1.0 |
| D2 | 고정 옵션 (사용자 결정, API 확인) | 모든 pele 호출에 `autoDirection: false`, `links: false`, `images: false`(D13)를 넘긴다. pele API 문서상 640px 미만에서 세로 배치로 바꾸는 것은 `autoDirection`이고, `responsive`는 컨테이너 폭에 맞춰 크기만 줄인다. `responsive`는 기본값 `true`를 후보로 두고, M1 보고서에 `true`·`false`를 나란히 보인 뒤 사용자가 M1 판정 때 정한다. | pele API, `dist/types.d.ts` |
| D3 | 모듈 하나, 렌더 함수 하나 | 가칭 `src/lib/diagram/diagramRenderer.ts`. 책임은 (1) 렌더: 정화된 SVG와 `width`·`height`, 또는 오류(코드·메시지·위치)를 돌려준다. (2) 검증: **(1)과 같은 렌더 함수를 같은 고정 옵션으로 호출**하고 성공 여부와 오류만 돌려준다. pele `parse`만 따로 부르지 않으므로, 렌더 단계에서만 나는 실패(`limit`, 출력 한도)도 검증에서 똑같이 잡힌다. (3) 위치 접미사 문구를 만든다. (4) 내보내기용 색 값을 풀어 넣는다(D6). 호출마다 고유 `idPrefix`를 넘겨 한 문서 안에서 `id`가 겹치지 않게 한다. | spec REQ-001·002·006·012 |
| D4 | 정화 = 기존 `sanitizeSvg` 그대로 | 모듈 안에서 pele 출력을 `sanitizeSvg`에 통과시킨다. `svgSanitize.ts`는 바꾸지 않는다. 정화 뒤 모양, `<style>`, 인라인 style이 남는지는 M1에서 확인한다. | spec REQ-003, research.md §1.6 |
| D5 | 테마 = `--pele-*`를 `--md-*`에 연결 | `mdedit-tokens.css`의 `:root`와 `[data-theme="dark"]` 두 블록에 정의한다. 연결할 변수 목록과 대응 토큰은 M1에서 pele 1.10.0 출력과 https://pele.run/theming 문서로 확정해 이 표에 적는다. 이슈 #29(`classDef` 노드의 다크 대비)는 M1 보고서에서 실물로 확인한다. | spec REQ-008 |
| D6 | 내보내기 = 원본 렌더 + 색 값 치환 (단일 방식) | **HTML**: `replaceMermaidPlaceholders`를 "자리마다 원본 펜스를 모듈로 렌더"로 바꾼다. 자리 순서는 `renderMarkdown` 결과의 `.mermaid-container` 순서이고, 입력은 그 자리의 `data-diagram` 속성값(미리보기와 같은 문자열)이다. **PDF**는 HTML 생성 경로를 그대로 쓴다. **DOCX**는 `captureMermaidImages` 대신 펜스 토큰마다 모듈로 렌더해 PNG로 바꾼다. DOCX 입력 문자열은 `mermaidPlugin`과 같은 이스케이프·디코드를 거쳐 미리보기와 같게 만들며, 구체 방식은 M4 단위 테스트로 고정한다. **색**: 내보내기 시점에 내보내기 `theme`(`light`·`dark`)에 해당하는 모든 `--pele-*` 사용자 정의 속성을 실제 값으로 풀어, SVG 안의 `var(--pele-…)` 참조(대체값 포함 전체)를 그 값으로 **치환**한다. 그래서 내보낸 SVG(HTML·PDF 결과, DOCX 래스터 입력)에는 `var(--pele-` 문자열이 한 번도 나오지 않는다. 값은 내보내기 `theme`의 `data-theme`를 단 탐침 요소에 `getComputedStyle`을 적용해 읽는다. 단위 테스트는 색 값 표를 주입하는 시험용 진입점을 쓴다(jsdom은 앱 CSS를 읽지 않는다). SVG 루트에 변수를 선언하는 방식은 쓰지 않는다. | spec REQ-015·018, research.md §2.5 |
| D7 | 실패·빈 펜스 자리 = 형식별 현재 동작 + 위치 고정 | HTML·PDF는 빈 `.mermaid-container`를 두고, DOCX는 그 펜스의 코드 텍스트를 넣는다. 펜스마다 따로 처리하므로 밀림이 생기지 않는다. | spec REQ-017 |
| D8 | DOCX 크기 = pele `width`·`height` | 지금의 `getBoundingClientRect` + 최소 400×200 규칙 대신 pele가 알려 준 자연 크기를 쓴다. 2배 래스터와 0.75배 삽입 배율은 유지하고, 페이지 폭을 넘으면 비율을 지켜 줄인다. | spec REQ-019, research.md §8-8 |
| D9 | 오류 문구 (사용자 결정) | `⚠ Diagram syntax error` 뒤에 `(L행 C열)`·`(L행)`을 붙이거나 접미사 없이 쓴다. 텍스트 노드로만 넣는다. `validateMermaid`의 `error`에는 모듈이 같은 소스로 만든 `PeleError.message`를 그대로 담는다. AI 재요청 문구 `이전 오류: …`는 그대로 이어진다. | spec REQ-004·009·012 |
| D10 | 클래스·파일 이름 유지 | `.mermaid-container`, `.md-diagram-placeholder`, `.mdedit-ai-mermaid-preview`와 `mermaidPlugin.ts`·`mermaidValidate.ts` 파일 이름은 그대로 둔다. e2e 선택자, CSS, SPEC 문구 변경을 줄이기 위해서다. | spec REQ-006·013 |
| D11 | 시험 렌더링 코드 위치 | 저장소 루트 `spike/pele/`(이 브랜치 전용)에 비교 페이지(`index.html:7`과 같은 CSP meta 사용), 렌더 스크립트, 내보내기 시제품, 픽스처 캡처 스크립트를 둔다. **머지 전 M7에서 삭제한다.** 비교에 mermaid가 필요한데 M2에서 mermaid를 제거하므로, 남겨 두면 실행할 수 없는 코드가 되거나 두 라이브러리를 계속 설치해야 한다. 남는 것은 캡처한 픽스처(`src/test/fixtures/pele/`)와 보고서뿐이다. | spec REQ-023 |
| D12 | M1 보고서 위치 | `.moai/specs/SPEC-PREVIEW-015-pele-renderer/m1/report.html`(나란히 비교, 자체 포함 HTML)과 `m1/checks.md`(기계 확인 표·명령·출력). SPEC 폴더는 추적 대상이라 판정 근거가 커밋에 남는다(`.moai/reports/`의 일부 패턴은 gitignore 대상이다). | spec REQ-023 |
| D13 | `images: false` 고정 (사용자 결정 2026-10-26) | pele 기본값 `images: true`(`imageSchemes` `http`·`https`) 대신 모든 호출에 `images: false`를 넘긴다. 다이어그램 안 외부 이미지를 렌더 단계에서 끊고, `sanitizeSvg`의 href 훅(`svgSanitize.ts:45-56`)은 두 번째 방어선으로 남긴다. | spec REQ-002·011, research.md §1.6 |
| D14 | 픽스처 = 캡처 환경과 측정기를 함께 기록 | pele는 글자 폭을 `OffscreenCanvas`·캔버스 `measureText`로 잰다(`dist/pele.js`). 그래서 같은 입력이라도 측정기가 다르면 출력이 다르다. 픽스처를 두 묶음으로 나눈다. **(a) `src/test/fixtures/pele/unit/`** — vitest jsdom에서 단위 테스트와 **같은 측정기**(AC-001 확인 항목 11에서 정한다: jsdom에서 pele가 고르는 기본 측정기, 또는 테스트 전용으로 주입하는 고정 폭 측정기)로 캡처한다. 단위 테스트의 바이트 동일 비교는 이 묶음에만 쓴다. **(b) `src/test/fixtures/pele/browser/`** — M1 비교 페이지(webkit·캔버스 측정기)에서 캡처한다. 바이트 비교에는 쓰지 않고, 구조 불변식(요소 종류, 라벨 글자 존재, 정화 뒤 보존, `var(--pele-` 개수 등) 확인과 e2e 기대값 참고에만 쓴다. `manifest.json`의 각 항목에는 입력 소스, 옵션, pele 버전, 캡처 날짜, **캡처 환경**(실행기와 버전: 예 `vitest 3.x jsdom` / `playwright webkit 18.x`), **측정기**(`jsdom-default` / `fixed-width-test` / `canvas`)를 적는다. | spec REQ-023, acceptance AC-002 |
| D15 | 수식 라벨 미지원 | pele는 수식 라벨만 `foreignObject`로 그리는데, `sanitizeSvg`는 `foreignObject`를 금지한다(`svgSanitize.ts:15`). 정화기 설정을 완화하지 않으므로(spec Exclusions) 다이어그램 안 수식 라벨은 지원하지 않는다. 지금 앱의 mermaid strict 설정에서도 수식이 표시되지 않는지는 M1에서 **측정만** 하고 단정하지 않는다. | spec Exclusions, AC-001 확인 항목 13 |

## 2. Design Note — 왜 이렇게 하는가

- **원본에서 렌더하는 이유**: pele `render`는 동기 호출이라 마크다운 원본에서 곧바로 SVG를 만들 수 있다. 그러면 미리보기 DOM 의존, 인덱스 짝짓기, 에디터 단독 보기 누락, DOCX 밀림, 300ms debounce 차이가 한꺼번에 사라진다(research.md §2.5).
- **입력 문자열을 미리보기와 맞추는 이유**: `mermaidPlugin.ts:19`는 `"`만 이스케이프한다. 그래서 미리보기가 받는 문자열은 속성 파싱으로 `&amp;` 같은 엔티티가 디코드된 값이다. 내보내기가 펜스 토큰 원문을 그대로 넘기면 `A[R&amp;D]` 같은 소스에서 미리보기와 다른 글자가 나온다. REQ-006·015가 같은 입력을 요구하는 이유다. 이 차이가 실제로 생기는지는 M1에서 확인한다(research.md §8-3은 추정으로 표시되어 있다).
- **검증과 렌더를 같은 함수로 하는 이유**: 검증이 `parse`만 하고 미리보기가 `render`를 하면, 렌더 단계에서만 나는 실패 때문에 "검증은 통과했는데 미리보기는 실패"하는 불일치가 다시 생긴다. 이번 교체의 목적 하나가 그 불일치를 없애는 것이다(D3).
- **`links: false`인 이유**: `sanitizeSvg` 훅이 이미 `https:` href를 지우고(`svgSanitize.ts:45-56`), Rust `open_url_in_browser`에는 스킴 검증이 없다(`browser_ops.rs:11-29`, Windows는 `cmd /C start`). 링크를 켜려면 정화기 설정을 나눠야 하고 새 공격면이 생긴다.
- **`images: false`인 이유** (사용자 결정 2026-10-26): 다이어그램 안 외부 이미지를 렌더 단계에서 끊는다. `sanitizeSvg`의 href 훅은 두 번째 방어선으로 남는다. 정화기 하나에만 기대면 그 설정이 바뀌는 순간 외부 요청 경로가 열린다.
- **테마를 CSS 변수로 처리하는 이유**: 다시 그리지 않으므로 테마 토글 때 생기던 렌더 겹침과 전역 설정 덮어쓰기가 구조적으로 없어진다. 대신 앱 밖으로 나가는 내보내기에는 값을 풀어 넣어야 한다(REQ-018).
- **색을 치환 한 가지 방식으로 정한 이유**: pele는 `var(--pele-bg,#fff)`처럼 항상 대체값을 붙여 출력한다. 값을 풀지 못해도 라이트 대체값으로 그려지므로 "대체값 없는 참조 0건" 같은 확인은 언제나 통과해 버린다. 모든 참조를 실제 값으로 바꾸면 "`var(--pele-` 0건 + 해당 테마 값 존재"라는 이진 확인 하나로 다크 내보내기가 라이트로 새는 결함을 잡을 수 있다(D6, AC-020).
