---
id: SPEC-AI-001
version: "0.1.1"
status: draft
created: "2026-07-16"
updated: "2026-07-16"
author: "jw"
priority: high
issue_number: 0
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-07-16 | jw | 최초 plan 초안 — AI 기능 MVP M0+M1. research.md(코드베이스 통합 분석 10영역) + 설계서 v0.4 기준. M0(Rust ai 모듈 → 프론트 릴레이 → aiStore → 설정 모달/온보딩) → M1(✨ 툴바 → 제안 카드 → 적용+재검증 → 길이 가드 → mermaid 검증 → 고스트 섹션 채우기) 순 태스크 분해. 사용자 확정 결정 7건 반영(spec.md 핵심 설계 결정과 동일). TDD RED-first 테스트 매핑 포함. |
| 0.1.1 | 2026-07-16 | jw | plan-audit 리뷰(review-1) 반영으로 문서 세트 버전 정합(spec.md/acceptance.md AC-AI-021/022 신설, unwanted EARS 정규화). plan 태스크 분해 내용 변경 없음 — T2(AiProvider trait) → AC-AI-021, T5(설정 모달 sonnet 토글) → AC-AI-022 검증 대응 확인. |

## Overview

`mdedit`에 로컬 `claude` CLI 백엔드 AI 기능의 첫 출시 묶음(M0+M1)을 추가한다. M0은 프로세스 스폰·델타 스트리밍 릴레이·감지·설정 인프라(신규성 최상, 핵심 리스크), M1은 그 위의 인라인 편집 UX와 빈 섹션 채우기다.

- 개발 방법론: **TDD** (`quality.yaml` `development_mode: tdd`, RED-GREEN-REFACTOR, 브라운필드 Pre-RED 포함)
- 브랜치: `feature/SPEC-AI-001` (`/moai run` 단계 생성)
- 신규 런타임 의존성: **없음 예상** — CodeMirror6/mermaid/zustand/Tauri shell 권한 모두 확보됨(research.md §1). M0 T0에서 최종 확인.
- 주 검증 플랫폼: **Windows** (단축키 Ctrl 매핑, 저사양 + 백신 스폰 지연 실측).

## Confirmed Design Decisions (사용자 승인, 재검토 금지)

spec.md "핵심 설계 결정" 7건과 동일. 요약:

1. MVP claude CLI 단독 — codex는 M4, `AiProvider` trait 계약만 지금 확정.
2. 설정 UI = 새 설정 모달 다이얼로그(Header 톱니 버튼 → 모달, 첫 섹션 AI).
3. 프리셋 = 다듬기 / 개요로 정리 / 표로 만들기 / 다이어그램으로 / 짧게 줄이기 + 직접 입력. 번역 없음.
4. Tab은 고스트 확정 키 아님 — `indentWithTab` 유지, 확정 = [✓ 넣기]/Mod+Enter.
5. 모든 단축키 `Mod-` 접두어, Windows 우선 검증.
6. 기본 모델 haiku, 설정 "고급 모델(sonnet)" 토글 + ↻ 3회 소진 시 sonnet 인라인 폴백.
7. TDD RED-first.

## Task Decomposition

research.md §6 구현 순서를 따른다. 각 유닛은 "테스트 먼저(RED) → 최소 구현(GREEN) → 정리(REFACTOR)". 순수 함수(Rust 파싱/가드, TS 길이 가드/mermaid 검증)는 테스트 선행이 자연스럽고, CodeMirror 트랜잭션·위젯 로직은 `insertTable.test.ts`의 가짜 view 스텁 방식으로 선행한다.

---

### M0 — 기반 인프라 (신규성 높은 순)

#### T1. [NEW] Rust 스트림 파싱·stderr 분류 순수 함수 — `src-tauri/src/ai/stream.rs`

