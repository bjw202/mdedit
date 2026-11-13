# SPEC-AI-017 sync 단계 독립 감사 보고서

- 대상: SPEC-AI-017 「미리보기에서 가리켜 지시하기」 (카드 t9, Tier M)
- 감사 위치: `.claude/worktrees/t9`, 브랜치 `WT-preview-pointing`, HEAD `4cdd88d`, 기준 `origin/main` `64a9ab3` (merge-base 와 같음)
- 감사 방식: 코드·문서 직접 읽기 + 범위를 좁힌 재실행(전체 스위트는 돌리지 않음). 소스(`src/`, `src-tauri/`, `e2e/`)는 수정하지 않았다.
- 평가 프로필: 내장 기본(Functionality 40 / Security 25 / Craft 20 / Consistency 15, 필수 통과 = Functionality + Security, Tier M 통과선 0.80). 하모닉 가중 평균으로 합산.

## 쉬운 말 요약

표의 열 머리·칸이나 다이어그램 노드를 ⌥+클릭해서 AI에게 고치게 하는 기능이 계획대로 들어가 있습니다. 직접 다시 돌려 본 테스트(새 테스트 파일 5개 103건, 이웃 기존 테스트 5개 파일 186건)는 모두 통과했고, ⌥ 없이 하는 평소 동작(선택·링크·스크롤)은 코드상 바뀐 곳이 없습니다. 보안 쪽은 결과 표에 이미지·링크·스크립트가 들어가도 카드 안에서 모두 글자로만 남는다는 것을 재현으로 확인했고, 도구를 여는 경로도 없었습니다. 막히는 결함(BLOCKING)은 찾지 못했습니다. 다만 결과 카드 안의 표가 스타일 없이 그려지고, 수식이 든 표는 글자가 중복되어 보이며, 스트리밍 중 큰 문서에서 불필요한 재파싱이 반복되는 문제가 있어 고치는 편이 좋습니다. 실제 claude/codex 왕복(AC-AI17-015)과 Windows Alt(AC-AI17-016)는 아직 사람 확인 대기이므로 `completed` 전환은 맞지 않고, 판정은 PASS-WITH-DEBT 입니다.

## 최종 판정

**PASS-WITH-DEBT** — 종합 점수 **0.88** (통과선 0.80)

| 차원 | 가중치 | 점수 | 판정 | 핵심 근거 |
|---|---|---|---|---|
| Functionality | 40% | 0.88 | PASS | AC-001~014 자동 증거 확인, 수동 AC-015·016 미확인(정직하게 공개됨), 카드 표 스타일 누락 |
| Security | 25% | 0.92 | PASS | 카드 표 정화 재현 확인(속성 0개), 도구 잠금 단위 테스트 확인, 선택자 주입 경로 없음 |
| Craft | 20% | 0.82 | PASS | 새 테스트 충실·eslint 0, 단 스트리밍 중 반복 파싱·강조 맵 누수·CSS 누락·그룹별 RED 일부 없음 |
| Consistency | 15% | 0.88 | PASS | 기존 경로 재사용·기존 프롬프트 불변, 문서 수치 일치, 프론트매터 전이 시점이 규약과 다름 |

산식: `1 / (0.40/0.88 + 0.25/0.92 + 0.20/0.82 + 0.15/0.88) = 0.877 ≈ 0.88`. 필수 통과 차원(Functionality, Security)은 각각 독립적으로 통과선을 넘었다(방화벽 미발동).

---

## 1. Claim (주장)

감사한 주장은 다음과 같다. 각 항목의 증거는 §2 에 있다.

