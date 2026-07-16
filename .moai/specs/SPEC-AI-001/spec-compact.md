---
id: SPEC-AI-001
version: "0.1.1"
status: draft
created: "2026-07-16"
updated: "2026-07-16"
author: "jw"
priority: high
issue_number: 0
generated_from: spec.md
---

# SPEC-AI-001 Compact — AI 기능 MVP (M0 인프라 + M1 인라인 편집·섹션 채우기)

> Run phase용 압축본. 원본: spec.md / acceptance.md / plan.md.
> 백엔드 = 로컬 `claude` CLI(`claude -p`, haiku 기본/sonnet 옵션). 앱은 API 키 미취급. MVP claude 단독(codex M4). 방법론 TDD(RED-first). 주 검증 Windows.

## Requirements (EARS)

### 모듈 1 — AI 기반 인프라 (스폰·스트리밍·취소·동시 1개)

- **REQ-AI-001** (U): The system shall AI 요청을 `AiProvider` trait로 처리(MVP claude 어댑터 단독, capabilities 포함 계약 확정).
- **REQ-AI-002** (U): The system shall CLI를 빈 스크래치 cwd + `--setting-sources ""` + `MAX_THINKING_TOKENS=0`으로 스폰.
- **REQ-AI-003** (U): The system shall 프롬프트 조립(템플릿+컨텍스트 상한 절단)을 Rust에서 수행, 프론트는 기능+텍스트 조각만 전달.
- **REQ-AI-004** (E): WHEN 요청, the system shall stdout 델타를 `ai://chunk`로 릴레이, 완료 `ai://done`, 실패 원인 분류 `ai://error`.
- **REQ-AI-005** (E): WHEN 취소, the system shall 프로세스 kill + 상태 취소 전환.
- **REQ-AI-006** (E): WHEN in-flight 중 새 요청, the system shall 기존 in-flight 자동 취소하되 "새 요청으로 취소" 표시 남김.
- **REQ-AI-007** (S): WHILE 스트리밍, the system shall 타이핑되듯 표시 + 상시 취소(Esc/버튼), UI 비블로킹.
- **REQ-AI-008** (Un): The system shall not 검토 대기 카드를 새 요청 이유로 취소(취소 대상은 in-flight만).
- **REQ-AI-009** (Un): The system shall not 동시 2개 이상 CLI 프로세스 in-flight 유지.

### 모듈 2 — 감지·설정·온보딩·정책

- **REQ-AI-010** (U): The system shall AI UI 전체를 `--md-*` 토큰만으로 렌더(다크/라이트 자동, 채팅앱풍 금지).
- **REQ-AI-011** (E): WHEN Header 톱니 클릭, the system shall 설정 모달(첫 섹션 AI) 오픈.
- **REQ-AI-012** (E): WHEN 감지, the system shall 설치·버전 + **로그인 상태 선제 판정**(세션 파일, 판정 불가 시 경량 프로브 1회).
- **REQ-AI-013** (E): WHEN 최초 활성화, the system shall 데이터 전송 고지 배너 1회 표시.
- **REQ-AI-014** (E): WHEN 온보딩 진입, the system shall OS 감지(Win 우선)→설치 명령 복사→터미널 안내→로그인→[다시 확인] 위저드.
- **REQ-AI-015** (S): WHILE 설치·미로그인, the system shall ✨를 "연결 필요" 상태로 표시(숨기지 않음), 클릭 시 앱 내 모달.
- **REQ-AI-016** (S): WHILE "고급 모델" 켜짐, the system shall sonnet 사용(기본 haiku).
- **REQ-AI-017** (S): WHILE 정책 kill-switch(`MDEDIT_AI_DISABLED=1`/정책 파일) 활성, the system shall AI 강제 비활성화 + 토글 잠금.
- **REQ-AI-018** (Un): The system shall not "터미널에서 claude 실행" 식 미완결 지시로 앱 밖 방치(앱 내 위저드로 완결).

