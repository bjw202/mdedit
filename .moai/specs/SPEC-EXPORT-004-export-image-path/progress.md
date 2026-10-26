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

_<pending run-phase>_

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
