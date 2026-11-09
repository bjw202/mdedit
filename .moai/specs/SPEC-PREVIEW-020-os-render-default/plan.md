# SPEC-PREVIEW-020 — 구현 계획

> 본 문서는 spec.md(WHAT/WHY)에 대한 HOW를 다룬다. 수용 기준은 spec.md §3에 있다(Tier S). 개발 방식은 TDD(표 구동 테스트를 먼저 쓰고 실패를 확인한다). 변경 가능성이 큰 결정(저장 모델·마이그레이션)을 위에, 기계적 갱신(테스트 수정)을 아래에 둔다.

## 확정 결정 (Locked Decisions)

| # | 결정 | 내용 | 근거 |
|---|------|------|------|
| D1 | 선택 모델 = `HtmlRenderMode \| null` | 저장값 `null`은 "고르지 않음". 초기값 `null`. 해소는 순수 함수 | 별도 불리언(`htmlRenderModeChosen`)은 필드가 하나 더 늘고 같은 마이그레이션 문제를 가진다. 기각 |
| D2 | 마이그레이션 = 영속 버전 1 → 2 | 버전 < 2에서 `'original'`은 보존, 그 밖(`'crisp'` 포함)은 `null` | 저장된 `'crisp'`은 명시 선택과 기본값을 구별할 수 없다(v0.20.0이 전체 상태를 쓴다). 버전 범프 없는 휴리스틱은 나중에도 구별할 방법이 없어 기각 |
| D3 | 기본값 판정 = `/^win/i` (앞 고정) | 비Windows는 전부 `'crisp'` | 고정하지 않은 `/win/i`는 "Darwin"에 맞는다(macOS 오판). AC-001이 가드한다 |
| D4 | 헬퍼 위치 = `src/lib/preview/htmlZoom.ts` | `defaultHtmlRenderMode`·`resolveHtmlRenderMode`를 018의 `detectPlatform`·`isMacPlatform` 옆에 둔다 | 새 파일을 만들면 모듈·import·테스트 파일이 하나씩 늘지만, 같은 곳에 두면 기존 OS 판정 헬퍼와 한 파일에 모이고 기존 `htmlZoom.test.ts`에 케이스만 더하면 된다. 비용: 파일 이름이 `htmlZoom`이라 렌더 모드와 의미가 어긋난다. 차이가 작아 diff가 더 작은 쪽을 택한다 |
| D5 | 토글 = 해소된 모드의 반대를 명시 저장 | 기본 상태에서 눌러도 `null`이 아니라 `'crisp'`/`'original'`이 저장된다 | REQ-003. 눌렀다는 사실이 "명시 선택"이다 |
| D6 | OS 기본값은 저장하지 않는다 | `persist` 대상에 해소 결과를 쓰지 않는다 | REQ-006. 저장하는 순간 명시 선택과 구별이 사라진다 |

## 마일스톤 (우선순위 순, 시간 추정 없음)

### M1 (Priority High) — 첫 관문: Windows 선명도 확인 (run 시작 전 관문)

- run 시작 시 가장 먼저 Windows 릴리스 빌드(v0.20.0)에서 수동 M-1의 선명도 부분을 확인한다: 원본 보기로 열어 150%·200%에서 글자가 선명한지. 이것은 사용자 관찰이지 우리 측정이 아니다(spec §5).
- 흐리면 run을 멈추고 차단 보고를 돌려 사용자가 고른다. 통과하면 M2로 간다.
- 이 관문은 코드를 만들기 전에 가정을 확인하는 단계라 TDD 순서와 충돌하지 않는다.

### M2 (Priority High) — 저장 모델과 마이그레이션 (RED → GREEN)

가장 바뀔 가능성이 높고 되돌리기 어려운 부분이므로 먼저 다룬다. 사용자 localStorage에 영구 흔적을 남긴다.

