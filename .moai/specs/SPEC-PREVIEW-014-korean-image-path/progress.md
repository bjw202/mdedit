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
  - 참고: 폴더명 `preview-013`과 `red.log`의 테스트 제목은 SPEC 번호를 014로 바꾸기 전의 원래 번호(013)를 그대로 담고 있다. 기존 증거 링크가 깨지지 않도록 폴더명은 의도적으로 바꾸지 않았다.

## §E.3 Run-phase Audit-Ready Signal

- 자동 게이트 4종 + 전체 스위트 exit 0 (위 표)
- 미완: 수동 수용(한글 파일명 이미지 문서를 앱 미리보기에서 확인) — 사용자 수행 항목

## §E.4 Sync-phase Audit-Ready Signal

- 상태: **`completed`.** 사용자가 HEAD `a8f754d`로 빌드한 디버그 앱(`src-tauri/target/debug/mdedit`)에서 macOS 수동 수용을 마쳤다고 보고("확인했어")함에 따라 `implemented → completed`로 전이했다. 이 수동 수용은 사용자 보고이며 어떤 에이전트도 직접 관측하지 않았다.
- 이전 상태(이력): `implemented` — 수동 수용 대기 (sync 커밋 `838fb17` 시점)
- 동기화 내용:
  - `CHANGELOG.md` `[Unreleased]` → `### Fixed`에 SPEC-PREVIEW-014 항목 1건 추가 (증상·원인·수정·검증 수치·후속 한계)
  - `spec.md` frontmatter `status: draft` → `status: implemented` (`updated`는 이미 2026-10-07로 오늘 날짜와 같아 변경 없음, 본문 미수정)
  - `README.md`, `.moai/project/*.md`, `docs/*.md`: 비ASCII 경로 이미지 해석과 관련해 사실과 달라진 서술이 없어 변경하지 않음

```yaml
sync_status: completed
sync_base_head: 5c4a173
completion_base_head: a8f754d
manual_acceptance: "macOS 앱 내 확인 — 사용자 보고(\"확인했어\"), 에이전트 미관측"
changelog_entry_position: "[Unreleased] / ### Fixed / 1번째 항목"
b12_self_test_a: "grep -c 'SPEC-PREVIEW-014' CHANGELOG.md → 0 (추가 전, 중복 없음)"
b12_self_test_b: "acceptance.md 고유 AC 5건(AC-PREVIEW014-01~05) ↔ CHANGELOG 항목에 5건 명시"
b12_self_test_c: "항목에 인용한 경로 3개 ls 확인: src/lib/image/imageResolver.ts, src/test/imageResolver.test.ts, src/lib/export/exportHtml.ts"
frontmatter_status_transitions:
  spec.md: "draft → implemented → completed"
```

### 증거 (출처 구분)

| 항목 | 결과 | 출처 |
|------|------|------|
| `npx vitest run src/test/imageResolver.test.ts src/test/usePreview.test.ts` | exit 0, 17 passed | 오케스트레이터 직접 실행 |
| `npm run typecheck` | exit 0 | 오케스트레이터 직접 실행 |
| `npm run lint` | exit 0 | 오케스트레이터 직접 실행 |
| `moai spec lint .moai/specs/SPEC-PREVIEW-014-korean-image-path/spec.md` | exit 0, `✓ No findings — all SPEC documents are valid` | 감사 지적(D3) 반영 재실행 로그 `.moai/state/verify/preview-014-sync/spec-lint.log` + sync-auditor 독립 재실행(exit 0, `.moai/state/verify/preview-014-auditor/spec-lint.log`) |
| RED: 수정 전 `7 failed \| 4 passed (11)` | §E.2 기록 | run 에이전트 보고 (sync-auditor가 `preview-013/red.log`를 읽고 일치 확인) |
| 전체 `npx vitest run` 105 파일 / 1604 테스트 통과 | exit 0 | sync-auditor 독립 재실행으로 관측 (HEAD `838fb17`, `.moai/state/verify/preview-014-auditor/full-vitest.log`) |
| 감사 후 주석 전용 커밋 `8581920` | 동작 변경 없음 | 오케스트레이터 재실행: imageResolver 테스트 11/11, lint exit 0, typecheck exit 0 (`.moai/state/verify/preview-013-orch/v8-comment-fix-test.log`, `v9-lint.log`, `v10-typecheck.log`) |
| macOS 앱 수동 수용 (한글 파일명 이미지 문서 열기, HEAD `a8f754d` 디버그 빌드) | 확인됨("확인했어", 세부 내용 없음) | **사용자 보고** — 에이전트 미관측, 로그·스크린샷 없음 |

### Gaps (미검증)

- macOS 앱 수동 수용: 사용자 보고로만 확인됨 — 어떤 에이전트도 관측하지 않았고 세부 내용(어떤 문서·몇 개 이미지)은 전달되지 않음
- Windows 실기 미검증: Windows 앱에서 실행해 보지 않음
- macOS 외 환경의 NFC/NFD 정규화 동작 미검증
- 커버리지 미측정: vitest 커버리지 제공자가 설치되어 있지 않음
- 전체 스위트(1604/1604)는 sync-auditor가 HEAD `838fb17`에서 재실행해 확인함. 주석 전용 커밋 `8581920` 이후에는 전체 스위트를 다시 돌리지 않음(대상 테스트·lint·typecheck만 재실행)
- 후속 과제(이번 범위 밖): 공백·`&` 포함 파일명, 한글 절대경로, HTML 내보내기 `embedLocalImages`의 동일 결함