- `parse_stream_line(line) -> Option<Delta>`: `{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}}`에서 `text` 추출, `{"type":"result","subtype":"success","result":"..."}`에서 최종 문자열 추출.
- `classify_stderr(stderr) -> AiErrorKind`: 로그인 만료 / 네트워크 차단 / 기타(REQ-AI-037, 040).
- **RED first**: Rust `#[cfg(test)] mod tests` — 정상 델타 라인, result 라인, 깨진 JSON(파싱 실패→None), stderr 3분류 샘플.
- Reference: research.md §2.4·§4 (Rust 순수 함수 테스트 관례), 설계서 부록 A.1 (스트림 포맷).
- 매핑: REQ-AI-004, 037, 040.

#### T2. [NEW] AiProvider trait + claude 어댑터 스폰 — `src-tauri/src/ai/{provider,claude_cli}.rs`

- `provider.rs`: `trait AiProvider { id; detect; spawn; capabilities }` + `ProviderStatus{installed,version,logged_in}` + `Capabilities{supports_streaming,typical_latency}`. claude만 구현, M4 codex 대비 계약 고정(REQ-AI-001).
- `claude_cli.rs`: `Command`로 빈 스크래치 cwd(`.current_dir`) + `--setting-sources ""` + env `MAX_THINKING_TOKENS=0` + `--model haiku|sonnet` + `--output-format stream-json --include-partial-messages --verbose`, `Stdio::piped()` stdout 리더 스레드에서 T1 파서 → `emit("ai://chunk")` / `ai://done` / `ai://error`. 스크래치 디렉토리 생성 실패(권한·디스크)는 오류 경로(REQ-AI-002).
- Reference: research.md §2.4 (watcher.rs:104–140 스레드+emit), §1 (browser_ops.rs:20–23 스폰), 설계서 §8.1.
- **RED first**: 스폰 인자 조립(cwd·flags·env)을 순수 함수로 분리해 테스트. 실제 프로세스 스폰은 수동/통합 검증(vitest·Playwright는 Tauri IPC 미실행).
- 매핑: REQ-AI-001, 002, 004.

#### T3. [NEW] 감지 + [MODIFY] AppState in-flight + [MODIFY] lib.rs 커맨드 등록

- `detect.rs`: `claude --version`(installed·version) + 로그인 세션 파일 존재/유효성 선제 판정. 크로스플랫폼 경로(Win `%USERPROFILE%`, macOS `~/.claude`) 주의(REQ-AI-012).
- `app_state.rs`: `Mutex<Option<Child>>` in-flight 핸들(동시 1개, watcher 관리와 동형). 새 요청 시 기존 kill + 취소 표시 신호(REQ-AI-006, 009).
- `mod.rs`: `ai_request`/`ai_cancel`(child.kill, REQ-AI-005)/`ai_detect_providers`/`ai_policy_status` 커맨드. `lib.rs:35` invoke_handler 등록, `.setup()`에서 `MDEDIT_AI_DISABLED` env + 정책 파일 1회 프로브(REQ-AI-017).
- Reference: research.md §1 (lib.rs:35–55), §2.4 (AppState Mutex), §3 (kill-switch·로그인 세션).
- **RED first**: 경로 판정·정책 프로브를 순수 함수로 분리해 Rust 유닛.
- 매핑: REQ-AI-005, 006, 009, 012, 017.

#### T4. [NEW] 프론트 릴레이 — `src/lib/tauri/ipc.ts`, `src/hooks/useAiRelay.ts`, `src/store/aiStore.ts`

- `ipc.ts`: `aiRequest`/`aiCancel`/`aiDetectProviders`/`aiPolicyStatus` invoke 래퍼(단일 계층 관례).
- `useAiRelay.ts`: `listen<T>("ai://chunk|done|error")` 후 unlisten 반환(useFileWatcher.ts:68–79 복제), module-ref로 취소 핸들·unlisten 보관.
- `aiStore.ts`: `create<AiState>()` — `status: idle|streaming|done|error` + 스트림 버퍼 + 취소 핸들. **비영속**(partialize 제외, uiStore.ts:123–126 관례). EditorView는 store에 넣지 않음(AppLayout viewRef 유지).
- Reference: research.md §2.7 (zustand·module-ref), §2.4 (listen/unlisten).
- **RED first**: aiStore 리듀서(델타 누적·상태 전이·취소 초기화)를 vitest로. 매핑: REQ-AI-007, 008.

