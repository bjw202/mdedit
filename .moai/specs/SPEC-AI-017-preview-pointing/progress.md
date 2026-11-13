# SPEC-AI-017 진행 기록

## §E.1 Plan-phase Audit-Ready Signal

- plan_status: audit-ready
- plan_complete_at: 2026-11-13 (plan-auditor 3회 상한 도달 — 3차 FAIL 0.90, 감사자 권고 PASS-with-debt. 3차 지적 R1~R5 는 v0.2.2 에서 문구로 반영했고 재감사는 하지 않았다. 판정 수용 여부는 구현 승인 단계에서 사용자가 정한다)
- 작업 위치: `.claude/worktrees/t9`, 브랜치 `WT-preview-pointing`(origin/main 1f3d4a5 기준), 카드 t9
- 산출물: spec.md, plan.md, acceptance.md, spike/(스크립트 3개·결과 3개·폐기 결과 1개·실측 캡처·jsdom 확인 파일과 출력)
- 계획 단계 실측: spec.md 「실측 기록」 S1~S5 (claude 2.1.323, codex-cli 0.167.0, pele 1.10.0, macOS)

### plan-auditor 회차 기록

| 회차 | 판정 | 점수 | 보고서 | 반영 |
|------|------|------|--------|------|
| 1 | FAIL | 0.80 | `.moai/reports/plan-audit/SPEC-AI-017-review-1.md`(로컬) | v0.2.0 — 막힘 1(요청 중 편집 동작 오기재) + 고칠 것 9 + 경미 다수 반영. 스파이크 S1 수치를 한 스크립트로 다시 셈 |
| 2 | FAIL | 0.86 | `.moai/reports/plan-audit/SPEC-AI-017-review-2.md`(로컬) | v0.2.1 — 1차 결함 19/20 해결 확인. 새 막힘 3(순번 파서 불일치 N1, 보내기 시점 AI 판정 N2, 강조 복원 AC 누락 N3) + 고칠 것 1(카드 표 이미지·링크 N4) + 경미 5 반영 |
| 3 | FAIL (감사자 권고: PASS-with-debt) | 0.90 | `.moai/reports/plan-audit/SPEC-AI-017-review-3.md`(로컬) | N1~N3 해결 확인. 남은 막힘급 R1(다이어그램 일치 확인이 문자 참조 든 라벨을 막음, 안전한 쪽 실패) — 상한 도달로 재감사 없이 v0.2.2 에서 문구 수정. R2~R5 도 v0.2.2 에서 반영(재감사 없음) |

## spike/ 안내

| 파일 | 내용 | 다시 돌리기 |
|------|------|-------------|
| `targeting-rate.mjs` → `targeting-rate.json` | S1·S2 — 표 행·열 / 다이어그램 노드 ID 의 소스 대응률 | `node .moai/specs/SPEC-AI-017-preview-pointing/spike/targeting-rate.mjs .` (저장소 루트에서) |
| `block-length.json` | (폐기) 옛 길이 집계 — 다른 문서 묶음이라 쓰지 않는다. 같은 값은 `targeting-rate.json` `table.topLevel*` 에 있다 | — |
| `sanitize-data-id.test.ts.txt` → `sanitize-data-id.out.txt` | S3 — `renderDiagram`(정화 포함) 뒤 `data-id`·`closest` (jsdom). 정규 테스트에 섞이지 않게 `.txt` 로 보관 | `.ts` 로 복사한 뒤 `npx vitest run <경로>` |
| `cli-roundtrip.mjs` → `cli-roundtrip.json`, `captures/` | S5 — 정본 문구로 claude haiku·codex 기본 모델 표 1건·다이어그램 1건 | `node …/cli-roundtrip.mjs <임시 폴더>` |
| `haiku-diagram-repeat.mjs` → `haiku-diagram-repeat.json` | S5 — 초안 vs 개정 문구, haiku 다이어그램 3회씩. **주의**: 이 스크립트는 `captures/diagram-node.*.txt` 를 초안으로 읽어 개정 문장을 끼워 넣는다. 정본 문구로 다시 잰 뒤 그 파일들이 개정본으로 바뀌었으므로, 지금 다시 돌리면 두 변형이 같아진다(기록된 JSON 은 바뀌기 전 실행 결과) | — |
| `captures/diagram-node.claude-haiku.draft-run0-unchanged.out.txt` | S5 — 초안 문구 1회차에 haiku 가 원본을 그대로 돌려준 실제 응답 | — |

## §E.2 Run-phase Evidence

### 진행 기준 (run 시작, 2026-11-13)

- 사용자 승인: 구현 킥오프 승인 완료(D1~D17 원문 그대로, ⌥+클릭·분할 보기만). plan-auditor 3차 FAIL 0.90 은 PASS-with-debt 로 수용됨. v0.2.2 의 R1~R5 는 재감사되지 않았으므로 run 제약으로 다룸(R1 먼저 RED, R2/D17 비활성 문서 파싱).
- origin/main 병합: `git fetch origin main` + `git merge --no-ff origin/main` — 문서 3개(SPEC-AI-012/014/015 spec.md)만 바뀜, 충돌 없음.
- 구현 방식: 코디네이터 지시에 따라 `manager-develop` 대신 `general-purpose` 에이전트에 manager-develop 역할 지시를 주어 순차 실행(`isolation: "worktree"` 금지, 작업 경로 명시).