- RED: `src/test/uiStoreRenderMode.test.ts`에 AC-002·003·004 표를 쓴다. `rehydrateWith` 헬퍼에 저장 버전 인자를 더한다(현재 `version: 1` 고정). 현재 코드에서 실패하는 것을 확인한다.
- GREEN `src/store/uiStore.ts`:
  - `HtmlRenderMode`는 `'crisp' | 'original'` 그대로 두고, 상태 필드 `htmlRenderMode`의 타입을 `HtmlRenderMode | null`로 넓힌다. 초기값 `null`.
  - `normalizeHtmlRenderMode`의 반환을 `HtmlRenderMode | null`로 바꾼다(`'original'`/`'crisp'`만 통과, 나머지 `null`). `setHtmlRenderMode`와 `merge`가 같은 함수를 쓴다.
  - `merge`: 정규화 결과를 그대로 쓴다. `null`·부재를 `'crisp'`으로 바꾸지 않는다.
  - persist `version`을 2로 올린다. `migrate`는 두 단계를 차례로 적용한다: `version < 1`이면 `saveStatus` 제거(기존), `version < 2`이면 `htmlRenderMode`가 `'original'`이 아니면 `null`. 객체가 아닌 입력은 그대로 돌려준다(기존 가드 유지).
  - `@MX:NOTE`: 왜 `'crisp'`을 버리는지(구별 불가), 왜 `'original'`은 보존하는지(기본값이 `'crisp'`이던 시절 토글로만 생김)를 한 곳에 남긴다.
- 확인 사항: zustand `persist`가 저장 버전과 현재 버전이 다를 때 `migrate`를 호출하고 그 결과 위에 `merge`를 적용하는 순서를 테스트로 직접 확인한다(AC-004의 버전 0·1 경로가 그 증거다). 기억에 기대지 않는다.

### M3 (Priority High) — 순수 함수 (RED → GREEN)

- RED: `src/test/htmlZoom.test.ts`에 AC-001 표를 더한다. "Darwin" 케이스가 앞 고정을 가드하는지 확인하려고, 먼저 고정 없는 구현(`/win/i`)으로 이 케이스가 실제로 실패하는 것을 한 번 본다.
- GREEN `src/lib/preview/htmlZoom.ts`: `defaultHtmlRenderMode(platform)`, `resolveHtmlRenderMode(choice, platform)`을 더한다. 반환·인자 타입은 `'crisp' | 'original'` 리터럴 유니온을 직접 쓴다. `uiStore.ts`가 이미 `htmlZoom.ts`를 import하므로 거꾸로 `HtmlRenderMode`를 `uiStore`에서 가져오면 순환이 생긴다. 리터럴 유니온은 구조적으로 같아 호환된다.

### M4 (Priority Medium) — 소비자 두 곳 (RED → GREEN)

- RED: `HtmlFileViewer`·`Header` 테스트에 AC-005·006을 쓴다. 플랫폼은 `@/lib/preview/htmlZoom`을 부분 모의해 `detectPlatform`만 바꿔 넣는다(`vi.mock(..., async (orig) => ({ ...(await orig()), detectPlatform: vi.fn() }))`). `navigator.platform` 직접 조작은 쓰지 않는다. `detectPlatform`이 `userAgentData`를 먼저 보기 때문이다.
- GREEN:
  - `HtmlFileViewer.tsx`: `const mode = useUIStore(...)` 뒤에 `resolveHtmlRenderMode(mode, detectPlatform())`로 분기한다. 두 뷰 컴포넌트 본문은 건드리지 않는다.
  - `Header.tsx`: `aria-pressed`·`is-active`·클릭 핸들러가 해소된 모드를 쓴다. `detectPlatform()`은 렌더마다 부르되 값이 문자열이라 비용이 없다. 키 리스너의 기존 `isMacPlatform(detectPlatform())` 호출 방식과 맞춘다.
  - 두 파일에서 해소 호출이 중복되므로(2곳) 훅으로 묶지 않는다. 호출 2줄이라 추상화가 비용을 못 한다(단순함 원칙).

### M5 (Priority Medium) — 기존 테스트·e2e 갱신 (기계적)

spec §5의 부분 개정으로 019 테스트 일부가 바뀐다. 아래가 갱신 대상 목록이다(갱신 없이 통과하는 것도 목록에 두어 "확인했다"를 남긴다).

