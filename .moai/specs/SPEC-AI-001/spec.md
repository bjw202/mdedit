---
id: SPEC-AI-001
version: "0.1.1"
status: draft
created: "2026-07-16"
updated: "2026-07-16"
author: "jw"
priority: high
issue_number: 13
dependencies: []
tags:
  - ai
  - editor
  - tauri
  - codemirror
lifecycle: spec-anchored
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-07-16 | jw | 최초 SPEC 작성 — AI 기능 MVP M0+M1. 설계서 `.moai/design/ai-features-mvp-design.md` v0.4 확정 범위. M0 = Rust `ai/` 모듈(claude CLI 어댑터·스트리밍 릴레이·감지·설정 모달·연결 온보딩·정책 kill-switch·Windows 우선 검증), M1 = 축1 인라인 편집(✨ 선택 편집·프리셋 5종·제안 카드·적용 안전장치·선택 길이 가드·mermaid 사전 검증) + 시나리오 F 빈 섹션 채우기(고스트, Mod+Enter 확정, Tab 확정 아님). 사용자 확정 결정 5건 반영: (1) MVP는 claude CLI 단독(codex는 M4, AiProvider trait 계약만 확정), (2) 설정 UI = 새 설정 모달 다이얼로그(Header 톱니 버튼), (3) 프리셋 = 다듬기/개요로 정리/표로 만들기/다이어그램으로/짧게 줄이기(+직접 입력), 번역 프리셋 없음, (4) Tab은 고스트 확정 키 아님(indentWithTab 유지, 확정 = 넣기 버튼/Mod+Enter), (5) 모든 단축키 CodeMirror `Mod-` 접두어, 주 검증 플랫폼 Windows. 방법론 TDD(RED-first). M2/M3/M4는 Exclusions. |
| 0.1.1 | 2026-07-16 | jw | plan-audit 리뷰(SPEC-AI-001-review-1, FAIL 0.72) 반영. **D1** REQ-AI-001(AiProvider trait 계약)에 AC-AI-021 신설·매핑. **D2** REQ-AI-016(고급 모델 sonnet 지속 토글, REQ-AI-025의 3회 폴백과 구분)에 AC-AI-022 신설 + acceptance.md 전용 Given/When/Then 추가. 전 REQ-AI-001~040이 최소 1개 AC 보유 확인, "1:1 매핑" 문구를 "전 REQ 최소 1개 AC 매핑"으로 정정(자기모순 제거). **D3** REQ-002/017/023의 하드코딩(`--setting-sources ""`·`MDEDIT_AI_DISABLED`·`securityLevel:'strict'`)을 행동 서술 + "설계 제약" 표기로 이동. **D4** REQ-AI-001 복합 요구(trait 계약 형태 절) 축소 → Design Notes 포인터. **D5** unwanted 7건(008/009/018/027/031/032/040)을 "If … then the system shall …" 정규 EARS 형태로 재서술. REQ-AI-008 원문 침범 상호참조 오류(REQ-AI-030→036) 정정. |

## Summary

`mdedit`(Tauri 2 + React 18 + CodeMirror 6 + zustand)에 로컬 설치 `claude` CLI(`claude -p`)를 백엔드로 하는 AI 기능의 첫 출시 묶음(M0+M1)을 추가한다. 앱은 API 키를 다루지 않고, 요청마다 CLI 프로세스를 빈 스크래치 디렉토리에서 스폰해 stdout 델타를 Tauri 이벤트(`ai://chunk|done|error`)로 프론트에 릴레이한다.

- **M0 (기반)**: `AiProvider` trait 어댑터 구조(claude 단독 구현) + 프로세스 스폰·스트리밍·취소·동시 1개 제한, CLI 감지(설치·버전·**로그인 상태 선제 판정**), 새 설정 모달 다이얼로그(Header 톱니 버튼 → AI 섹션), 연결 온보딩 위저드, 1회성 데이터 전송 고지 배너, 조직 정책 kill-switch(`MDEDIT_AI_DISABLED`), Windows 우선 단축키·스폰 지연 검증.
- **M1 (인라인 편집 + 섹션 채우기)**: 텍스트 선택 시 ✨ 진입 버튼 + 프리셋 메뉴(다듬기 / 개요로 정리 / 표로 만들기 / 다이어그램으로 / 짧게 줄이기 + 직접 입력), 스트리밍 제안 카드(즉석 지시 입력 + ↻ 3회 소진 시 sonnet 인라인 폴백), 단일 트랜잭션 적용(Mod+Z 1회 복원) + dispatch 직전 원문 재검증 + 선택 길이 가드 + mermaid 삽입 전 로컬 파서 검증, 그리고 빈 섹션/문서 끝에서 고스트 텍스트로 초안을 채우는 시나리오 F(Mod+Enter/버튼 확정, Tab은 확정 키 아님).

모든 실패는 문서를 건드리지 않으며(무손상 원칙), 문서 변경은 오직 사용자의 [바꾸기/넣기/삽입] 확정으로만 발생하고 그 위치·범위는 카드·하이라이트에서 확인한 것과 정확히 일치해야 한다.