| # | 주장 | 판정 |
|---|---|---|
| C1 | ⌥ 없는 클릭·선택·링크·스크롤 동기는 이 기능이 있어도 그대로다 | 확인됨(코드+테스트), 실제 스크롤 회귀 비교는 e2e 의 휠 구동 1건뿐 |
| C2 | AI 꺼짐·정책 잠금·분할 아님이면 기능이 숨고 ⌥+클릭은 아무 일도 하지 않는다 | 확인됨 |
| C3 | 가리키기 요청은 도구 없이 나간다(claude `--tools ""`, codex 잠금, 웹 거짓) | 단위 테스트와 코드 확인, Rust 는 내가 다시 돌리지 않음 |
| C4 | 기존 기능의 프롬프트·인자는 바이트까지 그대로다 | 확인됨(정적 diff), Rust 는 내가 다시 돌리지 않음 |
| C5 | 카드 안 결과 표는 비활성 문서로 만든 글자뿐이라 스크립트·핸들러·링크·원격 요청이 없다 | 확인됨(재현), 단 시각 결함 2건 발견 |
| C6 | AC-AI17-001~016 이 테스트 또는 명시적 수동 항목으로 덮인다 | 001~014 덮임, 015·016 수동 대기 |
| C7 | 문서(CHANGELOG 수치, USER_GUIDE 절차, 미지원 목록, README 앵커)가 코드·SPEC 과 맞는다 | 확인됨(경미한 누락 있음) |
| C8 | M3/M4b 그룹별 RED 부재, sequence e2e 부재, 계획 감사 PASS-with-debt 가 정직하게 공개됐다 | 확인됨 |

## 2. Evidence (증거) — 실제 명령과 출력

### E1. 변경 범위 (C4, C6)

```
$ git -C <wt> diff --stat origin/main...HEAD | tail -1
 57 files changed, 4809 insertions(+), 33 deletions(-)
$ git diff origin/main...HEAD --diff-filter=M --name-only      (17개, 전부 운영 코드·문서)
$ git diff origin/main...HEAD --diff-filter=DR --name-only     (출력 없음: 삭제·이름변경 없음)
$ git diff origin/main...HEAD -- src-tauri/src/ai/prompt.rs | grep -c "^-[^-]"
0
$ git diff origin/main...HEAD -- src-tauri/src/ai/mod.rs | grep "^-[^-]"
(출력 없음)
$ git diff origin/main...HEAD -- src/components/editor/extensions/ai-suggestion-card.ts | grep "^-[^-]"
-    controller.model.presetKind === 'diagram' && !controller.isListFallbackActive();
-  controller = new AiSuggestionCardController(model, callbacks, { renderMermaid: renderMermaidInto });
```

- Rust 는 삭제 줄이 0 이다. 기존 함수 본문에 닿은 곳은 `AiFeature::resolve` 의 새 팔 2개, `task_text` 새 팔 2개뿐이고 `build_inline_prompt_ex`·`scope_clause`·`envelope_tags` 는 손대지 않았다.
- 기존 테스트 파일은 하나도 수정되지 않았다(수정된 17개 중 테스트·e2e 파일 0개). 기존 픽스처도 그대로(`src-tauri/tests/fixtures` 에는 새 `point-*` 4개만 추가).
- 카드 파일의 삭제 줄은 2개이고, 둘 다 가리키기 조건을 덧붙이는 재작성이다.

### E2. 재실행한 테스트 (C1, C2, C5, C6)

```
$ npx vitest run src/lib/preview/pointTarget.test.ts src/test/pointRequest.test.ts \
    src/test/aiPointingCard.test.ts src/test/PointInstructionPopover.test.tsx \
    src/test/PreviewRendererPointing.test.tsx
 ✓ src/lib/preview/pointTarget.test.ts (27 tests)
 ✓ src/test/pointRequest.test.ts (12 tests)
 ✓ src/test/PreviewRendererPointing.test.tsx (26 tests)
 ✓ src/test/aiPointingCard.test.ts (27 tests)
 Test Files  5 passed (5)
      Tests  103 passed (103)

$ npx vitest run src/test/renderer.test.ts src/test/tableValidate.test.ts src/test/PreviewRenderer.test.tsx \
    src/test/aiSuggestionCardRender.test.ts src/test/diagramRenderer.test.ts
 ✓ renderer.test.ts (62)  ✓ tableValidate.test.ts (12)  ✓ aiSuggestionCardRender.test.ts (8)
 ✓ PreviewRenderer.test.tsx (21)  ✓ diagramRenderer.test.ts (83)
 Test Files  5 passed (5)   Tests  186 passed (186)

$ npx eslint <바뀐 src 파일·새 테스트 파일 전부> --ext ts,tsx --report-unused-disable-directives --max-warnings 0
eslint exit=0
```

(`PointInstructionPopover.test.tsx` 의 11건도 같은 실행에 포함되어 통과했다. 출력 꼬리에서 파일 5개 통과를 확인했다.) 렌더러 리팩터링(`createMarkdownParser` 추출) 뒤에도 기존 `renderer.test.ts` 62건이 수정 없이 통과했다.

