# SPEC-PREVIEW-014 — 수용 기준

> 게이트 = vitest + tsc + eslint. `embedPreviewImages`는 문자열 입력 → 문자열 출력 + IPC 호출이므로 Vitest 단위 테스트로 충분하다. 포인터 상호작용 없음.

## 사전 준비

- **테스트 파일**: `src/test/imageResolver.test.ts` (신규)
- **mock**: `src/test/imageHandler.test.ts:7-46`의 호이스트(`vi.hoisted`) 방식을 따른다. 단, 그 파일의 `@tauri-apps/api/core` mock은 `invoke`만 내보낸다(`:31-33`). `imageResolver.ts:4`가 `convertFileSrc`를 import하므로 신규 테스트의 `@tauri-apps/api/core` mock은 `invoke`와 함께 `convertFileSrc: vi.fn()`도 내보내야 한다. `@/lib/tauri/ipc`는 `readImageAsBase64`를 호이스트된 mock 함수로 대체하고, 경로별로 resolve/reject를 지정.
- **공통 입력**: `mdFilePath = '/docs/a.md'` (Windows 케이스만 `C:\docs\a.md`), HTML은 `<img src="…" alt="x">` 형태.

## 테스트 목록 ↔ 요구사항

| ID | 입력 src | 기대 | REQ |
|----|----------|------|-----|
| T1 (RED 재현) | `figures_svg/%EB%8F%8401_frame.png` | 첫 호출 경로 `/docs/figures_svg/도01_frame.png`, 출력에 data URI | 001 |
| T2 | 같은 src, `mdFilePath = C:\docs\a.md` | 첫 호출 경로 `C:\docs\figures_svg\도01_frame.png` | 001 |
| T3 | `%E0%A4.png` + 같은 문서의 정상 이미지 1개 | 예외 없음, 호출 경로 `/docs/%E0%A4.png` 1회, 다른 이미지는 data URI로 치환 | 003 |
| T4 | `100%25.png` (디스크 파일명 `100%.png`) | 첫 호출 `/docs/100%.png`에서 성공, 호출 1회 | 001, 002 |
| T5 | `a%20b.png` (디코드 경로 reject, 원문 경로 resolve) | 호출 순서 `/docs/a b.png` → `/docs/a%20b.png`, 출력에 data URI | 002 |
| T6 | `%EB%8F%84.png` (두 경로 모두 reject) | 예외 없음, 원래 src 유지, 호출 2회 | 002 |
| T7 | `figures_svg/fig01_frame.png`, `./img/x.png` | 각각 `/docs/figures_svg/fig01_frame.png`, `/docs/img/x.png`로 1회씩만 호출 | 004 |
| T8 | `http://e.com/a.png`, `https://e.com/a.png`, `data:image/png;base64,AA` | 호출 0회, HTML 불변 | 004 |
| T9 | `/abs/x.png` | `/abs/x.png`로 1회 호출(디코드 없음) | 004 |
| T10 | 같은 한글 src가 문서에 2번 | 읽기 성공 1회 후 두 `<img>` 모두 치환 | 004 |
| T11 | `%2E%2E/secret.png` (두 경로 모두 mock reject) | 호출 정확히 2회, 순서 `/docs/../secret.png`(디코드) → `/docs/%2E%2E/secret.png`(원문). 프런트엔드는 `..`를 정리·제거하지 않고 그대로 전달하며 거부는 Rust `validate_path`가 담당. 원래 src 유지 | 005 |

## 시나리오 (Given-When-Then)

### AC-PREVIEW014-01: 한글 상대경로 이미지 표시 — must-pass

- **Given** `mdFilePath`가 `/docs/a.md`이고 HTML에 `<img src="figures_svg/%EB%8F%8401_frame.png">`가 있고, `readImageAsBase64`가 `/docs/figures_svg/도01_frame.png`에 대해 data URI를 돌려줄 때
- **When** `embedPreviewImages(html, mdFilePath)`를 호출하면
- **Then** `readImageAsBase64`의 첫 호출 인자는 `/docs/figures_svg/도01_frame.png`이고, 결과 HTML의 src는 그 data URI다. (T1, T2)

### AC-PREVIEW014-02: 잘못된 퍼센트 시퀀스 — must-pass

- **Given** HTML에 `<img src="%E0%A4.png">`와 정상 ASCII 이미지가 함께 있을 때
- **When** `embedPreviewImages`를 호출하면
- **Then** 프로미스는 reject되지 않고, 잘못된 src는 원문 경로로 한 번 읽히며, 정상 이미지는 data URI로 치환된다. (T3)

### AC-PREVIEW014-03: 원문 경로 대체 — must-pass

- **Given** 디코드 경로 읽기가 실패하고 원문 경로 읽기가 성공할 때
- **When** `embedPreviewImages`를 호출하면
- **Then** 호출은 디코드 경로 → 원문 경로 순서로 정확히 2회이고, 결과 src는 data URI다. 두 경로가 모두 실패하면 원래 src가 남는다. (T4, T5, T6)

### AC-PREVIEW014-04: 회귀 없음 — must-pass

- **Given** ASCII 상대경로, `./` 접두 경로, 절대경로, http(s), data URI src가 있을 때
- **When** `embedPreviewImages`를 호출하면
- **Then** http(s)·data는 호출 0회로 그대로이고, 나머지는 수정 전과 같은 경로로 정확히 1회 호출된다. 같은 src 중복은 한 번만 읽는다. (T7~T10)

### AC-PREVIEW014-05: 경로 검증 유지 — must-pass

- **Given** 디코드 결과가 `..`를 포함하는 src가 있을 때
- **When** `embedPreviewImages`를 호출하면
- **Then** 경로는 정규화 없이 `readImageAsBase64`로 전달되고(Rust `validate_path`가 거부), 실패 시 원래 src가 남는다. (T11)

## 기계 검증 게이트

| 명령 | 기대 |
|------|------|
| `npx vitest run src/test/imageResolver.test.ts` | exit 0, T1~T11 전부 통과 |
| `npx vitest run src/test/usePreview.test.ts` | exit 0 (회귀) |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |

## 수동 수용 (사용자 수행)

- 재현 문서(`figures_svg/도01_frame.png` 등 한글 파일명 이미지를 참조하는 .md)를 앱에서 열고, 미리보기 패널에서 그림이 모두 표시되는지 확인한다. 같은 문서의 ASCII 파일명 버전도 계속 표시되는지 함께 확인한다.

## Definition of Done

- 위 4개 게이트 exit 0 (명령 출력 인용).
- T1이 수정 전 코드에서 실패했음을 run 단계 보고에 기록(재현 우선).
- 변경 파일이 plan.md 변경 표의 2개로 한정.
- 수동 수용 결과를 사용자가 확인.