#### T5. [NEW] 설정 모달 + 온보딩 + 고지 배너 + 정책 잠금 — `src/components/settings/SettingsModal.tsx`, [MODIFY] `Header.tsx`

- Header에 톱니 버튼 추가 → 모달 오픈(REQ-AI-011). 모달 첫 섹션 AI: 감지 상태 표시(사용 가능/연결 필요/미설치), "고급 모델(sonnet)" 토글(REQ-AI-016), "AI 기능 끄기" 토글, 정책 활성 시 잠금 표시(REQ-AI-017).
- 온보딩 위저드(REQ-AI-014, 018): OS 감지(Windows 우선) → 설치 명령 복사 → 터미널 안내(스크린샷 1장) → 로그인 안내 → [다시 확인] 재감지. 미설치 시 진입 경로 확보.
- 최초 활성화 1회성 데이터 전송 고지 배너(REQ-AI-013).
- 모든 스타일 `--md-*` 토큰만(REQ-AI-010).
- Reference: research.md §2.8 (Header 인라인 설정 한계), §2.10 (테마 토큰), 설계서 §8.2.
- **RED first**: 상태별 렌더(사용 가능/연결 필요/미설치/정책 잠금) + 고지 배너 1회 표시를 testing-library로. 매핑: REQ-AI-010, 011, 013, 014, 015, 016, 017, 018.

---

### M1 — 인라인 편집 + 시나리오 F

#### T6. [NEW] 선택 길이 가드 (순수 함수) — `src/components/editor/extensions/ai-length-guard.ts`

- `guardSelection(len, preset) -> {allowed, insertOnly, message}`: 편집 프리셋 2K 초과 비활성(REQ-AI-026), 변환 계열 4K까지 삽입 전용, 절단 교체 금지(REQ-AI-027).
- Reference: 설계서 §4.4, §7.
- **RED first**: 경계값(2000/2001/4000/4001) × 프리셋 종류별 vitest(`src/test/aiLengthGuard.test.ts`). 매핑: REQ-AI-026, 027.

#### T7. [NEW] mermaid 사전 검증 (공유 함수) — `src/lib/ai/mermaidValidate.ts`

- `PreviewRenderer.tsx:114`의 `await mermaid.parse(diagram)` 로직을 추출·공유(`securityLevel:'strict'` 유지, REQ-AI-023). `validateMermaid(code) -> {ok, error}`.
- Reference: research.md §2.6 (PreviewRenderer.tsx:114, MERMAID_BASE_CONFIG).
- **RED first**: 유효/무효 mermaid 샘플 vitest(`src/test/mermaidValidate.test.ts`), strict 설정 유지 어서션. 매핑: REQ-AI-023, 024.

#### T8. [NEW] ✨ 선택 툴바 + 프리셋 메뉴 — `src/components/editor/extensions/ai-selection-toolbar.ts`

- 선택 시 `view.coordsAtPos(selection.main.head)` 위치에 ✨ 버튼, 프리셋 5종 + 직접 입력(Esc/← 복귀). 우클릭 컨텍스트 메뉴 중복 노출(FileTreeNode onContextMenu 선례).
- 팝오버 셸: TableGridPicker(외부 mousedown + Esc 닫기) 복제.
- Reference: research.md §2.9 (TableGridPicker EditorToolbar.tsx:97–178, FileTreeNode.tsx:156–158).
- **RED first**: 프리셋 렌더·직접 입력 전환·복귀·길이 가드 연동(T6)을 testing-library. 매핑: REQ-AI-019, 020, 026.