### E3. 기록된 run 단계 게이트 원문 (재실행 아님 — 오케스트레이터가 남긴 파일을 읽음)

```
$ tail .moai/state/verify/run-t9/vitest-full.txt
 Test Files  129 passed (129)
      Tests  2262 passed (2262)
$ tail .moai/state/verify/run-t9/playwright.txt
  11 passed (23.6s)
$ grep "test result" .moai/state/verify/run-t9/cargo-test.txt
test result: ok. 461 passed; 0 failed; ...      (lib)
test result: ok. 3 passed; ...                  (app_acl)
test result: ok. 8 passed; ...                  (asset_charset)
$ grep "point_" .moai/state/verify/run-t9/cargo-test.txt     (14건 ok, 바이트 일치 2건·도구 잠금 1건 포함)
```

CHANGELOG 수치(129 파일 / 2262 / 11건 / 461+3+8)는 이 파일들과 일치한다. e2e 테스트 수는 `grep -c "^\s*test("` 로 직접 세어 11 이었다.

### E4. 도구 없는 요청 (C3)

```
prompt.rs:91   pub fn allows_web(&self) -> bool { matches!(self, AiFeature::Research) }
mod.rs:253-256 AiFeature::PointTable | AiFeature::PointDiagram => build_point_from_args(&feature, &args)?
mod.rs 테스트  point_requests_use_toolless_claude_args_and_locked_codex_args:
               claude[--tools 다음]=="" , --allowedTools 없음,
               codex: features.apps=false / features.shell_tool=false / features.view_image=false / web_search=disabled,
               web_search=live 없음
```

프런트는 `feature: 'inline-edit'` + `presetKind: 'point-*'` 로만 보내고(`pointRequest.ts:88-97`) 웹 허용 인자를 실을 수 없다. 웹 허용은 백엔드 `allows_web()` 한 곳에서만 정해지므로 가리키기에서 도구가 열릴 경로가 없다.

### E5. 프롬프트 바이트 일치 (C4)

`point_table_prompt_is_byte_identical_to_captured_fixtures`, `point_diagram_prompt_is_byte_identical_to_captured_fixtures` 가 `include_str!` 픽스처 4개와 `assert_eq!` 로 비교한다(cargo 기록 파일에서 ok). 픽스처는 계획 단계 실측 캡처의 복사본이다. 추가 지시·태그 충돌·pointer 누락/공백 오류·`mdedit_pointer` 가 기존 9기능 프롬프트에 새지 않음(`existing_prompts_never_mention_pointer_tag`)도 테스트돼 있다.

### E6. 카드 안 표 정화 재현 (C5)

`sanitizeTableHtml`(`ai-suggestion-card.ts:1550`)의 로직을 그대로 옮겨(markdown-it+KaTeX 플러그인, jsdom `DOMParser`) 입력 `| $x^2$ | ![로고](https://evil.example/a.png) [링크](https://e.com) |` 를 돌렸다.

```
SANITIZED: ... <td>로고 링크</td> ...        (img·a 요소 없음, 글자만 남음)
remaining attrs: 0                            (모든 요소의 속성 합계 0)
textContent: "...x2x^2x2\n로고 링크..."        (수식 칸이 'x2x^2x2' 로 중복)
```

- 보안: `img`/`a`/네트워크 요소 제거, 속성 전부 제거(`text-align` style 만 예외). 비활성 문서에서 파싱하므로 파싱 중 이미지 요청도 없다. 활성 문서로는 속성이 하나도 없는 노드만 이동한다.
- 이 재현은 소스 로직을 node 에서 복제한 것이지 앱 안에서 돈 것이 아니다(Gap G7). 그러나 같은 입력 클래스를 vitest `sanitizeTableHtml` 테스트(`aiPointingCard.test.ts:171`)가 jsdom 으로 확인한다.
- 결함: `class` 속성까지 지워지므로 KaTeX 의 MathML 본문·`annotation`·HTML 본문 세 벌이 모두 보인다(D3 참조).

### E7. 스트리밍 중 반복 파싱 비용 (D5)

