# SPEC-EXPORT-004 — Progress

## §E.1 Plan-phase Audit-Ready Signal

- 작성일: 2026-10-26
- plan 산출물: spec.md, plan.md, acceptance.md, progress.md (status: draft, Tier M)
- SPEC ID 정규식 검사: `SPEC-EXPORT-004` → `PASS` (Bash 실행 결과)
- 기준 HEAD: `6a322d6` (main)

### 사용자 확정 결정 (2026-10-26, 오케스트레이터가 수집)

1. SPEC을 둘로 나눈다. 이 SPEC(이미지 내보내기)이 먼저이며, 다이어그램 렌더러 관련 SPEC은 범위 밖이다.
2. `../` 상위 폴더 이미지는 제한적으로 허용한다. 마크다운 파일 디렉터리와 상대경로를 이어 정규화·실제 경로 해석을 한 뒤 이미지 확장자(png, jpg, jpeg, gif, webp, svg, bmp)만 읽는 새 Rust 명령을 둔다. 다른 명령의 `validate_path`는 약화하지 않는다. 미리보기와 내보내기 모두에 적용한다.
3. "이미지를 옆 폴더로 내보내기" 옵션은 이번에 제외한다(base64 임베드 유지). 비목표·후속 과제로 기록.
4. 임베드 실패를 사용자에게 보고한다(기존 SPEC-EXPORT-002 완료 모달에 "이미지 N개를 포함하지 못했습니다" + 파일 이름).

### plan-phase 메모

- 원인 3가지(옛 복사본 해석기, `validate_path`의 `..` 일괄 거부, `catch {}` 삼킴)는 오케스트레이터가 2026-10-26 코드 읽기와 markdown-it 실행으로 확인했다. manager-spec이 markdown-it 14 출력을 다시 실행해 같은 결과를 확인했고, 추가로 DOCX가 읽는 토큰 `src`는 `&`를 이스케이프하지 않는다(`images/a&b.png`)는 점을 확인했다 → 엔티티 디코드는 렌더 HTML 출처에만 적용(spec REQ-003).
- `ExportCompletionDialog` 컴포넌트는 따로 없다. 완료 모달은 `AppLayout.tsx:484-500`에서 `ConfirmDialog`로 렌더된다. `exportOpenRegressionGuard.test.ts`가 별도 완료 다이얼로그 컴포넌트를 금지하므로 본문 확장은 `AppLayout` 안에서 한다(plan D5).
- 반환 계약 결정: `exportToHtml`·`exportToDocx`의 `Promise<string | null>`을 유지하고 누락 목록은 `ExportOptions`의 선택적 콜백으로 전달한다(plan D4). SPEC-EXPORT-002 테스트 12건과 `exportToDocx` `@MX:ANCHOR` 불변식을 건드리지 않는 가장 작은 변경.
- PDF에는 완료 모달이 없으므로 인쇄 대화상자 직전에 앱 내 `ConfirmDialog`로 알린다(plan D6, 아래 결정 2).
- 새 Rust 명령 추가로 `exportOpenRegressionGuard.test.ts:69-95` 등록 명령 기준선 배열에 1줄 추가가 필요하다(기존 SPEC-IMG-LOAD-001·SPEC-FS-004 선례와 같은 방식).
- SPEC-PREVIEW-014 T11 기대 호출은 의도적으로 개정된다(디코드 결과의 `..` → 전용 명령).

### 미결 질문 해소 — 사용자 결정 (2026-10-26, 오케스트레이터가 수집)

1. **SPEC 번호 = SPEC-EXPORT-004.** SPEC-EXPORT-002(spec.md:16·52·351·390, plan.md:21·205·222)가 `SPEC-EXPORT-003`을 "PDF 완료 모달" 후속 SPEC으로 예약해 두었으므로 그 예약을 그대로 두고 004를 쓴다. 디렉터리를 `SPEC-EXPORT-003-export-image-path` → `SPEC-EXPORT-004-export-image-path`로 옮기고 4개 파일의 ID 표기를 모두 바꿨다. SPEC-EXPORT-002는 수정하지 않았다.
2. **PDF 누락 알림 = 앱 내 `ConfirmDialog`**(HTML·DOCX와 같은 컴포넌트·문구 형식). 인쇄 대화상자 전에 열고, `계속 인쇄`를 고르면 인쇄를 진행한다. 누락이 없으면 지금과 같다. `window.alert`는 쓰지 않는다. 이유: Tauri WKWebView에서 `alert` 동작이 검증되지 않았고, `exportPdf.ts:22` 주석이 같은 WebView에서 `window.print()`가 동작하지 않는다고 적고 있다. 취소(`취소`·Escape·백드롭)는 인쇄하지 않는 것으로 정했다 — "확인하면 인쇄를 계속한다"는 결정에서 도출한 해석이며 `ConfirmDialog`가 `cancel` 액션을 필수로 요구하기 때문이다(plan D6).
3. **전용 명령 대상 = 디코드 결과에 `..`가 있는 상대경로만**(plan D2 유지).
   - 참고: plan-audit iteration 1 이후 오케스트레이터가 이 결정을 "읽기 후보마다 `/`·`\` 기준 `..` 조각을 판정"으로 구체화했다(원문 대체 후보 포함). 사용자가 직접 정한 내용은 아니다(plan D2).