### 모듈 3 — 인라인 편집 UX (✨·프리셋·카드·안전장치)

- **REQ-AI-019** (E): WHEN 선택, the system shall 선택 끝 ✨ 버튼 + 우클릭 "✨ AI로 편집" 중복 노출.
- **REQ-AI-020** (E): WHEN ✨ 열림, the system shall 프리셋 5종(다듬기/개요로 정리/표로 만들기/다이어그램으로/짧게 줄이기) + 직접 입력(Esc/← 복귀).
- **REQ-AI-021** (E): WHEN 편집 완료, the system shall 원문 유지 + 제안 카드(즉석 지시 입력 + 바꾸기/다시/취소, 변환 계열 [⤵ 아래에 삽입]).
- **REQ-AI-022** (E): WHEN 확정, the system shall 단일 트랜잭션 적용(Mod+Z 1회 복원).
- **REQ-AI-023** (E): WHEN 다이어그램 요청, the system shall 삽입 전 로컬 mermaid 파서(strict) 검증 + 카드 미니 렌더.
- **REQ-AI-024** (E): WHEN mermaid 검증 실패, the system shall 1회 자동 재요청 → 재실패 시 "목록으로 정리" 폴백.
- **REQ-AI-025** (E): WHEN ↻ 3회 소진, the system shall 방향 안내 + 1회성 sonnet 인라인 폴백 제안.
- **REQ-AI-026** (S): WHILE 선택 >2K자, the system shall 편집 프리셋 비활성 + 안내. 변환 계열은 4K까지 삽입 전용.
- **REQ-AI-027** (Un): The system shall not 선택 텍스트 절단 결과로 선택 전체 교체(무손실 삭제 금지).

### 모듈 4 — 섹션 채우기 (고스트)

- **REQ-AI-028** (E): WHEN 문서 끝/빈 헤딩 아래 3초 멈춤, the system shall 토큰 0 로컬 판정으로 힌트 버튼 + 단축키 표기.
- **REQ-AI-029** (E): WHEN 힌트 클릭/Mod+Enter, the system shall 이 시점 첫 요청 발생(빈 섹션=아웃라인+요지), 문체 상속 고스트 스트리밍 + [넣기]/[지우기]/[중지].
- **REQ-AI-030** (S): WHILE 고스트 활성, the system shall [넣기]/Mod+Enter로만 단일 트랜잭션 확정, [지우기]/Esc/타이핑 시 소멸.
- **REQ-AI-031** (Un): The system shall not Tab을 확정 키로 오버라이드(Tab=들여쓰기 유지, 고스트 소멸).
- **REQ-AI-032** (Un): The system shall not 커서급 자동완성/명시 트리거 없는 자동 호출(요청은 버튼/단축키에서만).

### 모듈 5 — 오류·무손상 원칙

- **REQ-AI-033** (U): The system shall 어떤 실패에서도 문서 무변경(변경은 사용자 확정으로만, 위치·범위는 확인한 것과 일치).
- **REQ-AI-034** (U): The system shall 카드/요청이 사라질 때 이유 명시 배너/카드로 알림(무통보 취소 금지).
- **REQ-AI-035** (E): WHEN 적용 dispatch 직전 원문 불일치, the system shall 적용 중단 + "원문이 바뀌어 적용할 수 없어요" 카드.
- **REQ-AI-036** (E): WHEN 스트리밍 중 대상 원문 편집, the system shall "원문이 편집되어 멈췄어요 [무시][다시 요청]" 배너(범위 밖 편집 무영향).
- **REQ-AI-037** (E): WHEN 로그인 만료, the system shall 원문 무손상 + "[연결 안내 보기]" 온보딩 재사용, stderr 로그인/네트워크/기타 분류.
- **REQ-AI-038** (E): WHEN 빈/동일 제안, the system shall "바꿀 곳 없어요" 카드 + 빈 교체 금지.
- **REQ-AI-039** (S): WHILE 스트리밍 중 Mod+S, the system shall 저장을 독립 처리 + 요청 유지.
- **REQ-AI-040** (Un): The system shall not 파싱 실패 시 raw JSON 노출(result 2차 파싱 → 실패 시 원인 감춘 오류 카드).