## 핵심 설계 결정 (사용자 승인, 재검토 금지)

1. **MVP는 claude CLI 단독.** codex는 후속(M4)으로 이관하되 `AiProvider` trait 계약(`capabilities()` 포함)은 지금 확정해 M4에서 어댑터 추가만으로 붙게 한다. codex 관련 UX 분기(무스트리밍 스피너·degraded 라벨)는 전부 범위 밖.
2. **설정 UI = 새 설정 모달 다이얼로그.** Header에 톱니(설정) 버튼을 추가하고, 클릭 시 모달이 열리며 첫 섹션이 AI다. 헤더 인라인 컨트롤도, 우측 패널 탭도 아니다.
3. **프리셋 5개 고정 + 직접 입력.** 다듬기 / 개요로 정리 / 표로 만들기 / 다이어그램으로 / 짧게 줄이기. 번역 프리셋은 도입하지 않으며 필요 시 "직접 입력"으로 처리한다.
4. **Tab은 고스트 확정 키가 아니다.** 마크다운 에디터의 Tab은 들여쓰기(`indentWithTab`)로 유지한다. 고스트 확정은 [✓ 넣기] 버튼 또는 요청 키를 한 번 더 누르는 `Mod+Enter`로 통일한다(설계서 §5, 시뮬레이션의 Tab 오버라이드 문서 파손 사례 근거).
5. **모든 단축키는 CodeMirror `Mod-` 접두어로 정의**하여 macOS ⌘ / Windows·Linux Ctrl로 자동 매핑한다. 주 사용 환경이 Windows이므로 모든 단축키·스폰 지연은 **Windows에서 우선 검증**한다.
6. **기본 모델 haiku 고정**(속도·비용), 설정에 "고급 모델(sonnet)" 토글 + ↻ 재요청 3회 소진 시 1회성 sonnet 인라인 폴백 제안.
7. **개발 방법론 = TDD(RED-first)** (`quality.yaml` `development_mode: tdd`). Rust 스트림 파싱·가드는 순수 함수로 분리해 유닛 테스트 선행, CodeMirror 트랜잭션 로직은 `insertTable.test.ts`의 가짜 view 방식으로 테스트 선행.

## Background & Rationale

설계서 v0.4는 마크다운 편집의 3가지 마찰(고치기 번거로운 문장 / 막힌 진도 / 문서 질문) 중 첫 출시로 인라인 편집과 빈 섹션 채우기를 선택했다. 킬러 유스케이스는 절차 문단 → mermaid 다이어그램 변환(앱의 기존 mermaid 투자와 직접 시너지)이다. 아래는 코드베이스 통합 근거(research.md file:line)다.

- **CodeMirror widget 선례**: `src/components/editor/extensions/image-widget.ts`가 제안 카드/고스트 텍스트의 직접 원형이다 — `WidgetType` 서브클래스 + `toDOM()`(image-widget.ts:82–140), `ViewPlugin.fromClass` + `RangeSetBuilder<Decoration>`(image-widget.ts:155–198), `atomicRanges`(image-widget.ts:193–197). 뷰 레이어 전용이라 문서 텍스트를 오염시키지 않는다(설계서 §4.3 block widget 요구와 일치).
- **트랜잭션 dispatch(P5 무손상)**: `state.changeByRange` 후 `view.dispatch` + `EditorSelection.range`로 삽입 텍스트 선택(keyboard-shortcuts.ts:16–52, insertTable 119–145). `history()`/historyKeymap이 번들에 포함되어(markdown-extensions.ts:107–110) Undo 스택이 무료로 확보된다.
- **스트리밍 릴레이 선례**: `src-tauri/src/commands/watcher.rs`가 별도 스레드에서 `app_handle.emit()`으로 이벤트를 릴레이하고(watcher.rs:95,138) 프론트가 `listen<T>` 후 unlisten을 반환한다(useFileWatcher.ts:68–79). `ai://chunk|done|error`는 이 패턴을 그대로 확장한다. 다만 stdout 파이프 캡처·자식 프로세스 kill·라인 스트리밍은 선례가 없어 M0의 핵심 신규성이다(스폰 자체는 browser_ops.rs:20–23 fire-and-forget만 존재).
- **Mod- 키맵 자동 매핑**: 모든 기존 단축키가 `Mod-s`/`Mod-Shift-i`/`Mod-b`로 정의되어(MarkdownEditor.tsx:113–218) 플랫폼 자동 매핑이 코드 레벨에서 이미 만족된다. Tab은 `indentWithTab`으로 바인딩되어(markdown-extensions.ts:110) 설계서 §5의 "Tab 확정 키 제외"와 정합한다.
- **mermaid 사전 검증**: `PreviewRenderer.tsx:114`가 render 전 `await mermaid.parse(diagram)`를 호출한다 — 설계서 §4.2 시나리오 C의 "삽입 전 로컬 파서 검증"이 이미 구현되어 있어 재사용 가능하다. `MERMAID_BASE_CONFIG={startOnLoad:false, securityLevel:'strict'}` 고정은 약화 금지(XSS).
- **zustand 컨벤션**: 트랜지언트 값은 `persist`의 `partialize`에서 제외(uiStore.ts:123–126) → aiStore 스트림 버퍼·요청 상태는 비영속. EditorView는 store에 넣지 않고 AppLayout이 `viewRef`(useRef)로 소유한다(AppLayout.tsx:163, @MX 주석 "NOT stored in Zustand").
- **설정 UI 부재**: 전용 설정 화면이 없고 설정성 컨트롤이 Header.tsx에 인라인 렌더된다(Header.tsx:171–188) → 설계서 §8.2의 AI 설정·온보딩·고지 배너는 새 모달 다이얼로그가 필요하다(핵심 설계 결정 2).
- **팝오버 선례**: `TableGridPicker`(EditorToolbar.tsx:97–178)가 relative 래퍼 + `absolute z-50` + 외부 mousedown/Escape 양쪽 닫기를 제공한다 → ✨ 선택 툴바·프리셋 메뉴의 직접 선례. 우클릭 중복 노출은 FileTreeNode.tsx:156–158의 `onContextMenu` 좌표 팝업 선례를 재사용한다.
- **테마 토큰**: `mdedit-tokens.css`의 `--md-*` 시맨틱 롤만 사용하면 카드·모달·패널이 다크/라이트 자동 대응(SPEC-UI-006, raw hex 금지). 채팅앱풍 별도 시각 언어 도입 금지(설계서 §6.0).