`onStream` → `commit({type:'stream'})` → `notifyActiveCard()`(`ai-suggestion-card.ts:1273-1280, 1251`) → `PreviewRenderer.tsx:325-339` 의 `apply()` → 가리키기 카드마다 `restoreMarkTargets` → `decideHighlightRestore`(전체 문서 파싱 1회) + `locatePointBlock`(전체 문서 파싱 1회). 파싱 비용은 같은 파서 구성에서 플러그인을 일부 뺀 markdown-it(+KaTeX)로 대략 잰 값이다(Mermaid·Shiki 제외, node 환경):

```
docKB=13   parse_ms=9.4
docKB=135  parse_ms=20.1
docKB=539  parse_ms=67.7
```

### E8. 스타일 누락 (D1)

```
$ grep -rn "mdedit-ai-table-preview" src --include='*.css' --include='*.ts' --include='*.tsx' | grep -v test
src/components/editor/extensions/ai-suggestion-card.ts:622:    tablePreview.className = 'mdedit-ai-table-preview';
$ grep -n "^.preview-content table {" src/index.css
235:.preview-content table {
```

`.mdedit-ai-table-preview` 를 겨냥한 CSS 규칙이 어디에도 없고, 표 스타일(테두리·패딩)은 `.preview-content table` 아래에만 있다.

### E9. 문서 일치 (C7)

- README 링크 `docs/USER_GUIDE.md#44-미리보기에서-가리켜-지시하기-표다이어그램` ↔ 헤딩 `### 4.4 미리보기에서 가리켜 지시하기 (표·다이어그램)`(USER_GUIDE.md:299). GitHub 앵커 규칙(구두점 제거, 공백→`-`)으로 계산하면 일치하고, 같은 방식으로 이미 쓰는 `#15-ai-켜기끄기와-정책-잠금` ↔ `### 1.5 AI 켜기/끄기와 정책 잠금`(80행)과 규칙이 같다. 브라우저로 클릭해 확인하지는 않았다.
- USER_GUIDE 버튼 이름 「바꾸기」·「아래에 삽입」 ↔ 카드 라벨 `'✓ 바꾸기'`, `'⤵ 아래에 삽입'`(`ai-suggestion-card.ts:363-364`). Enter 전송·Shift+Enter 줄바꿈·Esc/바깥 클릭 닫기 ↔ `PointInstructionPopover.tsx:56,74-81`. 6,000/12,000자 규칙 ↔ `ai-length-guard.ts` 의 `evaluateSelectionGuard`(point-* 는 `EDIT_PRESETS` 에 없으므로 변환 계열로 판정됨). 오류 문구 두 개 ↔ `PreviewRenderer.tsx:57-58`. "원문이 바뀌어 적용할 수 없어요" 는 기존 stale 카드 문구(D12)이며 `aiPointingCard.test.ts:319` 가 확인한다.
- 미지원 목록(문단·행·다중 선택·cluster/연결선·목록/인용 안·키보드·미리보기 전용·12,000자 초과)은 SPEC Exclusions·D3·D4·D10 과 일치한다.
- 프론트매터: `spec.md` `status: implemented`(sync 가 `completed` 보류를 명시), `plan.md`·`acceptance.md` 는 `status: draft`.

### E10. AC → 테스트 매핑 (C6)

| AC | 덮는 곳 |
|---|---|
| 001 보이는 조건 | `pointTarget.test.ts` 활성 조건, `pointRequest.test.ts` 보내기 시점(정책 잠금·토글·분할), `PreviewRendererPointing.test.tsx` |
| 002 대상 판정 | `pointTarget.test.ts` AC-002 |
| 003 노드 마크업 | `pointTarget.test.ts` AC-003 (6종 + sequence 중복 ID + 한글 ID + pie/gantt) |
| 004 순번 블록 | `pointTarget.test.ts` AC-004 (인라인 svg, 공백 펜스, `$$`, 일치 확인, R1 `&amp;`) |
| 005 낡음·복원 | `pointTarget.test.ts`, `pointRequest.test.ts`, `PreviewRendererPointing.test.tsx`, e2e 5단계 |
| 006 대상 정보 | `pointTarget.test.ts` AC-006 (짧은 행, `\|` 포함) |
| 007 정리 | `PreviewRendererPointing.test.tsx` AC-007, e2e 7단계 |
| 008 입력창·길이 | `PointInstructionPopover.test.tsx`, `pointTarget.test.ts`, `pointRequest.test.ts` |
| 009 요청 인자 | `pointRequest.test.ts` |
| 010 백엔드 조립 | `prompt.rs`·`mod.rs` 테스트 |
| 011 검증·재요청 | `aiPointingCard.test.ts` 그룹 1·2·3 |
| 012 결과 표시·적용 | `aiPointingCard.test.ts` 그룹 4·5 |
| 013 다른 기능 불변 | 기존 테스트 무수정 통과 + `prompt.rs`·`mod.rs` 도구 잠금 테스트 |
| 014 포인터 순서 | `e2e/preview-pointing.spec.ts` 9건(8단계) |
| 015 macOS 실 CLI | 수동 — 대기(사용자) |
| 016 Windows Alt | 수동 — 대기(사용자, 기기 없음) |