#### T9. [NEW] 제안 카드 위젯 + 적용 재검증 — `src/components/editor/extensions/ai-suggestion-card.ts`

- `Decoration.widget({block:true})`(image-widget.ts WidgetType+ViewPlugin 확장). 원문 위 유지 + 즉석 지시 입력칸 + [✓ 바꾸기]/[↻ 다시]/[✕ 취소], 변환 계열 [⤵ 아래에 삽입], mermaid 미니 렌더(T7).
- **적용 dispatch 직전 원문 재검증**: `sliceDoc(from,to)`가 카드 생성 시점 원문과 일치 검사 후 단일 트랜잭션(REQ-AI-022, 035). 불일치 → 중단 카드.
- ↻ 3회 소진 → sonnet 인라인 폴백(REQ-AI-025). 빈/동일 제안 → "바꿀 곳 없어요"(REQ-AI-038).
- Reference: research.md §2.1 (image-widget.ts:82–198), §2.2 (changeByRange/dispatch), 설계서 §4.2, §4.3.
- **RED first**(`src/test/aiSuggestionApply.test.ts`, 가짜 view): 적용=단일 트랜잭션→undo 1회 복원, 원문 불일치→적용 차단, 빈 제안→무변경, 변환 계열 삽입. 매핑: REQ-AI-021, 022, 025, 035, 038.

#### T10. [NEW] 고스트 텍스트 + 섹션 채우기 — `src/components/editor/extensions/ai-ghost-text.ts`, [MODIFY] `markdown-extensions.ts`, `MarkdownEditor.tsx`

- 힌트: 문서 끝/빈 헤딩 아래 3초 멈춤 로컬 판정(토큰 0, REQ-AI-028), 클릭/`Mod-Enter` → 요청(REQ-AI-029). 빈 섹션은 아웃라인 + 본문 요지 컨텍스트.
- 고스트 = inline widget decoration, 스트리밍 표시 + [✓ 넣기]/[✕ 지우기]/[■ 중지]. 확정 = [넣기]/`Mod-Enter` 단일 트랜잭션(REQ-AI-030). **`Mod-Enter` keymap을 AI 확장 배열 앞쪽(높은 precedence)에 등록**, Tab은 기존 `indentWithTab` 유지(오버라이드 금지, REQ-AI-031). 문체 상속 프롬프트.
- Reference: research.md §2.3 (Mod- keymap precedence, indentWithTab markdown-extensions.ts:110), §2.1 (inline widget), 설계서 §5.
- **RED first**(`src/test/aiGhostConfirm.test.ts`, 가짜 view): Mod-Enter 확정→트랜잭션, Tab→들여쓰기+고스트 소멸, 타이핑→소멸, 힌트 로컬 판정(요청 없음). 매핑: REQ-AI-028, 029, 030, 031, 032.

#### T11. [MODIFY] AppLayout 배선 + 무손상·오류 UX 통합 — `src/components/layout/AppLayout.tsx`, `ai-suggestion-card.ts`

- AI 적용 핸들러 배선(viewRef null 가드), 설정 모달 마운트, useAiRelay 배선.
- 무통보 취소 금지 배너(REQ-AI-034), 스트리밍 중 원문 편집 배너(REQ-AI-036), Mod+S 독립(REQ-AI-039), 로그인 만료 카드→온보딩 재사용(REQ-AI-037), raw JSON 미노출(REQ-AI-040).
- Reference: research.md §1 (AppLayout viewRef·handleFormat 배선), 설계서 §9.
- **RED first**: 원문 편집 시 배너·Mod+S 유지·빈 제안 처리를 testing-library/가짜 view. 매핑: REQ-AI-033, 034, 036, 037, 039, 040.

#### T12. CSS + 품질 게이트 — `src/styles/mdedit-components.css`