## Environment & Assumptions

- **백엔드**: Rust / Tauri 2. `capabilities/main.json`에 `shell:allow-execute`/`shell:allow-spawn` 이미 허용. `ai://` 이벤트는 `emit`이라 추가 capability 불필요.
- **CLI 실측 기준**(설계서 부록 A, macOS): `claude -p <prompt> --system-prompt <sys> --model haiku --output-format stream-json --include-partial-messages --verbose --setting-sources ""` + env `MAX_THINKING_TOKENS=0`, 빈 스크래치 cwd. 첫 텍스트 ~2.3초 / 완료 ~2.7초 / 건당 $0.0078. 스트림 라인 `stream_event → content_block_delta → text_delta`에서 `text` 추출, 종료 `result.subtype=success`. **저사양 Windows + 실시간 백신 환경은 미검증 — M0에서 보완 실측**(설계서 §11 리스크).
- **프론트엔드**: React 18, TypeScript strict, CodeMirror 6(`@codemirror/view ^6.39`, autocomplete ^6.20 설치됨), zustand ^5, `mermaid@11.12.3`(핀 + patch-package). 신규 런타임 의존성은 없을 것으로 예상한다(plan.md에서 확인).
- **테스트**: vitest(jsdom) + Playwright(webkit 단일). `insertTable.test.ts`의 가짜 view 스텁으로 CodeMirror 트랜잭션을 DOM 없이 검증. Rust는 각 command 하단 `#[cfg(test)] mod tests`로 순수 함수 검증. Tauri IPC는 Playwright에서 실행되지 않으므로 스트리밍 릴레이는 Rust 유닛 + 수동 검증에 의존한다.
- **알려진 제약**: `npm run lint`는 eslint config 부재로 main 포함 항상 실패한다(package.json:17) — 실질 게이트는 `tsc --noEmit` + `vitest run` + Playwright이며, lint 실패를 회귀로 오판하지 않는다.
- **프론트매터 포맷터 충돌**: `.md` 쓰기 시 포맷터가 프론트매터를 손상시킨 이력이 있어, AI는 프론트매터 자동 갱신을 하지 않는다(설계서 §1 비목표).

## Requirements (EARS)

### 모듈 1 — AI 기반 인프라 (스폰·스트리밍·취소·동시 1개)

#### Ubiquitous

- **REQ-AI-001**: The system **shall** 모든 AI 요청을 `AiProvider` trait 어댑터를 통해 처리하고, MVP에서는 claude 어댑터 하나만 등록한다. (trait 계약 형태 — id/detect/spawn/capabilities — 는 Design Notes 참조)
- **REQ-AI-002**: The system **shall** 모든 AI CLI 프로세스를 앱 전용 빈 스크래치 디렉토리에서 스폰하고, 사용자·프로젝트 설정과 사고 토큰이 요청에 개입하지 않도록 격리해 실행한다. (설계 제약: `--setting-sources ""` + env `MAX_THINKING_TOKENS=0`; Environment & Assumptions·부록 A.1 참조)
- **REQ-AI-003**: The system **shall** 프롬프트 조립(기능별 템플릿 + 컨텍스트 상한 절단)을 Rust 백엔드에서 수행하고, 프론트는 기능 종류와 텍스트 조각만 전달한다.

#### Event-Driven

- **REQ-AI-004**: **WHEN** 프론트가 AI 요청을 보내면, **the system shall** CLI 프로세스를 스폰하고 stdout 델타를 `ai://chunk` 이벤트로 순차 릴레이하며, 완료 시 `ai://done`, 실패 시 원인이 분류된 `ai://error`를 emit한다.
- **REQ-AI-005**: **WHEN** 사용자가 진행 중 요청을 취소하면, **the system shall** 해당 CLI 프로세스를 종료(kill)하고 요청 상태를 취소로 전환한다.
- **REQ-AI-006**: **WHEN** 진행 중(in-flight) 요청이 있는 상태에서 새 AI 요청이 시작되면, **the system shall** 기존 in-flight 요청을 자동 취소하되 취소된 쪽에 "새 요청으로 취소되었어요"를 명시하는 표시를 남긴다.