| 파일 | 갱신 내용 |
|------|----------|
| `src/test/uiStoreRenderMode.test.ts` | `beforeEach`의 `setState({ htmlRenderMode: 'crisp' })` → `null`. "기본값 `'crisp'`" 단언 → `null`. 재수화 표에서 부재·`null`·허용 밖 값의 기대를 `'crisp'` → `null`(`'crisp'`·`'original'` 자체는 그대로). `setHtmlRenderMode` 허용 밖 값의 기대 `'crisp'` → `null`. `rehydrateWith`의 `version: 1` → 인자화(기본 2) |
| `src/test/HeaderRenderMode.test.tsx` | `beforeEach`의 `'crisp'` 시드 → `null` + `detectPlatform` 모의(`"MacIntel"`). 기존 토글 두 번 왕복 단언은 macOS 모의 아래서 그대로 성립하므로 유지하고, Windows 기본·명시 선택 케이스를 더한다 |
| `src/test/HtmlFileViewer.test.tsx` | `'original'` 명시 시드라 의미상 불변. 통과 확인만 한다(플랫폼과 무관) |
| `src/test/HtmlFileViewerCrisp.test.tsx` | `'crisp'` 명시 시드라 의미상 불변. 폴백 뒤 저장 모드 불변 단언(`htmlRenderMode` toBe `'crisp'`)이 계속 통과하는지 확인한다. 플랫폼 모의는 `"Win32"`로 두어 "명시 선택이 OS 기본값을 이긴다"를 겸해 확인한다 |
| `e2e/html-file-viewer.spec.ts` | 원본 보기 describe의 시드 `version: 1` → `2`(v1 시드는 마이그레이션을 거쳐도 `'original'`이 보존되어 통과는 하지만, 마이그레이션 경로 의존을 없앤다). **선명 모드 describe는 지금 아무것도 시드하지 않고 기본값 `'crisp'`에 기댄다. 기본값이 OS에 따라 달라지므로 `{ htmlRenderMode: 'crisp' }, version: 2` 시드를 더한다.** 이 describe는 `userAgent: WINDOWS_UA`를 쓰는데, UA 문자열을 바꿔도 `navigator.platform`이 같이 바뀌는지는 확인하지 않았다(바뀌지 않는다면 macOS 호스트에서 `"MacIntel"`이라 우연히 통과한다). 시드로 이 의존을 끊는다 |

- 모든 테스트 파일은 `detectPlatform`을 모의하지 않으면 jsdom의 `navigator.platform`(기본 빈 문자열일 가능성이 높으나 run 첫 단계에서 확인)에 따라 `'crisp'`으로 해소된다. 암묵 의존을 피하려고 플랫폼에 민감한 테스트는 모의를 명시한다.

### M6 (Priority Low) — 게이트와 정리

- `npm run typecheck`, `npm run lint`(`--max-warnings 0`), `npx vitest run` 전체, 가능하면 `npx playwright test e2e/html-file-viewer.spec.ts`(webkit 프로젝트).
- `@MX` 태그: `uiStore.ts`의 기존 `@MX:ANCHOR` REASON 줄에 SPEC-PREVIEW-020 언급을 더한다(주석 언어 `code_comments: ko`).
- 수동 M-1~M-4는 sync 전 릴리스 빌드에서 사용자가 수행한다. 결과와 캡처 경로를 `progress.md`에 기록한다.

## 변경 파일

| 파일 | 변경 |
|------|------|
| `src/store/uiStore.ts` | 필드 타입 `\| null`, 초기값 `null`, 정규화·`merge`·`migrate`, persist 버전 2 |
| `src/lib/preview/htmlZoom.ts` | `defaultHtmlRenderMode`, `resolveHtmlRenderMode` 추가 |
| `src/components/layout/Header.tsx` | 해소된 모드로 `aria-pressed`·`is-active`·토글 |
| `src/components/preview/HtmlFileViewer.tsx` | 분기에 해소 호출 |
| 테스트 | M5 표 + `src/test/htmlZoom.test.ts` 케이스 추가 |

소스 4개, 약 60~120 LOC. PRESERVE: `index.html`, `src-tauri/`, 두 뷰 컴포넌트 본문, 토글 `title` 문구, 018 배율 로직.

## 위험 (결정에 대한 정직한 반론 포함)