## 3. Baseline-attribution (baseline 귀속)

- **이번 실행(HEAD `4cdd88d`)에서 내가 직접 관측한 것**: E1(diff 통계·삭제 줄), E2(vitest 10개 파일 289건 통과, eslint exit 0), E6(정화 재현), E7(파싱 시간), E8(CSS grep), E9(앵커·라벨·문구 대조), E10(AC 매핑 grep), 코드 정독(Rust prompt/mod 전체 diff, TS 새 모듈 5개, 카드 diff, PreviewRenderer diff, CSS).
- **이번 실행에서 다시 돌리지 않고 기록 파일을 읽은 것**: 전체 vitest 2262건, Playwright 11건, cargo 461+3+8건, typecheck, 전체 lint. 출처는 `.moai/state/verify/run-t9/*.txt` 이며 생성 시점의 트리가 지금 HEAD 와 같은지는 파일만으로는 증명되지 않는다(`git log` 상 run 이후 변경은 docs 커밋 2개뿐인 것은 확인).
- **추정이 아닌 것과 추정인 것의 구분**: 파싱 시간(E7)은 앱 안의 측정이 아니라 비슷한 구성의 별도 측정이다. 실제 비용은 Mermaid 플러그인·Shiki 없는 구성이라 낮게 잡혔을 가능성이 크다.

## 4. Gaps (미검증)

| ID | 관측하지 못한 것 | 영향 |
|---|---|---|
| G1 | 실제 claude/codex 왕복(AC-AI17-015) | 지연·검증 통과율·재요청 빈도 미상. SPEC 의 S5 실측(계획 단계)만 있음 |
| G2 | Windows Alt 키 뗄 때 창 메뉴 포커스(AC-AI17-016, A3) | Windows 사용성 미상 |
| G3 | cargo 테스트·typecheck·전체 vitest·Playwright 재실행 | 기록 파일에 의존. Rust 쪽은 코드 정독으로 보완 |
| G4 | 커버리지(%) 측정 | 85% 기준을 숫자로 확인하지 못함. 새 로직 테스트가 AC 단위로 촘촘하다는 정성 판단만 있음 |
| G5 | 실제 화면(라이트·다크 강조 색, 입력창 위치, 카드 안 표 모양) | 눈 확인 없음. 특히 D1 의 스타일 누락은 화면에서 확인하지 못함 |
| G6 | CSS `zoom` 이 1 이 아닐 때(글꼴 크기 변경) 입력창 위치 | `event.clientX/Y` 를 body 포털에 쓰는데 WebKit 의 zoom 하 좌표 해석은 e2e 가 zoom 1 에서만 돌아 미확인 |
| G7 | 정화 재현은 소스 복제 | 앱 안에서 돌린 것이 아님(vitest 로는 이미 확인됨) |
| G8 | sequence 다이어그램의 실제 브라우저 ⌥+클릭 | e2e 는 flowchart 만. sequence 는 jsdom(AC-003)뿐 |
| G9 | 스크롤 동기 회귀 | 8단계는 휠 구동 1건. 구조상 `useScrollSync`·`data-line` 플러그인을 건드리지 않아 위험은 낮음 |
| G10 | 요청 중 편집(D12)의 실제 에디터 상호작용 | e2e 7단계가 stale 안내까지 확인 |

## 5. Residual-risk (잔여 위험)