#### State-Driven

- **REQ-AI-007**: **WHILE** AI 응답이 스트리밍되는 동안, **the system shall** 수신 델타를 타이핑되듯 점진 표시하고 항상 보이는 취소 수단(Esc/버튼)을 제공하며 UI를 블로킹하지 않는다.

#### Unwanted Behaviour

- **REQ-AI-008**: **IF** 진행 중 요청이 있는 상태에서 새 요청이 시작되거나 동시 1개 제한이 적용되면, **then the system shall** 취소 대상을 in-flight 요청으로만 한정하고 검토 대기 중인 제안 카드를 유지한다(검토 카드는 사용자의 취소·적용 또는 원문 범위 침범(REQ-AI-036) 시에만 사라진다).
- **REQ-AI-009**: **IF** 한 요청이 in-flight 상태인데 새 요청이 시작되면, **then the system shall** 기존 프로세스를 정리한 뒤에만 새 프로세스를 스폰하여 동시에 2개 이상의 AI CLI 프로세스가 in-flight 되지 않게 한다.

### 모듈 2 — 감지·설정·온보딩·정책

#### Ubiquitous

- **REQ-AI-010**: The system **shall** 앱의 기존 디자인 토큰(`--md-*`)만으로 설정 모달·온보딩·AI UI를 렌더하여 다크/라이트 테마에 자동 대응하고, 채팅앱풍 별도 시각 언어를 도입하지 않는다.

#### Event-Driven

- **REQ-AI-011**: **WHEN** 사용자가 Header의 설정(톱니) 버튼을 클릭하면, **the system shall** 설정 모달 다이얼로그를 열고 첫 섹션으로 AI 설정을 표시한다.
- **REQ-AI-012**: **WHEN** AI 감지가 실행되면, **the system shall** claude CLI의 설치 여부·버전과 함께 **로그인 상태를 실제 AI 호출 전에 선제 판정**하여(세션 파일 존재·유효성 확인, 판정 불가 시 앱 시작 후 경량 프로브 1회) 결과를 프론트에 제공한다.
- **REQ-AI-013**: **WHEN** claude가 설치·로그인 완료로 최초 활성화되면, **the system shall** "선택 텍스트와 문서 일부가 처리를 위해 전송된다"는 데이터 전송 고지 배너를 1회 표시한다.
- **REQ-AI-014**: **WHEN** 미설치 또는 미로그인 사용자가 연결 온보딩에 진입하면, **the system shall** OS 감지(Windows 우선) → 설치 명령 복사 → 터미널 안내 → 로그인 안내 → [다시 확인] 자동 재감지의 단계별 위저드를 앱 내에서 제공한다.

#### State-Driven

- **REQ-AI-015**: **WHILE** claude가 설치되었으나 미로그인 상태인 동안, **the system shall** ✨ 진입점을 숨기지 않고 "연결 필요" 상태로 표시하며, 클릭 시 앱 내 연결 안내 모달을 연다.
- **REQ-AI-016**: **WHILE** "고급 모델 사용" 설정이 켜져 있는 동안, **the system shall** AI 요청 모델을 sonnet으로 사용한다(기본은 haiku).
- **REQ-AI-017**: **WHILE** 조직 정책 kill-switch가 활성인 동안, **the system shall** 모든 AI 기능을 강제 비활성화하고 설정 토글을 잠금 표시한다. (설계 제약: 환경변수 `MDEDIT_AI_DISABLED=1` 또는 설정 디렉토리 정책 파일로 활성화)

#### Unwanted Behaviour

- **REQ-AI-018**: **IF** 사용자가 미설치·미로그인이라 연결 안내가 필요하면, **then the system shall** 앱 내 위저드로 안내를 완결하고 [다시 확인]으로 재감지하며, "터미널에서 claude를 실행하세요" 식의 미완결 지시로 사용자를 앱 밖에 방치하지 않는다.

### 모듈 3 — 인라인 편집 UX (✨·프리셋·카드·적용 안전장치)

#### Event-Driven