### M1 — 실제 브라우저 클릭 확인 (webkit)

- 명령: `npx playwright test e2e/preview-pointing.spec.ts --retries=0`
- 결과(원문 일부):
  ```
  M1 node hits: ["text|C|alt=true","polygon|C|alt=true"]
  M1 selection after alt+click: ""
  2 passed (9.5s)
  ```
- 해석: flowchart 노드 `C` 의 글자(`text`)와 도형(`polygon`) 위 ⌥+클릭 모두 `closest('g.pele-node[data-id]')` 가 `C` 를 돌려줬다. 표 칸 ⌥+클릭은 텍스트 선택을 만들지 않았다(기본 동작을 막지 않은 상태에서도 선택 문자열이 빈 값). **설계 전제 유지 — STOP 조건 아님.** sequence 노드는 e2e 가 아니라 AC-003 vitest(jsdom)에서만 확인한다(gap).
- 픽스처 복사: `spike/captures/{table-column,diagram-node}.{system,user}.txt` → `src-tauri/tests/fixtures/point-{table,diagram}-{system,user}.txt` (4개).

### 커밋 (브랜치 WT-preview-pointing, 푸시 안 함)

| 마일스톤 | 커밋 | 내용 |
|---|---|---|
| 병합 | 32afd36 | origin/main 병합(문서 3개) |
| M1 | a1b913b | webkit 클릭 확인 + 픽스처 4개 |
| M2 | eb31086 | Rust 가리키기 프롬프트·`pointer` 인자 |
| M3 | 0565c29 | 파서 공용화·`splitRow`·`pointTarget.ts` |
| M4a | e2cac81 | 카드 검증·묶음 예산·표 렌더(D17)·적용 |
| M4b | d67b9e3 | ⌥ 강조·⌥+클릭·입력창·요청·정리 |
| M5 | b123bc1 | Playwright AC-014 8단계 |

### 최종 게이트 (오케스트레이션 세션이 직접 실행, 이 트리 기준)

원문 출력은 `.moai/state/verify/run-t9/`(로컬)에 있다.

| 명령 | 종료 코드 | 관찰 출력 |
|---|---|---|
| `npm run typecheck` | 0 | `tsc --noEmit` 출력 없음 |
| `npm run lint` | 0 | `eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0` 출력 없음 |
| `npx vitest run --dir src` | 0 | `Test Files  129 passed (129)` / `Tests  2262 passed (2262)` |
| `npx playwright test e2e/preview-pointing.spec.ts --retries=0` | 0 | `11 passed (23.6s)` (M1 2개 + AC-014 9개) |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 0 | `461 passed; 0 failed`(lib), `3 passed`(app_acl), `8 passed`(asset_charset) |

워커가 보고한 이웃 스펙 회귀: `npx playwright test e2e/ai-toggle.spec.ts e2e/ai-inline-edit.spec.ts e2e/diagram-preview-behavior.spec.ts --retries=0` → 14 passed, exit 0 (M5 에이전트 실행 보고, 이 세션이 다시 돌리지는 않음).

### RED 증거 요약 (각 에이전트 보고)

- R1(문자 참조 라벨 `&amp;`·`&lt;`·`&copy`): `expected 'none' to be 'node'` 로 먼저 실패 확인, `previewDiagramInput` 기준 구현 뒤 통과. 임시로 원문 비교로 되돌리면 다시 실패함도 확인.
- M2: `error[E0599]: no variant or associated item named 'PointTable' found for enum 'ai::prompt::AiFeature'` 등 컴파일 실패 → 구현 후 `17 passed`.
- M4a: 그룹 1~5 각각 RED 출력 있음(예: `expected 'streaming' to be 'error'`, `sanitizeTableHtml is not a function`).
- M4b: 그룹 1·2 는 모듈 부재 RED, 그룹 3~5 는 한 파일에서 21개 실패(5개는 부정형 테스트라 처음부터 통과) — 그룹별로 따로 RED 를 내지는 않음.

### REQ/AC 상태