1. 모델이 지시와 무관한 칸·노드까지 바꿀 수 있다. 차이 강조가 없고(범위 밖), 사용자가 렌더된 결과를 보고 확정한다.
2. 블록 안의 악성 문장(프롬프트 주입)은 태그 데이터 처리와 "지시 무시" 문구로 줄였지만 0 은 아니다. 결과는 제안일 뿐이고 도구가 없으며 되돌리기 한 번으로 복원된다.
3. 검토 카드를 띄워 둔 채 블록 위쪽을 고치면 적용이 막혀 다시 가리켜야 한다(D12, 문서화됨, 문서 손상 없음).
4. 큰 문서에서 스트리밍 중 가리키기 카드가 열려 있으면 청크마다 문서 전체를 재파싱한다(D5).
5. 6,000자 초과 표의 「바꾸기」 안전선은 기존 SPEC-AI-013 을 그대로 따르므로, 완결 신호가 없는 codex 는 큰 표에서 「아래에 삽입」만 남는다(SPEC 의 수용된 한계).

---

## 6. 정직한 공개 점검 (감사 항목 7)

| 공개 항목 | 문서에 적혔는가 | 코드·기록과 일치 |
|---|---|---|
| M3·M4b 그룹별 RED 부재 | progress.md §E.2 「RED 증거 요약」·Gaps, CHANGELOG 「확인하지 못한 것 (4)」 | 일치. M4b 는 "그룹 3~5 는 한 파일에서 21개 실패(5개는 부정형이라 처음부터 통과)" 로 적었다. M3 는 RED 출력이 적혀 있지 않고 "일부"라고만 되어 있다 — 어떤 부분인지 한 줄 더 있으면 좋다(D9) |
| sequence 다이어그램 e2e 부재 | Gaps, CHANGELOG (3) | 일치 |
| 계획 감사 PASS-with-debt | progress.md §E.1 회차표, CHANGELOG 「계획 감사의 부채」 | 일치(0.80→0.86→0.90, 3차 FAIL, 상한 도달, 재감사 없음). v0.2.2 의 R1~R5 가 재감사되지 않았다는 점도 적혀 있다 |
| `usePreview` 전용 테스트 없음 | Gaps, CHANGELOG (5) | 일치. 실제로 `usePreview.ts` 변경은 상태 묶음 7줄뿐이고 소비 경로 테스트로 간접 확인됨 |
| 시각 확인 안 함 | Gaps, 수동 대기 목록 3번 | 일치 — 그리고 이 때문에 D1 같은 스타일 누락이 걸러지지 않았다 |

공개 자체는 정직하다. 과장된 PASS 주장은 찾지 못했다.

---

## 7. 결함 목록

BLOCKING 은 없다. 아래는 모두 `SHOULD-FIX` 또는 `MINOR` 이다. 발견 단계에서는 확신이 낮은 것도 모두 적었고, 소비 단계 분류(blocking / optional)를 함께 달았다.

### SHOULD-FIX

**D1 [SHOULD-FIX][optional→권장] 결과 카드 안의 표에 스타일 규칙이 없다**
- 위치: `src/components/editor/extensions/ai-suggestion-card.ts:622` (`mdedit-ai-table-preview` 클래스 부여), `src/index.css:235` (`.preview-content table` 에만 표 스타일), `src/styles/mdedit-components.css:506-511` (`.mdedit-ai-mermaid-preview` 는 있고 표 쪽은 없음)
- 설명: SPEC D5·REQ-AI17-012 의 핵심 가치는 "확정 전에 렌더된 결과를 본다"인데, 카드 안 표는 `.preview-content` 바깥이라 테두리·패딩이 없고, `overflow:auto` 도 없어 열이 많은 표는 카드 폭을 넘을 수 있다. 재현은 CSS grep 으로 한 것이고 실제 화면은 보지 못했다(G5).
- 필요한 수정: `.mdedit-ai-table-preview { overflow: auto; ... }` 와 `.mdedit-ai-table-preview table / th / td` 규칙을 `mdedit-components.css`(`.mdedit-ai-mermaid-preview` 옆)에 추가하고, `.preview-content table` 의 테두리·패딩과 같은 토큰을 쓴다. 눈 확인(라이트·다크) 1회를 수동 목록에 넣는다.