- **REQ-AI-019**: **WHEN** 사용자가 에디터에서 텍스트를 선택하면, **the system shall** 선택 영역 끝에 ✨ 진입 버튼을 표시하고 우클릭 컨텍스트 메뉴에도 "✨ AI로 편집" 항목을 중복 노출한다.
- **REQ-AI-020**: **WHEN** 사용자가 ✨ 버튼을 열면, **the system shall** 고정 프리셋 5종(다듬기 / 개요로 정리 / 표로 만들기 / 다이어그램으로 / 짧게 줄이기)과 "직접 입력..." 항목을 표시하고, "직접 입력..." 선택 시 한 줄 입력창으로 전환하며 Esc 또는 ← 버튼으로 프리셋 메뉴에 복귀할 수 있게 한다.
- **REQ-AI-021**: **WHEN** 프리셋 또는 직접 입력으로 편집 요청이 완료되면, **the system shall** 원문을 그대로 위에 두고 제안 카드에 결과를 표시하며, 카드에 즉석 방향 지시 입력칸과 [✓ 바꾸기]·[↻ 다시]·[✕ 취소] 동작을 제공한다(변환 계열은 [⤵ 아래에 삽입] 포함).
- **REQ-AI-022**: **WHEN** 사용자가 제안 카드의 [✓ 바꾸기] 또는 [삽입]을 확정하면, **the system shall** 변경을 단일 CodeMirror 트랜잭션으로 적용하여 Undo(Mod+Z) 한 번에 원문이 복원되게 한다.
- **REQ-AI-023**: **WHEN** 사용자가 "다이어그램으로"를 요청하면, **the system shall** 삽입 전 로컬 mermaid 파서로 코드를 스크립트 실행이 차단된 안전 모드에서 검증하고, 성공 시 카드에 코드블록과 미니 렌더 미리보기를 함께 표시한다. (설계 제약: `securityLevel:'strict'` 유지, XSS 방지)
- **REQ-AI-024**: **WHEN** "다이어그램으로" 결과의 mermaid 검증이 실패하면, **the system shall** 오류 메시지를 동봉해 1회 자동 재요청하고, 재실패 시 "목록으로 정리" 대체 산출물을 제안한다.
- **REQ-AI-025**: **WHEN** ↻ 방향 없는 재요청이 연속 3회 소진되면, **the system shall** 방향 지시 입력을 안내하고 설정 진입 없이 1회성 sonnet 재시도(고급 모델)를 인라인 제안한다.

#### State-Driven

- **REQ-AI-026**: **WHILE** 선택 텍스트가 편집 프리셋 상한(2,000자)을 초과하는 동안, **the system shall** 편집(교체) 프리셋을 비활성화하고 "문단 단위로 나눠 선택" 안내를 표시한다. 요약·변환 계열(짧게 줄이기·개요로 정리·표로 만들기)은 4,000자까지 허용하되 결과는 "아래에 삽입"만 가능하게 한다.

#### Unwanted Behaviour

- **REQ-AI-027**: **IF** 선택 텍스트가 편집 프리셋 상한을 초과하면, **then the system shall** 절단된 결과로 선택 전체를 교체하지 않고 REQ-AI-026의 가드로 처리한다(절단 교체로 인한 무손실 삭제 금지).

### 모듈 4 — 섹션 채우기 (고스트)

#### Event-Driven

- **REQ-AI-028**: **WHEN** 커서가 문서 끝(마지막 비어있지 않은 줄 이후) 또는 빈 헤딩 바로 아래에서 3초 이상 멈추면, **the system shall** 토큰을 소모하지 않는 로컬 판정만으로 클릭 가능한 힌트 버튼(문서 끝: "이어쓰기", 빈 섹션: "이 섹션 채우기")을 단축키 표기와 함께 표시한다.
- **REQ-AI-029**: **WHEN** 사용자가 힌트 버튼을 클릭하거나 `Mod+Enter`를 누르면, **the system shall** 이 시점에 처음으로 AI 요청을 발생시키고(빈 섹션은 문서 아웃라인 + 본문 요지를 근거로), 문서 문체·종결어미를 상속하도록 지시한 결과를 회색 고스트 텍스트로 스트리밍하며 [✓ 넣기]·[✕ 지우기]·[■ 중지]를 항상 표시한다.

#### State-Driven

- **REQ-AI-030**: **WHILE** 고스트 텍스트가 활성인 동안, **the system shall** [✓ 넣기] 클릭 또는 `Mod+Enter` 재입력으로만 고스트를 실제 텍스트로 확정(단일 트랜잭션)하고, [✕ 지우기]·Esc 또는 사용자 타이핑 시 고스트를 소멸시킨다.

#### Unwanted Behaviour

- **REQ-AI-031**: **IF** 고스트 텍스트가 활성인 상태에서 Tab 키가 눌리면, **then the system shall** Tab을 기존 들여쓰기(`indentWithTab`)로 처리하고 고스트를 소멸시킨다(Tab을 확정 키로 오버라이드하지 않는다).
- **REQ-AI-032**: **IF** 사용자의 명시적 버튼 클릭 또는 단축키 입력이 없으면, **then the system shall** 어떤 AI 요청도 발생시키지 않는다(키 입력마다 호출하는 커서급 자동완성·자동 트리거 없음).

### 모듈 5 — 오류·무손상 원칙

#### Ubiquitous

- **REQ-AI-033**: The system **shall** 어떤 AI 실패에서도 문서를 변경하지 않는다. 문서 변경은 오직 사용자의 [바꾸기/넣기/삽입] 확정으로만 발생하며, 변경 위치·범위는 사용자가 카드·하이라이트에서 확인한 것과 정확히 일치한다.
- **REQ-AI-034**: The system **shall** AI 요청·제안 카드가 사라질 때 반드시 이유를 명시한 배너/카드로 사용자에게 알린다(무통보 자동 취소 금지).

#### Event-Driven