## Acceptance Criteria

| AC ID | REQ | Summary |
|-------|-----|---------|
| AC-AI-001 | 004, 007 | 델타 `ai://chunk` 순차, 타이핑 스트리밍, 취소 상시 |
| AC-AI-002 | 002, 003 | 빈 cwd + `--setting-sources ""` + `MAX_THINKING_TOKENS=0`, 프롬프트 Rust 조립, 디렉토리 실패→오류 카드 |
| AC-AI-003 | 005,006,008,009 | 연타 → in-flight만 취소·표시, 검토 카드 유지, 동시 1개 |
| AC-AI-004 | 012, 015 | 미로그인 선제 감지 → ✨ "연결 필요", 클릭 앱 내 모달 |
| AC-AI-005 | 011, 013 | 톱니 → 설정 모달(첫 섹션 AI) + 고지 배너 1회 |
| AC-AI-006 | 014, 018 | 온보딩 위저드(Win 우선, 재감지), 터미널 방치 문구 없음 |
| AC-AI-007 | 017 | `MDEDIT_AI_DISABLED=1` → 강제 비활성 + 토글 잠금 |
| AC-AI-008 | 019, 020 | 선택 ✨+우클릭, 프리셋 5종+직접 입력(Esc 복귀) |
| AC-AI-009 | 021, 022 | 카드(원문 유지) → [바꾸기] 단일 트랜잭션 → Mod+Z 복원 |
| AC-AI-010 | 023, 024 | 다이어그램 검증 성공→미니 렌더 / 실패→1회 재요청→목록 폴백 |
| AC-AI-011 | 025 | ↻ 3회 → sonnet 인라인 폴백 |
| AC-AI-012 | 026, 027 | 선택 >2K 편집 비활성, 변환 4K 삽입 전용, 절단 교체 없음 |
| AC-AI-013 | 028, 029 | 3초 멈춤 힌트(토큰 0), 클릭/Mod+Enter → 고스트 스트리밍 |
| AC-AI-014 | 030, 031 | [넣기]/Mod+Enter 확정, Tab 들여쓰기 유지(고스트 소멸) |
| AC-AI-015 | 035, 036 | dispatch 재검증 차단 카드; 스트리밍 중 원문 편집 배너 |
| AC-AI-016 | 037 | 로그인 만료 무손상 + 온보딩 재사용, 원인 분류 |
| AC-AI-017 | 038, 039 | 빈/동일 제안 "바꿀 곳 없어요"; Mod+S 중 스트리밍 유지 |
| AC-AI-018 | 040,033,034 | 파싱 실패 raw 미노출 오류 카드; 무통보 취소 없음, 문서 무손상 |
| AC-AI-019 | 032 | 자동 트리거 없음 — 요청은 버튼/단축키에서만 |
| AC-AI-020 | 010 | AI UI 전체 `--md-*` 토큰만, 다크/라이트 자동 |
| AC-AI-021 | 001 | AI 요청 `AiProvider` trait 경유 라우팅 + claude 어댑터 정확히 1개 등록(codex 미등록) |
| AC-AI-022 | 016 | 고급 모델 토글 ON→sonnet / OFF→haiku(REQ-025 단발 폴백과 독립) |

품질 게이트: `tsc --noEmit` 클린 + `cargo test`(스트림 파싱·stderr 분류·스폰 인자·경로/정책) + 전체 vitest + 기존 Playwright(webkit) 무변경. 스트리밍 릴레이는 Tauri IPC 미실행으로 E2E 대상 아님(Rust 유닛+수동). Windows 단축키·스폰 지연 수동 실측. `npm run lint` 게이트 제외(config 부재). 커밋당 커버리지 80%+. 신규 런타임 의존성 0.