- AI 카드·툴바·모달·고스트·배너 클래스(`--md-*` 토큰만, raw hex 금지, REQ-AI-010).
- 전체 vitest + Rust 유닛 + `tsc --noEmit` 클린 + 기존 Playwright 무변경. `npm run lint` 게이트 제외. **Windows 단축키·스폰 지연 수동 실측**(설계서 §11).

### 실행 순서 및 의존성

```
M0:  T1(파싱) ─┐
     T2(스폰) ─┼→ T3(감지·state·lib) → T4(프론트 릴레이) → T5(설정 모달·온보딩)
                                                                    │
M1:  T6(길이가드) ┐                                                  │
     T7(mermaid) ┘→ T8(✨ 툴바) → T9(제안 카드·재검증) ─┐            │
                     T10(고스트·섹션) ──────────────────┼→ T11(배선·오류 UX) → T12(CSS·게이트)
                                                        ┘  ← T5 완료 후
```

우선순위: T1/T2(스트리밍 릴레이 핵심 리스크, 최우선 프로토타입) > T3/T4(인프라) > T5(설정) > T6/T7(순수 함수, 독립) > T8/T9/T10(UX) > T11(통합) > T12(게이트).

## Risk Analysis & Mitigation

| # | 리스크 | 영향 | 완화 |
|---|--------|------|------|
| 1 | **AI 스트리밍 릴레이 완전 신규** — stdout 파이프 캡처·라인 스트리밍·자식 kill 선례 없음(research.md §3) | M0 전체 지연 | T1/T2를 watcher.rs 스레드+emit 패턴 재활용해 **최우선 프로토타입**. 파싱은 순수 함수 분리(T1)로 릴레이와 독립 검증 |
| 2 | **저사양 Windows + 백신 cold start** — 매 요청 프로세스 스폰 지연(설계서 §11, 부록 A는 macOS만) | 인라인/이어쓰기 가치 훼손 | M0에서 Windows 실측(기동/추론 분리). 병목이 스폰이면 상주 워밍 프로세스 검토(범위 밖, 후속) |
| 3 | **CSP null**(tauri.conf.json, research.md §3) — 카드 렌더 시 AI 출력·사용자 문서 escape | XSS | mermaid `securityLevel:'strict'` 유지(T7, @MX:WARN), 카드는 텍스트 노드/escape, render SVG만 제한적 innerHTML |
| 4 | **claude 임의 경로 실행 보안**(research.md §3) | 임의 명령 실행 표면 | 격리 cwd + `--setting-sources ""` + env 차단(T2). expert-security 검토 권고(@MX:WARN) |
| 5 | **CLI 출력 포맷 변경(버전업)** | 파싱 깨짐 | 최종 `result` 필드 2차 파싱 + 실패 시 raw 미노출 오류 카드(T1, REQ-AI-040) |
| 6 | **프론트매터 포맷터 손상**(memory·설계서 §1) | .md 쓰기 손상 | AI는 사용자 트리거 dispatch만, 프론트매터 자동 갱신 금지. SPEC 문서 커밋은 checkout→edit→add 단일 Bash |
| 7 | **Tab 오버라이드 문서 파손**(시뮬레이션 치명 결함) | 통짜 삽입·복구 실패 | Tab을 확정 키에서 제외(T10, REQ-AI-031), 확정은 Mod-Enter/버튼. keymap precedence로 `indentWithTab` 보존 |
| 8 | **haiku 품질 천장** | "ChatGPT가 낫네" 이탈 | ↻ 3회 소진 시 sonnet 인라인 폴백(T9) + 설정 고급 모델 토글(T5) |
| 9 | **Tauri IPC가 Playwright에서 미실행**(research.md §4) | E2E로 스트리밍 검증 불가 | Rust 유닛(T1/T2/T3) + 가짜 view vitest(T9/T10) + 수동 검증으로 커버. E2E는 렌더/상호작용 위주 |

## Tech Stack / Dependencies