- **REQ-AI-035**: **WHEN** 제안 적용 dispatch 직전에 대상 범위의 현재 텍스트가 카드 생성 시점의 원문과 일치하지 않으면, **the system shall** 적용을 중단하고 "원문이 바뀌어 적용할 수 없어요" 카드를 표시한다.
- **REQ-AI-036**: **WHEN** 스트리밍 중 사용자가 대상 원문 범위를 편집하면, **the system shall** 무통보 취소 대신 "원문이 편집되어 이 제안을 멈췄어요 [무시] [다시 요청]" 배너를 표시한다(범위 밖 편집은 요청에 영향 없음).
- **REQ-AI-037**: **WHEN** 사용 중 CLI 로그인이 만료되면, **the system shall** 원문을 손상시키지 않고 "로그인이 풀렸어요 [연결 안내 보기]" 카드로 온보딩 모달을 재사용하며, stderr 분류로 로그인 만료 / 네트워크 차단 / 기타를 구분한다.
- **REQ-AI-038**: **WHEN** 제안 결과가 빈 문자열이거나 원문과 동일하면, **the system shall** "바꿀 곳이 없어요" 카드를 표시하고 빈 교체를 수행하지 않는다.

#### State-Driven

- **REQ-AI-039**: **WHILE** AI 응답이 스트리밍되는 동안 사용자가 문서를 저장(Mod+S)하면, **the system shall** 저장을 AI 요청과 독립적으로 처리하고 진행 중 요청을 유지한다.

#### Unwanted Behaviour

- **REQ-AI-040**: **IF** CLI 출력 스트림 파싱이 실패하면(버전업 등), **then the system shall** 최종 `result` 필드로 2차 파싱을 시도하고 그마저 실패하면 raw JSON을 노출하지 않는 오류 카드("도구 업데이트로 문제가 생겼어요")를 표시한다.

## Design Notes / Future Considerations

> 아래는 요구사항(AC 대상)이 아니며 Run phase 설계 참고 사항이다.

- **AiProvider trait 형태**: `id() / detect() -> ProviderStatus / spawn(prompt) -> ChildStream / capabilities() -> Capabilities`. `capabilities.supports_streaming`은 claude에서 true, codex(M4)에서 false 분기. 구체 시그니처는 Run phase 재량.
- **스트림 파싱 순수 함수화**: `stream_event.content_block_delta.text_delta` 추출과 stderr 원인 분류를 순수 함수로 분리해 Rust 유닛 테스트로 커버(plan.md T1). `ai://error` payload는 원인 enum 필드를 갖는다.
- **in-flight 관리**: AppState에 `Mutex<Option<Child>>`를 추가(watcher 관리와 동형), `ai_cancel` = `child.kill()`. 구현 세부는 Run phase.
- **힌트/요청 분리**: 3초 멈춤 힌트는 커서 위치·타이머 계산만의 순수 프론트 로직(토큰 0). 실제 요청은 REQ-AI-029 트리거에서만 발생.
- **커서급 자동완성**: CLI 요청당 첫 응답 2.3초 + 입력 12~18K 고정 오버헤드로 구조적으로 불성립(설계서 §5.2). 상주 세션/저지연 API 전제의 별도 설계가 필요하며 MVP 범위 밖.
- **문서 대화 위치 확정(시나리오 H)**: exact-match 자동 교체 금지 등 M3 설계 상수는 본 SPEC 범위 밖이나, 무손상 원칙(REQ-AI-033)의 연장선이다.

## Delta (Brownfield Changes)