| AC | 상태 | 근거 |
|---|---|---|
| AC-001 보이는 조건 | 통과(자동) | `isPointingActive` + 보내기 시점 재판정 테스트(vitest) |
| AC-002 대상 판정 | 통과(자동) | `pointTarget.test.ts` (실제 `renderMarkdown`/`renderDiagram`) |
| AC-003 노드 마크업 | 통과(자동) | S3 샘플 6종 + sequence 중복 ID |
| AC-004 순번 블록 | 통과(자동) | 인라인 svg·공백 펜스·`$$`·일치 확인 4종·R1 포함 |
| AC-005 낡음/복원 | 통과(자동+e2e) | vitest + 5단계 e2e |
| AC-006 대상 정보 | 통과(자동) | 열·칸·노드·짧은 행 |
| AC-007 정리 | 통과(자동+e2e) | `runAiArtifactCleanup` vitest + 7단계 e2e |
| AC-008 입력창·길이 | 통과(자동) | Enter/Shift+Enter/Esc/조합/공백/12,001·12,000·6,000 |
| AC-009 요청 인자 | 통과(자동+e2e) | 컨텍스트 키 없음 확인 |
| AC-010 백엔드 조립 | 통과(자동) | 픽스처 4개 바이트 일치 |
| AC-011 검증·재요청 | 통과(자동) | `aiPointingCard.test.ts` 27개 |
| AC-012 결과 표시·적용 | 통과(자동+e2e) | D17 비활성 문서 변환, stale, 되돌리기 |
| AC-013 다른 기능 불변 | 통과(자동) | 기존 Rust·vitest 테스트 수정 없이 통과, 도구 잠금 인자 테스트 |
| AC-014 포인터 순서 | 통과(webkit) | 8단계 전부 |
| AC-015 macOS 실 CLI | **대기(사용자)** | 이 세션에서 실행하지 않음 |
| AC-016 Windows Alt | **대기(사용자)** | Windows 기기 없음 — 추측하지 않음 |

### 결정 기록 (워커가 기본값으로 정함)

1. `AiFeature::PointTable`/`PointDiagram` 은 값 없는 변형으로 두고 지시는 `customInstruction` 에서 받아 `build_point_prompt` 인자로 넘긴다("동등 형태", plan M2 허용).
2. 지시가 빈 문자열이어도 백엔드는 오류로 막지 않는다(스펙 규정 없음, 프런트가 공백 지시를 막음).
3. 검토 카드의 point-diagram 에도 입력칸·↻ 를 붙였다(↻ 가 새 묶음을 열어야 해서). 기존 `diagram` 카드는 불변.
4. 표 앞뒤에 다른 내용이 붙은 출력의 실패 문구는 새로 만들었다: `표 하나만 출력해야 해요 — 표 앞뒤에 다른 내용이 붙어 있습니다.`
5. 요청은 `buildSelectionRequest`(항상 앞뒤 문맥을 실음)를 쓰지 않고 직접 조립하고, 발행은 ✨ 툴바와 같은 `defaultOnRequest`(export 만 추가)를 거친다.
6. 입력창은 `document.body` 포털(미리보기 zoom 영향 회피), 배치는 `menuPlacement` flip+clamp.
7. 대기 강조 대상 정보는 카드 모델이 아니라 `pointRequest.ts` 의 `requestId → PointRef` 맵에 둔다.

### Gaps (관찰하지 못한 것)

- 실제 claude/codex 왕복(AC-015)과 Windows Alt(AC-016) — 사용자 수동 확인 대기.
- sequence 다이어그램 노드의 실제 브라우저 ⌥+클릭은 e2e 에서 확인하지 않음(flowchart 노드만; sequence 는 AC-003 jsdom).
- M3·M4b 일부는 그룹별 RED 를 따로 내지 않음(위 RED 증거 요약 참고). R1 과 M2·M4a 는 RED 먼저.
- `usePreview` 가 html 과 source 를 한 상태로 돌려주는지 보는 전용 새 테스트는 없음(기존 6개 통과 + `pointTarget` 소비 경로로 간접 확인).
- 다이어그램 「아래에 삽입」 위치: 닫는 펜스 바로 다음 줄이 산문이면 `findBlockEnd` 가 블록을 더 넓게 볼 수 있는 기존 한계(M4a 보고), 이번에 고치지 않음.
- 스크롤 동기 e2e(8단계)는 휠 이벤트로 구동, `scrollTop` 직접 변경 경로는 확인 안 함. 강조 유지는 개수 비교(같은 요소 여부는 보지 않음).
- 시각 확인(강조 색·두께, 입력창 배치)은 하지 않음 — 사용자 눈 확인 필요.

### 사용자 수동 확인 대기 목록

1. AC-AI17-015 (macOS, 실제 CLI): claude haiku·codex 기본 모델 각각 — 표 열 "연 요금으로, ×10", 다이어그램 노드 "결제 앞에 캐시 노드 추가" → 카드 렌더 → 「바꾸기」 → 미리보기 갱신 → 되돌리기 1회 복원. 지연·검증·재요청 여부를 기록.
2. AC-AI17-016 (Windows): Alt+클릭으로 입력창이 뜨고, Alt 를 뗀 뒤 창 메뉴가 포커스를 가져가지 않는지. 재현되면 대상 위 ⌥+클릭 뒤 첫 `keyup`(Alt)에서 `preventDefault`.
3. 강조 색·두께, 입력창 위치·모양 눈 확인(라이트·다크).

## §E.3 Run-phase Audit-Ready Signal

- run_status: audit-ready (자동 게이트 전부 통과, 수동 AC-015·016 대기)
- run_complete_at: 2026-11-13
- 푸시·PR 없음 — sync 단계가 PR 을 연다.