- **신규 런타임 의존성 없음 예상**: `@codemirror/*`(view·state·commands·autocomplete 설치됨), `mermaid@11.12.3`(핀+patch), `zustand ^5`, Tauri `shell:allow-execute/spawn`(main.json) 모두 확보. T0(M0 착수 시) `package.json`/`Cargo.toml` 최종 확인 후 이 가정을 검증하고, 위반 시 사용자 확인 게이트.
- Rust 표준 라이브러리 `std::process::Command` + `std::thread` + `std::sync::Mutex`로 스폰·릴레이(신규 crate 불필요 예상).

## MX Tag Plan

spec.md `mx_plan` 섹션과 동일. 요약: `@MX:ANCHOR`(적용/확정 트랜잭션 경로, stream.rs 파서), `@MX:WARN`(프로세스 스폰·mermaid strict·CSP escape), `@MX:NOTE`(토큰 상한·프리셋 프롬프트·길이 가드). `@MX:SPEC: SPEC-AI-001` 공통.

## Quality Gates (TDD)

- RED-GREEN-REFACTOR 준수, 순수 함수(T1/T2 인자 조립/T3 경로/T6/T7) 및 트랜잭션 로직(T9/T10) 테스트 선행 필수.
- 커밋당 커버리지 80%+, 전체 목표 85%.
- `tsc --noEmit` 클린 + 전체 vitest(신규 Rust 유닛 포함) + 기존 Playwright(webkit) 무변경 통과.
- `npm run lint` 게이트 제외(eslint config 부재, 알려진 제약).
- **Windows 수동 실측**: 단축키 Ctrl 매핑 + 저사양/백신 스폰 지연(M0 완료 조건, 설계서 §11).
- LSP run 게이트: errors 0 / type errors 0 / lint errors 0.

## Reference (research.md file:line)

- `src/components/editor/extensions/image-widget.ts`:82–198 — 위젯 원형(제안 카드/고스트)
- `src-tauri/src/commands/watcher.rs`:104–140 — 스레드+emit 스트리밍 릴레이 선례
- `src-tauri/src/commands/browser_ops.rs`:20–23 — 프로세스 스폰 선례(fire-and-forget)
- `src/components/preview/PreviewRenderer.tsx`:114 — mermaid.parse 사전 검증 + strict
- `src/components/editor/EditorToolbar.tsx`:97–178 — 팝오버 외부클릭+Esc(✨ 툴바·프리셋)
- `src/components/editor/extensions/keyboard-shortcuts.ts`:16–52 — changeByRange/dispatch 트랜잭션
- `src/components/editor/extensions/markdown-extensions.ts`:107–110 — history/indentWithTab, keymap precedence
- `src/components/layout/AppLayout.tsx`:163,187–190 — viewRef 소유·onViewReady 배선
- `src/store/uiStore.ts`:72–129 — persist/partialize/module-ref 관례(aiStore 비영속)
- `src/lib/tauri/ipc.ts` — invoke 단일 계층(ai 래퍼 추가 지점)
- `src/hooks/useFileWatcher.ts`:68–79 — listen/unlisten 훅 구조(useAiRelay 복제)
- `src-tauri/src/lib.rs`:35–55 — invoke_handler 등록·setup()
- `src-tauri/src/state/app_state.rs` — Mutex managed state(in-flight 핸들)
- `src-tauri/capabilities/main.json` — shell 권한 확보
- `src/styles/mdedit-tokens.css` — `--md-*` 토큰(카드·모달·패널 승계)
- `src/test/insertTable.test.ts`:15–26 — 가짜 view CM 단위 테스트 패턴
- 설계서 부록 A.1 — claude 스폰 커맨드·스트림 포맷 실측

## Related Documents

- `spec.md` — EARS 요구사항(REQ-AI-001 ~ 040, 5개 모듈)
- `acceptance.md` — Given-When-Then(AC-AI-001 ~ 020) + 엣지 케이스 + 품질 게이트
- `spec-compact.md` — Run phase용 압축본
- `research.md` — 코드베이스 통합 분석(file:line 근거)
