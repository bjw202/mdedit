# SPEC-PREVIEW-014 — Progress

## §E.1 Plan-phase Audit-Ready Signal

- plan 산출물: spec.md, plan.md, acceptance.md, progress.md (status: draft)
- SPEC ID 정규식 검사: `SPEC-PREVIEW-014` PASS

## §E.2 Run-phase Evidence

- cycle_type: tdd (RED → GREEN, REFACTOR 생략 — 중복 제거 대상 없음)
- 기준 HEAD: `a19e1c8` (branch `worktree-preview-korean-img`)
- 변경 파일: `src/lib/image/imageResolver.ts` (`embedPreviewImages` 상대경로 분기), `src/test/imageResolver.test.ts` (신규, T1~T11)

### RED (수정 전 코드)

`npx vitest run src/test/imageResolver.test.ts` → exit 1, `Tests  7 failed | 4 passed (11)`

- 실패: T1, T2, T4, T5, T6, T10, T11 — 모두 `readImageAsBase64`가 인코딩된 경로로 호출된 것이 원인
  - T1: `Expected: "/docs/figures_svg/도01_frame.png"` / `Received: "/docs/figures_svg/%EB%8F%8401_frame.png"`
  - T5: `expected [ '/docs/a%20b.png' ] to deeply equal [ '/docs/a b.png', '/docs/a%20b.png' ]`
  - T11: `expected [ '/docs/%2E%2E/secret.png' ] to deeply equal [ '/docs/../secret.png', …(1) ]`
- 통과: T3, T7, T8, T9 — 디코드와 무관한 회귀 가드라 수정 전에도 통과하는 것이 정상

### GREEN / 게이트 (수정 후)

| 명령 | exit | 결과 |
|------|------|------|
| `npx vitest run src/test/imageResolver.test.ts` | 0 | `Tests  11 passed (11)` |
| `npx vitest run src/test/usePreview.test.ts` | 0 | `Tests  6 passed (6)` |
| `npm run typecheck` | 0 | `tsc --noEmit` 오류 없음 |
| `npm run lint` | 0 | `--max-warnings 0` 통과 |
| `npx vitest run` | 0 | `Test Files  105 passed (105)`, `Tests  1604 passed (1604)` |

- 커버리지: 저장소에 vitest 커버리지 제공자가 설치되어 있지 않아 측정하지 않음
- 원본 로그: `.moai/state/verify/preview-013/` (red.log, green.log, usePreview.log, typecheck.log, lint.log, full.log — 커밋 대상 아님)

## §E.3 Run-phase Audit-Ready Signal

- 자동 게이트 4종 + 전체 스위트 exit 0 (위 표)
- 미완: 수동 수용(한글 파일명 이미지 문서를 앱 미리보기에서 확인) — 사용자 수행 항목

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
