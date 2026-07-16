# Task Decomposition

SPEC: SPEC-AI-001 (AI 기능 M0+M1)
방법론: TDD (RED-GREEN-REFACTOR) · 하네스: standard · 승인: 2026-07-16

## M0-a — Rust ai 모듈

| Task ID | 설명 | REQ | 의존성 | Planned Files | Status |
|---------|------|-----|--------|---------------|--------|
| T-001 | stream-json 델타/result 추출 + stderr 3분류 순수 함수 | 004, 037, 040 | - | src-tauri/src/ai/stream.rs, src-tauri/src/ai/mod.rs | completed |
| T-002 | AiProvider trait + ProviderStatus/Capabilities + 레지스트리(claude 단독) | 001 | - | src-tauri/src/ai/provider.rs | completed |
| T-003 | claude 스폰 인자 조립(순수) + 스폰·stdout 리더 스레드·emit | 002, 004, 016 | T-001, T-002 | src-tauri/src/ai/claude_cli.rs | completed |
| T-004 | 프롬프트 템플릿 + 컨텍스트 상한 절단(순수) | 003 | - | src-tauri/src/ai/prompt.rs | completed |
| T-005 | 설치·버전 감지 + 로그인 세션 선제 판정(크로스플랫폼) | 012 | - | src-tauri/src/ai/detect.rs | completed |
| T-006 | AppState in-flight + ai 커맨드 등록 + setup 정책 프로브 | 005, 006, 008, 009, 017 | T-002, T-003 | src-tauri/src/state/app_state.rs, src-tauri/src/ai/mod.rs, src-tauri/src/lib.rs | completed |

## M0-b — 프론트 릴레이 + aiStore

| Task ID | 설명 | REQ | 의존성 | Planned Files | Status |
|---------|------|-----|--------|---------------|--------|
| T-007 | aiStore 리듀서(델타 누적·상태 전이·취소, 비영속) | 007, 008 | - | src/store/aiStore.ts, src/test/aiStore.test.ts | completed |
| T-008 | ipc ai invoke 래퍼 + ai:// listen/unlisten 훅 | 004, 005, 007 | T-006, T-007 | src/lib/tauri/ipc.ts, src/hooks/useAiRelay.ts | completed |

## M0-c — 설정 모달 + 온보딩 + 정책 (동일 파일 → 순차)

| Task ID | 설명 | REQ | 의존성 | Planned Files | Status |
|---------|------|-----|--------|---------------|--------|
| T-009 | 설정 모달 AI 섹션 + Header 톱니→모달 | 010, 011, 015 | T-008 | src/components/settings/SettingsModal.tsx, src/components/layout/Header.tsx | completed |
| T-010 | 온보딩 위저드(OS 감지→설치→로그인→재감지) | 014, 018 | T-009 | src/components/settings/SettingsModal.tsx | completed |
| T-011 | 고지 배너 1회 + sonnet 토글 + 정책 잠금 | 013, 016, 017 | T-009 | src/components/settings/SettingsModal.tsx | completed |

## M1-a — ✨ 선택 편집 + 카드

| Task ID | 설명 | REQ | 의존성 | Planned Files | Status |
|---------|------|-----|--------|---------------|--------|
| T-012 | ✨ 선택 툴바 + 프리셋 5종 + 직접 입력 + 우클릭 | 019, 020, 015 | T-008, T-014 | src/components/editor/extensions/ai-selection-toolbar.ts | completed |
| T-013 | 제안 카드 block widget + ↻3회→sonnet + 빈 제안 처리 | 021, 025, 038 | T-012, T-015 | src/components/editor/extensions/ai-suggestion-card.ts | completed |

## M1-b — 적용 안전장치

| Task ID | 설명 | REQ | 의존성 | Planned Files | Status |
|---------|------|-----|--------|---------------|--------|
| T-014 | 선택 길이 가드 순수 함수(2K/4K, 절단 교체 금지) | 026, 027 | - | src/components/editor/extensions/ai-length-guard.ts, src/test/aiLengthGuard.test.ts | completed |
| T-015 | mermaid 사전 검증 공유 함수(strict) + 목록 폴백 | 023, 024 | - | src/lib/ai/mermaidValidate.ts, src/test/mermaidValidate.test.ts | completed |
| T-016 | dispatch 직전 원문 재검증 + 단일 트랜잭션 | 022, 035 | T-013 | src/components/editor/extensions/ai-suggestion-card.ts, src/test/aiSuggestionApply.test.ts | completed |

## M1-c — 섹션 채우기 고스트

| Task ID | 설명 | REQ | 의존성 | Planned Files | Status |
|---------|------|-----|--------|---------------|--------|
| T-017 | 고스트 inline widget + 힌트(토큰 0) + Mod-Enter precedence + Tab 비확정 | 028-032 | T-008 | src/components/editor/extensions/ai-ghost-text.ts, src/components/editor/extensions/markdown-extensions.ts, src/components/editor/MarkdownEditor.tsx, src/test/aiGhostConfirm.test.ts | completed |

## 마감 — 통합 배선 + MX + 게이트

| Task ID | 설명 | REQ | 의존성 | Planned Files | Status |
|---------|------|-----|--------|---------------|--------|
| T-018 | AppLayout 배선 + 무손상·오류 UX 통합 | 033, 034, 036, 037, 039, 040 | T-011, T-016, T-017 | src/components/layout/AppLayout.tsx, src/components/editor/extensions/ai-suggestion-card.ts | completed |
| T-019 | AI CSS(--md-* 토큰) + MX 태그 + 게이트 + Windows 실측 | 010 | T-018 | src/styles/mdedit-components.css | completed |

## 병렬화 규칙
- Rust 트랙(T-001/002/004/005) ⟂ TS 트랙(T-007/014/015): 디렉토리 분리, 병렬 가능
- 직렬 체인: T-003(←001·002) → T-006 → T-008
- [HARD] 공유 파일 직렬화: SettingsModal.tsx(T-009→010→011), markdown-extensions.ts·MarkdownEditor.tsx(T-012·T-017), AppLayout.tsx(T-018), ai-suggestion-card.ts(T-013→T-016)

## 게이트
`npx tsc --noEmit` 에러 0 · `npx vitest run` 전체 통과 · `cargo test` + `cargo clippy` 클린 · 기존 Playwright 무변경 · 신규 런타임 의존성 0 · lint는 게이트 아님(eslint config 부재)