## Files to Modify/Create

| Delta | 파일 |
|-------|------|
| [NEW] | `src-tauri/src/ai/mod.rs` — ai 커맨드(request/cancel/detect/policy) |
| [NEW] | `src-tauri/src/ai/provider.rs` — `AiProvider` trait + 타입(claude 단독, M4 계약) |
| [NEW] | `src-tauri/src/ai/claude_cli.rs` — 빈 cwd 스폰 + stdout 리더 스레드 + emit |
| [NEW] | `src-tauri/src/ai/detect.rs` — `--version` + 로그인 세션 선제 판정(크로스플랫폼) |
| [NEW] | `src-tauri/src/ai/prompt.rs` — 기능별 템플릿 + 컨텍스트 상한 절단(순수) |
| [NEW] | `src-tauri/src/ai/stream.rs` — stream-json 파싱 + stderr 분류(순수, 유닛) |
| [MODIFY] | `src-tauri/src/lib.rs` — invoke_handler 등록(:35–55) + setup() 정책 프로브 |
| [MODIFY] | `src-tauri/src/state/app_state.rs` — in-flight `Mutex<Option<Child>>` |
| [NEW] | `src/store/aiStore.ts` — 요청 상태+버퍼+취소 핸들(비영속) |
| [MODIFY] | `src/lib/tauri/ipc.ts` — ai invoke 래퍼 |
| [NEW] | `src/hooks/useAiRelay.ts` — `ai://` listen(useFileWatcher 복제, module-ref unlisten) |
| [NEW] | `src/components/editor/extensions/ai-selection-toolbar.ts` — ✨ 툴바+프리셋 |
| [NEW] | `src/components/editor/extensions/ai-suggestion-card.ts` — 제안 카드 block widget+적용 재검증 |
| [NEW] | `src/components/editor/extensions/ai-ghost-text.ts` — 고스트 inline widget+`Mod-Enter` keymap |
| [NEW] | `src/components/editor/extensions/ai-length-guard.ts` — 2K/4K 가드(순수) |
| [MODIFY] | `src/components/editor/extensions/markdown-extensions.ts` — AI 번들 등록(고스트 keymap precedence) |
| [MODIFY] | `src/components/editor/MarkdownEditor.tsx` — AI keymap·확장 배선 |
| [NEW] | `src/components/settings/SettingsModal.tsx` — 설정 모달(첫 섹션 AI)+온보딩+고지 배너 |
| [MODIFY] | `src/components/layout/Header.tsx` — 톱니 버튼 → 모달 |
| [MODIFY] | `src/components/layout/AppLayout.tsx` — AI 적용 핸들러·모달 마운트·오류 배너 |
| [NEW] | `src/lib/ai/mermaidValidate.ts` — PreviewRenderer mermaid.parse 추출(strict) |
| [MODIFY] | `src/styles/mdedit-components.css` — AI 카드·툴바·모달·고스트 클래스(토큰만) |
| [NEW] | `src/test/{aiLengthGuard,mermaidValidate,aiSuggestionApply,aiGhostConfirm}.test.ts` + Rust `#[cfg(test)]` |

## Exclusions

- M2 자유 위치 이어쓰기(시나리오 E) — 빈 섹션/문서 끝 채우기만.
- M3 AI 패널/문서 대화(시나리오 G·H) — 후속 SPEC.
- M4 codex 어댑터 — trait 계약만 확정, 구현·UX 분기 없음.
- 번역 프리셋 — 직접 입력으로 처리.
- 프리셋 커스터마이즈 — 고정 5개.
- 자동완성 자동 트리거(커서급) — 항상 수동.
- 대화 기록 영구 저장 / 세션 캐시 — M3 범위.
- 볼트 전역 검색 / 웹 리서치.
- 프론트매터 자동 갱신 — 포맷터 충돌.
- 감사 로그 / MDM 연동 — kill-switch만.
- 신규 런타임 의존성 — claude CLI 외 없음.
