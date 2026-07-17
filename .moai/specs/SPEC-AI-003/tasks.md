# Task Decomposition

SPEC: SPEC-AI-003

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| T1 | 자유 위치 자격 판정 + syntaxTree 게이트 순수 함수 | REQ-AI3-001~004, 015 | - | src/components/editor/extensions/ai-ghost-text.ts, src/test/aiFreeContinue.test.ts | completed |
| T2 | 힌트 2단 자격 정책 (evaluateHintEligibility 확장) | REQ-AI3-005~007 | T1 | src/components/editor/extensions/ai-ghost-text.ts, src/test/aiHint.test.ts | completed |
| T3 | 트리거 커맨드 일반화 + contextAfter 전달 | REQ-AI3-008, 012 | T1 | src/components/editor/extensions/ai-ghost-text.ts, src/test/aiFreeContinue.test.ts | completed |
| T4 | Rust 프롬프트 build_continue_prompt(outline, before, after) | REQ-AI3-009~011 | - | src-tauri/src/ai/prompt.rs, src-tauri/src/ai/mod.rs | completed |
| T5 | 타이핑 소멸 → in-flight 취소 (D1) | REQ-AI3-013, 014 | T3 | src/components/editor/extensions/ai-ghost-text.ts, src/test/aiFreeContinue.test.ts | completed |
| T6 | e2e 여정 + mock 계약 | AC-AI3-001~004 | T1~T5 | e2e/*.spec.ts, e2e/fixtures/tauri-v2-ai-mock.ts | completed |