**D2 [SHOULD-FIX][optional→권장] 스트리밍 청크마다 문서 전체를 2회 이상 재파싱한다**
- 위치: `src/components/preview/PreviewRenderer.tsx:324-339` (`apply`), `src/lib/preview/pointHighlight.ts:65-86` (`restoreMarkTargets`), `src/lib/preview/pointTarget.ts:87-104` (`parseBlocks`가 매번 새 파서 생성), `ai-suggestion-card.ts:1251,1273-1280` (청크마다 notify)
- 설명: E7 참조. 540KB 문서에서 파싱 1회 약 68ms(플러그인 일부 제외 측정), 청크마다 2회 이상. 일반 문서(수십 KB)에서는 체감이 작지만 큰 문서에서 응답이 스트리밍되는 동안 미리보기 스레드가 바빠질 수 있다. 앱 안 실측은 하지 않았다.
- 필요한 수정: 가리키기 카드가 있을 때만 `apply` 를 `source`/`html` 변경과 카드 phase 전이(생성·완료·닫힘)에서만 부르거나, `phase === 'streaming'` 의 `stream` 이벤트는 건너뛴다. 또는 `parseBlocks` 결과를 `source` 문자열 기준으로 한 줄 캐시한다(`WeakMap` 불가이므로 마지막 `source`+결과 1개).

**D3 [SHOULD-FIX][optional→권장] 수식이 든 표는 카드 안에서 글자가 중복되어 보인다**
- 위치: `src/components/editor/extensions/ai-suggestion-card.ts:1550-1567` (`sanitizeTableHtml` 이 `class` 를 포함한 모든 속성을 제거)
- 설명: E6 에서 `$x^2$` 칸이 `x2x^2x2` 로 나왔다(MathML 본문 + annotation + HTML 본문). 이 앱은 KaTeX 를 지원하므로 수식이 든 표는 현실적인 입력이다. 보안상 속성 전부 제거는 옳은 선택이고, 문제는 그 결과 `katex-mathml` 숨김이 풀린다는 점이다.
- 필요한 수정: 정화 단계에서 `.katex-mathml` 요소를 통째로 제거하고(HTML 본문만 남김), KaTeX 의 `class` 는 `katex*` 접두사만 허용 목록으로 남기되 `style` 은 계속 제거한다. 또는 카드 표 렌더에서 KaTeX 플러그인을 빼고 `$...$` 를 원문 글자로 둔다. 어느 쪽이든 `img`/`a`/네트워크 요소 제거 테스트를 유지하고 수식 칸 단언을 1개 추가한다.

### MINOR

**D4 [MINOR][optional] `pointRefs` 맵에서 항목이 삭제되지 않는다**
- 위치: `src/lib/preview/pointRequest.ts:42,100`
- 설명: 요청마다 항목이 쌓이고 카드가 닫혀도 지워지지 않는다(`delete`/`clear` grep 결과 없음). 항목이 작아 영향은 미미하나 `runPointUiCleanup` 이 맵을 비우지도 않는다.
- 필요한 수정: `runPointUiCleanup` 에서 `pointRefs.clear()`, 카드 제거 시 해당 `requestId` 삭제(레지스트리 구독에서 사라진 id 정리).

**D5 [MINOR][optional] point-diagram 검토 카드의 방향 지시 입력칸 플레이스홀더가 표·문서 편집용 문구다**
- 위치: `ai-suggestion-card.ts:435` (`'✏️ 방향 지시... (예: 더 짧게, 존댓말로)'`), 사용 지점 `ai-suggestion-card.ts:642-645`
- 설명: 다이어그램 가리키기 카드에 ↻ 를 붙이려고 `renderDoneControls` 를 재사용하면서 문서 다듬기용 예시가 그대로 나온다. 기능은 맞지만 어색하다. 결정 기록 3번에 의도(↻ 가 새 묶음을 열어야 함)는 적혀 있다.
- 필요한 수정: `point-*` 일 때 예시 문구를 `예: 노드 이름도 바꿔줘` 같은 대상 맞춤 문구로 교체하거나 예시 없이 `✏️ 방향 지시...` 만 둔다.

**D6 [MINOR][optional] 에디터가 없는 경우 입력창이 말없이 닫힌다**
- 위치: `src/lib/preview/pointRequest.ts:65`(`'no-editor'`), `src/components/preview/PreviewRenderer.tsx:347`
- 설명: 보내기 순간 활성 에디터가 없으면 안내 없이 입력창이 닫힌다(`stale` 만 안내문으로 바뀜). 분할 보기에서는 사실상 일어나기 어려운 경로다. 앱의 "침묵 금지"(P7) 방침과 다르다.
- 필요한 수정: `no-editor` 에도 `NOTICE_UNPOINTABLE` 안내문을 보인다(1줄).