| Delta | 파일 | 변경 내용 |
|-------|------|-----------|
| [NEW] | `src-tauri/src/ai/mod.rs` | AI 커맨드(`ai_request`/`ai_cancel`/`ai_detect_providers`/`ai_policy_status`) + 모듈 배럴 |
| [NEW] | `src-tauri/src/ai/provider.rs` | `AiProvider` trait + `ProviderStatus`/`Capabilities` 타입(claude 단독, M4 codex 대비 계약) |
| [NEW] | `src-tauri/src/ai/claude_cli.rs` | claude 어댑터 — 빈 스크래치 cwd 스폰, stdout 파이프 리더 스레드, 델타 emit |
| [NEW] | `src-tauri/src/ai/detect.rs` | `claude --version` + 로그인 세션 파일 선제 판정(크로스플랫폼 경로) |
| [NEW] | `src-tauri/src/ai/prompt.rs` | 기능별 프롬프트 템플릿 + 컨텍스트 조립·상한 절단(순수 함수) |
| [NEW] | `src-tauri/src/ai/stream.rs` | stream-json 라인 파싱 + stderr 원인 분류(순수 함수, 유닛 테스트 대상) |
| [MODIFY] | `src-tauri/src/lib.rs` | `invoke_handler`에 ai 커맨드 등록(lib.rs:35–55), `.setup()`에서 정책 kill-switch 1회 프로브 |
| [MODIFY] | `src-tauri/src/state/app_state.rs` | in-flight `Mutex<Option<Child>>` 핸들 보관 |
| [NEW] | `src/store/aiStore.ts` | 요청 상태(idle/streaming/done/error) + 스트림 버퍼 + 취소 핸들(비영속) |
| [MODIFY] | `src/lib/tauri/ipc.ts` | `aiRequest`/`aiCancel`/`aiDetectProviders`/`aiPolicyStatus` invoke 래퍼 |
| [NEW] | `src/hooks/useAiRelay.ts` | `ai://chunk|done|error` listen 훅(useFileWatcher 구조 복제, module-ref unlisten) |
| [NEW] | `src/components/editor/extensions/ai-selection-toolbar.ts` | ✨ 선택 툴바 + 프리셋 메뉴(팝오버 선례 복제) |
| [NEW] | `src/components/editor/extensions/ai-suggestion-card.ts` | 제안 카드 block widget(즉석 지시 입력·미니 mermaid 렌더·적용 재검증) |
| [NEW] | `src/components/editor/extensions/ai-ghost-text.ts` | 고스트 텍스트 inline widget + `Mod-Enter` keymap(확장 앞쪽 등록) |
| [NEW] | `src/components/editor/extensions/ai-length-guard.ts` | 선택 길이 가드(2K/4K 분기, 순수 함수) |
| [MODIFY] | `src/components/editor/extensions/markdown-extensions.ts` | AI 확장 번들 등록(고스트 keymap을 `indentWithTab`보다 높은 precedence로) |
| [MODIFY] | `src/components/editor/MarkdownEditor.tsx` | AI keymap·확장 배선, onViewReady 유지 |
| [NEW] | `src/components/settings/SettingsModal.tsx` | 새 설정 모달 다이얼로그(첫 섹션 AI) + 온보딩 위저드 + 고지 배너 |
| [MODIFY] | `src/components/layout/Header.tsx` | 설정(톱니) 버튼 추가 → 모달 오픈 |
| [MODIFY] | `src/components/layout/AppLayout.tsx` | AI 적용 핸들러 배선(viewRef null 가드), 설정 모달 마운트 |
| [NEW] | `src/lib/ai/mermaidValidate.ts` | PreviewRenderer의 `mermaid.parse` 로직 추출·공유(strict 유지) |
| [MODIFY] | `src/styles/mdedit-components.css` | AI 카드·툴바·모달·고스트 클래스(`--md-*` 토큰만) |
| [NEW] | `src-tauri/src/ai/stream.rs` 등 테스트 | Rust `#[cfg(test)]` 파싱·가드 유닛 |
| [NEW] | `src/test/aiLengthGuard.test.ts`, `aiSuggestionApply.test.ts`, `aiGhostConfirm.test.ts`, `mermaidValidate.test.ts` | vitest(가짜 view 방식) |

## Acceptance Criteria

> acceptance.md의 Given-When-Then과 대응. REQ-AI-001 ~ 040 전 요구사항이 최소 1개의 AC에 매핑된다(일부 AC는 밀접한 REQ를 묶어 검증). 고아 AC 없음.

| AC ID | Requirement | Summary |
|-------|-------------|---------|
| AC-AI-001 | REQ-AI-004, 007 | 요청 → `ai://chunk` 순차 수신, 타이핑되듯 스트리밍, 취소 상시 노출 |
| AC-AI-002 | REQ-AI-002, 003 | 빈 스크래치 cwd + `--setting-sources ""` + `MAX_THINKING_TOKENS=0` 스폰, 프롬프트 조립은 Rust |
| AC-AI-003 | REQ-AI-005, 006, 008, 009 | 요청 연타 → in-flight만 취소(취소 표시), 검토 카드 유지, 동시 1개 |
| AC-AI-004 | REQ-AI-012, 015 | 미로그인 감지 → ✨ "연결 필요" 상태, 클릭 시 앱 내 모달 |
| AC-AI-005 | REQ-AI-011, 013 | 톱니 버튼 → 설정 모달(첫 섹션 AI), 최초 활성화 시 고지 배너 1회 |
| AC-AI-006 | REQ-AI-014, 018 | 온보딩 위저드(Windows 우선, [다시 확인] 재감지), 터미널 방치 문구 없음 |
| AC-AI-007 | REQ-AI-017 | `MDEDIT_AI_DISABLED=1` → AI 강제 비활성화 + 토글 잠금 |
| AC-AI-008 | REQ-AI-019, 020 | 선택 → ✨ + 우클릭, 프리셋 5종 + 직접 입력(Esc 복귀) |
| AC-AI-009 | REQ-AI-021, 022 | 제안 카드 표시(원문 유지) → [바꾸기] 단일 트랜잭션 → Mod+Z 복원 |
| AC-AI-010 | REQ-AI-023, 024 | 다이어그램 검증 성공 → 미니 렌더; 실패 → 1회 재요청 → 목록 폴백 |
| AC-AI-011 | REQ-AI-025 | ↻ 3회 소진 → sonnet 인라인 폴백 제안 |
| AC-AI-012 | REQ-AI-026, 027 | 선택 >2K → 편집 프리셋 비활성; 변환 계열 4K까지 삽입 전용, 절단 교체 없음 |
| AC-AI-013 | REQ-AI-028, 029 | 빈 섹션/문서 끝 3초 멈춤 → 힌트(토큰 0), 클릭/Mod+Enter → 고스트 스트리밍 |
| AC-AI-014 | REQ-AI-030, 031 | [넣기]/Mod+Enter 확정, Tab은 들여쓰기 유지(고스트 소멸) |
| AC-AI-015 | REQ-AI-035, 036 | dispatch 직전 원문 불일치 → 적용 중단 카드; 스트리밍 중 원문 편집 → 배너 |
| AC-AI-016 | REQ-AI-037 | 로그인 만료 → 원문 무손상 + 온보딩 재사용, 원인 분류 정확 |
| AC-AI-017 | REQ-AI-038, 039 | 빈/동일 제안 → "바꿀 곳 없어요"; Mod+S 중 스트리밍 유지 |
| AC-AI-018 | REQ-AI-040, 033, 034 | 파싱 실패 → raw JSON 미노출 오류 카드; 무통보 취소 없음, 문서 무손상 |
| AC-AI-019 | REQ-AI-032 | 자동 트리거 없음 — 요청은 버튼/단축키에서만 발생 |
| AC-AI-020 | REQ-AI-010 | AI UI 전체가 `--md-*` 토큰만 사용, 다크/라이트 자동 |
| AC-AI-021 | REQ-AI-001 | AI 요청이 `AiProvider` trait 경유로 라우팅되고, MVP 프로바이더 레지스트리에 claude 어댑터가 정확히 1개만 등록됨(codex 미등록) |
| AC-AI-022 | REQ-AI-016 | "고급 모델 사용" 토글 ON → 요청 모델 sonnet; OFF → haiku. REQ-AI-025의 3회 소진 폴백과 독립된 지속 설정 |