4. **읽기 범위 = 루트 제한 없음, 이미지 확장자 제한만**(기존안 유지).

남은 미결 질문: 없음.

### plan-audit iteration 1 대응 (2026-10-26)

- 감사 결과: FAIL 0.75(Tier M 기준 0.80), 보고서 `.moai/reports/plan-audit/SPEC-EXPORT-004-iter1.md`. 결함 D1–D14(blocking 8, optional 6).
- 대응: 14건 모두 반영해 spec.md를 0.1.2로 올렸다. 오케스트레이터가 정한 기술 결정을 그대로 적용했다.
  - 테스트 배치(D1·D2·D3): 실제 renderer·markdown-it + ipc mock만 쓰는 신규 `src/test/exportImageEmbed.test.ts`. PDF 실제 흐름은 `exportPdf.test.ts`의 새 describe(PF1~PF3), 다이얼로그→Promise 배선은 `ExportCompletionDialog.test.tsx`(F5·F9). `exportHtml.test.ts`·`exportDocx.test.ts`는 무수정.
  - PDF 확인 대기 위치(D4): `generateHtmlContent` 직후, 제목·요소·리스너·타이머 변경 전. PF1·PF2가 제목 불변·리스너/타이머 미등록을 단언.
  - DOCX Mermaid(D5): canvas·toBlob 스텁으로 jsdom에서 실제 캡처를 검증하는 DM1 추가(수정 전에도 통과하는 회귀 가드).
  - 이중 디코드 판별(D6): E1 `![](a\&amp;b.png)` → HTML·DOCX 모두 `/docs/a&amp;b.png`.
  - 후보별 라우팅(D7): `/`·`\` 두 구분자로 나눠 `..` 조각이 있는 후보만 전용 명령. V3에 원문 대체 후보와 `\` 경우 포함.
  - 미저장 문서(D8): 절대경로 이미지는 계속 임베드, 상대경로만 누락. F3에 절대경로 케이스 추가.
  - Rust 경계(D9·D10): `Prefix`·`RootDir` 구성요소 거부, canonicalize → 한 번 열기 → 핸들 메타데이터 `is_file()` → 같은 핸들 읽기. Windows CI 부재와 수동 Windows `cargo test`, 하드링크·TOCTOU 잔여 위험 기록.
  - 누락 정의(D11), `env::temp_dir()` 표기(D12), `ExportOptions` 2필드(D13), PDF 이름 전달 경로(D14: `exportToPdf`가 수집 콜백을 `generateHtmlContent`에 넘김, 공개 반환 타입 무변경).
- 개수: REQ 12건, AC 9건(Tier M 상한 16 이내). 테스트 행은 늘었지만 AC 시나리오 수는 그대로다.
- 다음 단계: plan-audit iteration 2.

### plan-audit iteration 2 대응 (2026-10-26)

- 감사 결과: FAIL 0.875, 보고서 `.moai/reports/plan-audit/SPEC-EXPORT-004-iter2.md`. 새 결함 N1–N7(blocking 3: N1·N2·N3).
- **사용자 결정 (N3, 2026-10-26)**: iteration 1에서 넣었던 "미저장 문서의 절대경로 이미지 임베드"(plan D8)를 **되돌린다**. 미저장 문서는 상대·절대 어떤 로컬 이미지도 읽지 않고, 모두 누락으로 보고한다. DOCX의 `mdFilePath &&` 조건은 유지한다.
  - 이유: `read_image_as_base64`에는 확장자 검사가 없어 디스크의 임의 파일을 `application/octet-stream`으로 읽는다. 미저장 문서에 붙여 넣은 `![](/Users/me/.ssh/id_rsa)` 같은 절대경로가 공유용 HTML에 그대로 임베드될 수 있다. 되돌리면 현재 main 동작과 미리보기 동작이 유지되어 N1(REQ-001 동일성 모순)도 함께 해소된다.
- 그 밖의 대응: N2 전용 명령의 열기 전 `metadata().is_file()` 확인 + 핸들 재확인, S9(FIFO `x.png`, unix)·S10(디렉터리 `d.png`) 추가. N4 D2 출처를 오케스트레이터 구체화로 정정(위 결정 #3 참고 문구 포함). N5 plan 변경 표의 `D6` → `E1`. N6 `exportImageEmbed.test.ts`의 `afterEach` DOM·스텁 정리 명시. N7 F7에 HTML 경로 추가.
- 개수: REQ 12건, AC 9건(변동 없음). spec.md 0.1.3.
- 다음 단계: plan-audit iteration 3(N1–N7 변경분 확인).

### plan-audit iteration 3 결과 (2026-10-26)

- 감사 결과: **PASS-WITH-DEBT 0.94**, 보고서 `.moai/reports/plan-audit/SPEC-EXPORT-004-iter3.md`. 남은 2건을 run 전에 반영했다: N8 S9 시간 제한 가드(별도 스레드 + `recv_timeout(5초)` + 쓰기 열기로 해제 + 고정 panic 문구), N9 건너뛰기 고정 문구 `S9 SKIPPED: mkfifo unavailable`(acceptance.md S9 행, plan.md M2).
- `status: draft` 유지 — `draft → in-progress` 전이는 run 단계(manager-develop) 소유.

- plan_complete_at: 2026-10-26T14:33:16+09:00
- plan_status: audit-ready

## §E.2 Run-phase Evidence

- 실행: manager-develop(cycle_type=tdd), 2026-10-26, 워크트리 `.claude/worktrees/export-004`, 브랜치 `WT-export-image-path`(기준 `6a322d6`).
- 상세 출력 보관 위치(워크트리 안): `.moai/state/verify/spec-export-004/` — `red-vitest.txt`, `red-embed-verbose.txt`, `red-cargo.txt`, `s9-mutation.txt`, `m2-cargo.txt`, `final-vitest-full.txt`, `final-tsc.txt`, `final-lint.txt`, `final-cargo-test.txt`, `final-clippy.txt`.

### RED (구현 전, 커밋 `47cbfc4` 시점)

- 명령: `npx vitest run src/test/exportImageEmbed.test.ts src/test/imageResolver.test.ts src/test/exportPdf.test.ts src/test/ExportCompletionDialog.test.tsx` → exit 1, `Tests  32 failed | 30 passed (62)`.
- 실패(수정 전 코드): H1~H5, X1·X2·X4·X5, E1(HTML), P1, F3(HTML·DOCX), F7(HTML·DOCX), F10, T11(개정), V1·V2·V3a·V3b, PF1~PF3, F1·F1(DOCX)·F2(연속)·F4·F5·F9×3.
  - 대표 실패 출력: H1 `expected '/docs/images/%EC%82%AC%EC%A7%84.png' to be '/docs/images/사진.png'`, E1(HTML) `expected '/docs/a&amp;amp;b.png' to be '/docs/a&amp;b.png'`, H4 `expected "spy" to be called 1 times, but got 0 times`, F1 `Unable to find an element by: [data-testid="unembedded-images"]`.
- 수정 전에도 통과(설계상 기대): X3, E1(DOCX), DM1. 추가로 F6·R5도 통과(기존 동작 회귀 가드)와 기존 T1~T10·AC-001~012·exportPdf 3건.
- Rust: `cargo test --manifest-path src-tauri/Cargo.toml --lib image_ops` → exit 101, ``error[E0425]: cannot find function `read_relative_image_as_base64` in this scope``(S1~S10 컴파일 실패 = RED).

### GREEN·검증 (최종 HEAD 기준)

| 명령 | exit | 출력 꼬리 |
|------|------|-----------|
| `npx vitest run` | 0 | `Test Files  106 passed (106)` / `Tests  1641 passed (1641)` |
| `npx tsc --noEmit` | 0 | (출력 없음) |
| `npm run lint` | 0 | `eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0` (경고 0) |
| `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture` | 0 | `test result: ok. 367 passed; 0 failed` / `S9 RUNNING: fifo at …/spec_export004_s9/assets/x.png` / `S9 SKIPPED` 문구 0회 |
| `cargo clippy --manifest-path src-tauri/Cargo.toml` | 0 | 경고·오류 0 |

- S9 시간 제한 가드 실효성 확인(뮤테이션): 열기 전 `is_file()` 검사를 임시로 제거하고 `cargo test … s9_ -- --nocapture` 실행 → exit 101, `S9 timed out — implementation opened FIFO before type check`, `finished in 5.01s`(멈추지 않음). 확인 후 원본 복원(복원 뒤 `cargo test` 전체 통과).

### AC 상태

| AC | 상태 | 근거 테스트 |
|----|------|-------------|
| AC-01 | PASS | H1~H3, X1~X3, E1(HTML·DOCX), P1, V1 |
| AC-02 | PASS | H4, X4, V2, V3a, V3b, T11(R2) |
| AC-03 | PASS | H5, X5 |
| AC-04 | PASS | F1, F1(DOCX), F4, F7(HTML·DOCX), F10, F3(HTML·DOCX) |
| AC-05 | PASS | PF1, PF2, F5, F9(취소·Escape·백드롭) |
| AC-06 | PASS | F2, F2(연속), F6, PF3, 기존 AC-001~012·exportPdf 3건 무수정 통과(F8) |
| AC-07 | PASS (unix) | S1~S7, S9, S10, 기존 image_ops·file_ops 테스트 무수정 통과(S8), R6 |
| AC-08 | PASS | R1(T1~T10), R3(exportHtml.test.ts 무수정), R4(exportDocx.test.ts 무수정), R5, DM1 |
| AC-09 | 미검증(수동) | 사용자 수행 항목 |

### 설계와의 차이(run 단계 결정)

- 테스트 F3·F7·F10의 `[alt]` 폴백 단언은 폴백 **개수**로 바꿨다. markdown-it 이미지 토큰의 `alt` 속성은 빈 문자열이고 대체 텍스트는 children에 있어, 기존 코드의 폴백은 실제로 `[]`를 만든다(수정 전부터의 동작, 이번 SPEC 범위 밖). 폴백 동작 자체는 유지했다.
- DOCX 이미지 분기의 `mdFilePath &&` 조건은 공용 `readLocalImage`로 옮겼다(미저장 문서면 읽기 IPC 0회 + 누락 반환). 동작은 같고 F3(DOCX)가 고정한다.
- 테스트 F2(연속)·F1(DOCX)를 추가로 넣었다(단일 슬롯에서 이전 누락 목록이 남지 않음, DOCX 배선).

### sync-audit 대응 (PASS-WITH-DEBT, `.moai/reports/sync-audit/SPEC-EXPORT-004.md`)

- **F1 (치환 패턴 버그)**: `embedImagesInHtml`이 `result.replace(full, <문자열>)`로 태그를 바꿔, alt의 `$'`·`$&`·`` $` ``·`$$`가 치환 패턴으로 해석됐다. 재현 테스트 `F1-$'`·`F1-$&`·``F1-$` ``·`F1-$$`·`F1-$1`(대조군)을 `exportImageEmbed.test.ts`에 먼저 넣었다.
  - RED(수정 전): `npx vitest run src/test/exportImageEmbed.test.ts -t "F1-"` → exit 1, `Tests  4 failed | 1 passed | 21 skipped (26)`, 예: ``expected '<!DOCTYPE html>…' to contain 'alt="cost $' tail"'``. `$1`은 문자열 패턴이라 원래도 그대로 남는다(대조군 통과).
  - 수정: 함수 치환자 `result.replace(full, () => tag)`. 공용 해석기·export 모듈의 다른 `.replace(` 호출은 모두 정규식·고정 문자열이거나 치환값이 `/`·`\`뿐이라 해당 없음.
  - GREEN: `npx vitest run src/test/exportImageEmbed.test.ts src/test/imageResolver.test.ts` → exit 0, `Tests  41 passed (41)`.
- **F5 (언마운트 시 대기 Promise)**: `AppLayout`에 언마운트 정리(`useEffect` cleanup)를 두어 대기 중인 PDF 확인 Promise를 `false`로 끝낸다. 테스트 `F5-unmount`(`ExportCompletionDialog.test.tsx`)는 정리를 뺀 상태에서 `expected undefined to be false`로 실패하고, 넣은 상태에서 통과함을 확인했다.
- **F6 (plan D8 문서 차이)**: plan D8은 DOCX 이미지 분기의 `mdFilePath &&` 조건을 남긴다고 적었지만, run 단계에서 이 조건을 공용 `readLocalImage`로 옮겼다. `readLocalImage`는 `mdFilePath`가 `null`이면 읽기 IPC를 하나도 호출하지 않고 `dataUri: null`(누락)을 돌려주므로 동작은 같다. 테스트 F3(DOCX)가 읽기 0회·`[alt]` 폴백 3개·누락 이름 3개를 고정한다. 조건은 복원하지 않는다.
- **F7 (rustfmt)**: `rustfmt --edition 2021 src-tauri/src/commands/image_ops.rs` 결과 중 SPEC-EXPORT-004 테스트 두 곳(S1 `assert_eq!`, S4 배열)만 반영했다. 기존 코드 6곳(64·117·133·251·306·345행 근처)의 서식 차이는 이 SPEC과 무관해 되돌렸다.

### 커밋

- `3d32c0b` docs(spec): SPEC-EXPORT-004 계획 산출물 추가 및 in-progress 전이
- `47cbfc4` test(export): 재현 테스트 추가 (RED)
- `11c93fd` feat(image): 상위 폴더 이미지 전용 읽기 명령 추가
- `2fbdfce` fix(export): 공용 이미지 경로 해석기로 HTML·PDF·DOCX 이미지 누락 수정
- `9c02117` feat(export): 누락 이미지 보고 UI 추가
- (이 기록 커밋) docs(spec): run 단계 증거 기록

## §E.3 Run-phase Audit-Ready Signal

- run_status: audit-ready (기계 게이트 5종 exit 0)
- 남은 검증: AC-09 수동 확인, Windows 실기 `cargo test` 1회(S4 Windows 케이스·심볼릭 링크·명명된 파이프)
- run_complete_at: 2026-10-26

## §F Phase 4 Mode Selection

- Decision: serial
- 근거: 단일 구현 에이전트(manager-develop). Tier M, 코딩 중심, 도메인 2개(TypeScript + Rust). 같은 파일(`imageResolver.ts`, export 모듈)을 마일스톤이 이어서 고치므로 병렬 이득이 없다.

## §E.4 Sync-phase Audit-Ready Signal

- 실행: manager-docs, 2026-10-26, 워크트리 `.claude/worktrees/export-004`, 브랜치 `WT-export-image-path`(push·PR 없음 — 오케스트레이터 지시).
- 동기화 산출물: `CHANGELOG.md` `[Unreleased]`(`### Fixed` 1건 + `### Added` 1건), `docs/USER_GUIDE.md` §2.6, `docs/USER_MANUAL.md` §6(5-2) 이미지 안내 1단락씩.
- 검증 수치 출처: §E.2 표(vitest 1641/1641·106 파일, cargo test 367, tsc·eslint·clippy exit 0). 오케스트레이터가 같은 값을 독립 측정했다고 전달. sync 단계에서 테스트를 다시 실행하지 않았다(문서·frontmatter만 변경).
- MX 태그 검증(sync 하위 단계): `readLocalImage`(`imageResolver.ts:98`)와 `read_relative_image_as_base64`(`image_ops.rs:172`)에 `@MX:ANCHOR`+`@MX:REASON`, `@MX:WARN`은 모두 `@MX:REASON` 동반. 추가·수정한 태그 없음.