| # | 위험 | 가능성/영향 | 대응·판단 |
|---|------|-----------|----------|
| R1 | **Windows 원본 보기가 선명하다는 전제가 우리 측정이 아니다.** 사용자 관찰 하나에 기본값 정책 전체가 걸려 있다. WebView2가 `transform: scale` iframe을 다시 래스터하는 것은 엔진 내부 동작이라 조건(GPU 합성 여부, 장치 배율)에 따라 달라질 수 있다 | 중간 / 높음 | M1 관문과 수동 M-1. 실패하면 SPEC 중단. 이 SPEC은 측정 없이 "Windows는 선명하다"를 주장하지 않는다 |
| R2 | **업그레이드 때 Windows 사용자의 명시 `'crisp'` 선택이 한 번 사라진다.** 구별이 불가능하다는 결정의 직접 비용이다. 반론: 보존하는 안(저장된 `'crisp'` 유지)이면 사용자는 아무것도 잃지 않지만 기존 Windows 사용자 전원에게 수정이 효과가 없다 | 낮음 / 낮음 | 수용(spec §5). 사용자 기반이 작고 v0.20.0이 같은 날 나왔다. 사용자가 반대하면 D2를 되돌린다(마이그레이션이 `'crisp'`을 보존하면 REQ-005만 바뀐다) |
| R3 | **Windows 기본이 원본 보기라 보안 자세가 019 이전 수준으로 돌아간다**(`allow-same-origin` + asset iframe). 반론: 019가 일부러 조인 것을 기본값에서 되돌린다 | 중간 / 중간 | 이 SPEC이 새로 넓히는 권한은 없다(004/018 자세 그대로, 사용자가 이미 v0.19 이하에서 쓰던 것). SEC-001(앱 ACL, 완료)이 이 자세에 충분한지는 재평가하지 않았다 → spec §7-4로 사용자에게 넘긴다. 이 위험을 낮다고 단정하지 않는다 |
| R4 | **토글 `title`이 Windows 기본에서 사실과 다르다**(“선명 모드(기본)”, “원본 보기는 흐릿”). 결정 3이 문구 유지를 요구해 알려진 불일치를 일부러 남긴다 | 확실 / 낮음 | 범위 밖으로 기록(spec §6·§7-3). 후속 과제 후보 |
| R5 | `null` 상태가 새 분기를 만든다. `htmlRenderMode`를 읽는 다른 코드가 `=== 'crisp'` 식으로 가정했다면 `null`에서 깨진다 | 낮음 / 중간 | `grep`으로 소비자는 `HtmlFileViewer`·`Header` 두 곳뿐임을 확인했다(`src`, `e2e` 전체 검색에서 테스트 외 소스는 이 둘과 `uiStore`). 추가로 `tsc --noEmit`이 `\| null` 확대로 놓친 소비자를 잡는다 |
| R6 | 롤백(v0.20.0으로 되돌림) 시 v2 저장소가 v1 코드에 읽힌다. `null`은 v1 `merge`가 `'crisp'`으로 정규화하므로 앱은 시작되지만, v1 코드가 저장 버전 2를 어떻게 다루는지(경고·폐기 여부)는 zustand `persist` 의미에 달려 있고 확인하지 않았다 | 낮음 / 낮음 | 미확인으로 남긴다. 확인하려면 v1 코드에 v2 저장소를 심어 보면 된다. 필요하면 run에서 한 번 시험 |
| R7 | e2e 선명 모드 describe가 기본값에 암묵 의존 (M5) | 확실(수정 대상) / 낮음 | 시드 추가로 해결 |
| R8 | 한 번 토글하면 OS 기본값을 다시 따를 수 없다 | 확실 / 낮음 | 의도된 단순화. 되돌리기 UI는 범위 밖 |

## Tier S 확인

- 소스 4개(5개 미만), 소스 약 60~120 LOC(300 미만). REQ 7·AC 8로 Tier S 상한(각 8) 이내다. 이 정도를 넘기지 않도록 새 모듈·훅·UI를 만들지 않았다.
- Tier M이 아닌 이유는 spec §1 참조. 단, 마이그레이션이 사용자 기기의 영구 상태를 바꾸므로 plan-auditor 점검 시 AC-004 표의 빠진 경로가 있는지 우선 봐 주기를 권한다.