**Quality Gates (AC 외 공통 게이트)**: `tsc --noEmit` 클린 + 전체 vitest 통과(신규 Rust 유닛 포함) + 기존 Playwright(webkit) 무변경 통과. `npm run lint`는 eslint config 부재로 게이트에서 제외(알려진 프로젝트 제약, 회귀 오판 금지). Windows 단축키·스폰 지연은 M0 수동 실측(설계서 §11). 상세는 acceptance.md "Quality Gate Criteria" 참조.

## mx_plan

code_comments = ko (`language.yaml`). `@MX:SPEC: SPEC-AI-001` 공통 부착.

| 위치 | 태그 | 사유 |
|------|------|------|
| `ai-suggestion-card.ts` 적용 경로 + `ai-ghost-text.ts` 확정 경로 | `@MX:ANCHOR` | 문서 변경이 발생하는 단일 트랜잭션 지점 — 무손상 불변식(REQ-AI-022/030/033) 계약 |
| `ai/stream.rs` 파싱 함수 | `@MX:ANCHOR` | CLI 출력 계약 파싱 — 버전업 취약, 다수 호출 경로의 진입점 |
| `ai/claude_cli.rs` 프로세스 스폰 | `@MX:WARN` | 외부 프로세스 스폰(`@MX:REASON`: 임의 경로 CLI 실행, 격리 cwd·설정 차단 필수, expert-security 검토) |
| `mermaidValidate.ts` / 카드 미니 렌더 | `@MX:WARN` | `securityLevel:'strict'` 약화 금지(`@MX:REASON`: XSS), CSP null에서 AI 출력·사용자 문서 escape |
| `ai/prompt.rs` 컨텍스트 상한 | `@MX:NOTE` | 기능별 토큰 상한·절단 규칙(§7)과 프리셋 프롬프트 의도 기록 |
| `ai-length-guard.ts` | `@MX:NOTE` | 2K/4K 분기 근거(절단 교체 금지, §4.4) |

## Exclusions (What NOT to Build)

- **M2 자유 위치 이어쓰기(시나리오 E)** — 문서 임의 위치에서의 이어쓰기는 본 SPEC 범위 밖(빈 섹션/문서 끝 채우기만 M1).
- **M3 AI 패널 / 문서 대화(시나리오 G·H)** — 우측 AI 패널, 문서 질문, 위치 확정 적용은 후속 SPEC.
- **M4 codex 어댑터** — trait 계약만 확정하고 구현·UX 분기(무스트리밍 스피너·degraded 라벨)는 도입하지 않는다.
- **번역 프리셋** — 방향 선택 UX 비용으로 제외, 필요 시 "직접 입력"으로 처리.
- **프리셋 커스터마이즈** — 고정 5개로 시작, 사용자 편집 UI 없음.
- **자동완성 자동 트리거(커서급)** — 항상 수동 호출(REQ-AI-032).
- **대화 기록 영구 저장** — 세션 내 문서별 캐시조차 M3 범위(본 SPEC은 인라인·고스트만).
- **볼트 전역 검색 / 웹 리서치** — 토큰 비용·권한 복잡도로 제외.
- **프론트매터 자동 갱신** — 포맷터 충돌 이력으로 금지.
- **감사 로그 / MDM 연동** — 정책 kill-switch(REQ-AI-017)만 제공, 조직 통제 고급 기능은 후속.
- **신규 런타임 의존성** — claude CLI 외 신규 npm/cargo 런타임 의존성 도입 없음(plan.md 확인).
