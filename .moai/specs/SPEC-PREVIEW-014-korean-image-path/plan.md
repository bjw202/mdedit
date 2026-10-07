# SPEC-PREVIEW-014 — 구현 계획

> 본 문서는 spec.md(WHAT/WHY)에 대한 HOW를 다룬다. Given-When-Then 수용 시나리오와 테스트 목록은 acceptance.md 참조. 개발 방식은 TDD(재현 테스트 먼저).

## 확정 결정 (Locked Decisions)

| # | 결정 | 내용 | 근거 |
|---|------|------|------|
| D1 | 읽기 순서 = 디코드 우선, 원문 대체 | 디코드 경로 먼저, 실패 시(그리고 경로가 다를 때만) 원문 경로 1회 재시도 | spec.md Design Note. markdown-it이 비ASCII·단독 `%`를 항상 인코딩하므로 디코드 결과가 대부분 정답 |
| D2 | 디코드 함수 = `decodeURIComponent` + try/catch | 실패(`URIError`) 시 원문 src 사용 | 잘못된 시퀀스가 예외로 새지 않게 함(REQ-003) |
| D3 | 적용 범위 = 상대경로만 | `/` 절대경로·http(s)·data는 기존 분기 그대로 | 사용자 확정 범위(REQ-004) |
| D4 | 수정 위치 = `embedPreviewImages` 내부 한 곳 | 경로 조립을 작은 헬퍼로 분리하는 것은 run 단계 재량 | Tier S, 단일 함수 |
| D5 | 경로 검증 = Rust에 일임 | 클라이언트에서 `..` 정규화·존재 확인 없음 | REQ-005, 기존 보안 경계 유지 |

## 마일스톤 (우선순위 순, 시간 추정 없음)

### M1 (Priority High) — 재현 테스트 작성 (RED)

- 신규 파일 `src/test/imageResolver.test.ts` 작성. `embedPreviewImages`를 직접 단위 테스트하는 파일이 현재 없다(`usePreview.test.ts`는 `embedPreviewImages`를 mock한다).
- mock 방식은 `src/test/imageHandler.test.ts:7-46`의 호이스트된 mock 함수 패턴을 따른다. 다만 그 파일의 `vi.mock('@tauri-apps/api/core', …)`는 `invoke`만 내보낸다(`:31-33`). `imageResolver.ts:4`가 `convertFileSrc`를 import하므로 신규 테스트의 core mock은 `invoke`와 함께 `convertFileSrc: vi.fn()`도 내보내야 한다. ipc는 `vi.mock('@/lib/tauri/ipc', () => ({ readImageAsBase64: mockReadImageAsBase64 }))`.
- acceptance.md의 T1(한글 디코드)이 현재 코드에서 실패하는 것을 확인한다.

### M2 (Priority High) — 수정 (GREEN)

- `embedPreviewImages`에서 상대경로 분기에 한해: 디코드 시도 → 디코드 경로로 읽기 → 실패하고 경로가 다르면 원문 경로로 읽기 → 둘 다 실패하면 원래 src 유지.
- HTML 치환과 `resolved` 캐시 키는 원문 src 그대로.
- T1~T11 전부 통과.

### M3 (Priority Medium) — 정리·게이트

- `npm run typecheck`, `npm run lint` 통과. 기존 `usePreview.test.ts` 회귀 확인.
- @MX 태그: `embedPreviewImages`에 `@MX:NOTE`로 "markdown-it이 src를 퍼센트 인코딩하므로 디코드 후 읽고 원문으로 대체" 사유를 남긴다(주석 언어는 `code_comments: ko`).

## 위험

| 위험 | 대응 |
|------|------|
| 디코드 경로 실패 시 IPC 호출이 2회로 늘어남 | 디코드 결과가 원문과 같을 때(ASCII)는 재시도하지 않음. 비ASCII 실패 문서에서만 1회 추가 |
| `%2F` 등이 디코드되어 `/`가 됨 | 기존 구분자 치환에 그대로 합류. `..`는 Rust `validate_path`가 거부(T11) |
| Windows 경로 구분자 | 디코드 후 기존 `/`→`\` 치환 유지(T2) |

## 변경 파일

| 파일 | 변경 |
|------|------|
| `src/lib/image/imageResolver.ts` | `embedPreviewImages` 상대경로 분기 수정 |
| `src/test/imageResolver.test.ts` | 신규 단위 테스트 |