**D7 [MINOR][optional] 프론트매터·상태 전이 시점이 규약과 다르다**
- 위치: `.moai/specs/SPEC-AI-017-preview-pointing/spec.md:5`, `plan.md:5`, `acceptance.md:5`; 커밋 `e6879bc`(draft→in-progress)
- 설명: 규약상 `draft → in-progress` 는 첫 run 커밋(M1)에 일어나야 하나 run 마지막 docs 커밋 `e6879bc` 에서 일어났다(`git show a1b913b --stat` 에 spec.md 없음, `git log` 로 확인). `plan.md`·`acceptance.md` 는 `draft` 로 남아 있다(progress.md 가 이를 gap 으로 인정). 기능에는 영향이 없다.
- 필요한 수정: `completed` 전환 때 세 문서의 `status`·`updated` 를 함께 맞춘다(비전이 정정은 manager-spec 소관).

**D8 [MINOR][optional] 코드맵이 개요 한 줄만 갱신됐다**
- 위치: `.moai/project/codemaps/overview.md:16`(갱신됨) vs `frontend.md`·`testing.md`·`pipelines.md`(새 `src/lib/preview/point*`·테스트 목록 없음; `grep -rln pointTarget .moai/project` 결과 없음)
- 필요한 수정: 선택. 다음 `/moai codemaps` 실행 때 반영하거나 `testing.md` 라이브러리 표에 새 테스트 5개를 한 줄 추가.

**D9 [MINOR][optional] M3 의 RED 공백 범위가 모호하다**
- 위치: `progress.md:81-82`, CHANGELOG 「확인하지 못한 것 (4)」
- 설명: M4b 는 "그룹 3~5 한 파일 21건 실패"로 구체적이지만 M3 는 "일부"만 적혀 있다. 감사자가 어디가 RED 없이 쓰였는지 알 수 없다.
- 필요한 수정: progress.md 에 M3 에서 RED 가 없었던 함수 이름(예: 어느 `describe` 그룹)을 한 줄 명시.

**D10 [MINOR][optional] 시작 방식이 `blind` 상한 초과인 경우에도 묶음 카운터가 먼저 초기화된다**
- 위치: `ai-suggestion-card.ts:1743-1748`
- 설명: `startUserBundle()` 이 `retry-exhausted` 판정 return 보다 앞에서 불린다. 상한 초과로 요청이 발행되지 않아도 `pointFailures` 가 0 이 된다. 가리키기 카드에서 상한 초과에 도달하는 경로는 다이어그램 검토 카드의 blind ↻ 반복 정도이고 실영향은 거의 없다(발행이 안 되므로 재요청도 안 된다).
- 필요한 수정: `retry-exhausted` return 뒤로 호출을 옮기거나 그대로 두고 주석으로 의도를 적는다.

### 확신 낮음으로 보고만 하는 항목

- **U1 입력창 위치(G6)**: 글꼴 크기 변경(CSS zoom ≠ 1) 시 `clientX/Y` 해석이 WebKit 에서 달라 입력창이 어긋날 수 있다. 확인하지 못했다. 재현되면 `getBoundingClientRect` 기준 좌표로 바꾼다. [optional]
- **U2 발견 가능성**: 앱 안에 이 기능을 알리는 표시(툴팁·힌트)가 없고 USER_GUIDE 4.4 에만 있다. SPEC D1 이 의도한 최소 진입이며 결함은 아니다. [optional]

---

## 8. 권고

1. D1·D3 를 같은 CSS/정화 수정으로 묶어 고치고(작은 변경), 수동 목록에 "카드 안 표 모양 눈 확인"을 넣는다. D2 는 큰 문서 사용자가 있으면 우선순위를 올린다.
2. `completed` 전환은 AC-AI17-015·016 과 눈 확인이 끝난 뒤에 한다. 그 전까지 `implemented` 유지는 올바른 판단이다.
3. 이 감사 결과로 PR 을 여는 것은 막지 않는다(BLOCKING 0). D1·D3 를 같은 PR 에 넣을지는 오케스트레이터가 정한다 — 둘 다 `optional` 분류이므로 PASS 를 FAIL 로 바꾸지 않는다.