```yaml
sync_complete_at: 2026-10-26
sync_commit_sha: pending-backfill-sync
sync_status: audit-ready
b12_self_test_a: "grep -c 'SPEC-EXPORT-004' CHANGELOG.md → 0 (작성 전) — PASS"
b12_self_test_b: "acceptance.md 고유 AC 토큰 12개 중 이 SPEC의 AC는 AC-EXPORT004-01~09 9건(나머지 AC-001·AC-011은 SPEC-EXPORT-002 참조, AC-09는 약칭). CHANGELOG는 9건(자동 8 + 수동 AC-EXPORT004-09) 언급 — PASS"
b12_self_test_c: "CHANGELOG 언급 경로 src/lib/image/imageResolver.ts, src-tauri/src/commands/image_ops.rs, src/components/layout/AppLayout.tsx 존재 확인 — PASS"
changelog_entry_position: "[Unreleased] 최상단 (### Fixed → ### Added)"
frontmatter_status_transitions:
  spec.md: "in-progress → completed (updated: 2026-10-26)"
  plan.md: "frontmatter 없음 — 변경 없음"
  acceptance.md: "frontmatter 없음 — 변경 없음"
  progress.md: "frontmatter 없음 — 변경 없음"
remaining_manual:
  - "AC-EXPORT004-09 실제 앱 수동 확인"
  - "Windows 실기 cargo test 1회 (S4 Windows 케이스·심볼릭 링크·명명된 파이프)"
known_limitation: "DOCX 이미지 폴백이 [alt] 대신 [] 출력 — markdown-it 대체 텍스트가 token children에 있음, 기존 동작·범위 밖"
```
