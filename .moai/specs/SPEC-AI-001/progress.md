# SPEC-AI-001 Progress

- Started: 2026-07-16
- Harness level: standard
- Execution: solo(sub-agent) + Opus implementation agents, Fable orchestration
- Branch: feature/SPEC-AI-001-cli-inline-edit

## Phases
- Phase 0.9 complete: languages = rust, typescript
- Phase 0.95 complete: Full Pipeline (files 20+, domains 3)
- Phase 1+1.5 complete: strategy + 19 tasks (coverage_verified: true), tasks.md 생성
- Plan approved by user: 2026-07-16
- T-007/T-014/T-015 complete (TS pure track): 38 new tests green, tsc clean, 713 total pass
- T-008 complete (front relay): ipc wrappers + useAiRelay + 10 tests, 723 total green, IPC contract fixed
- T-001~T-006 implemented (Rust M0-a): 183 tests green, clippy clean, deps +0
- Wire contract mismatch found (snake_case, error kinds, ai://cancelled, feature naming) → alignment fix delegated to Rust track
- Open issue: 로그인 세션이 Keychain 저장인 경우 파일 판정 불가 → 경량 프로브 배선 필요 (T-018 고려)
- T-009/T-010/T-011 complete (M0-c settings chain): 55 new tests, 778 total green. SettingsModal 마운트는 T-018로 이관, resolveModel 노출됨
- T-012 complete (✨ selection toolbar): 30 new tests, module standalone (등록은 T-017/T-018), diagram→'diagram' feature 라우팅 결정, insertOnly는 AiSelectionRequest 래퍼로 반출
- IPC 계약 정렬 완료 (Rust 재정렬): camelCase 전면, ai://cancelled 제거→error+cancelledBy, kind 4종, done.truncated, 194 tests green
- 해석 확정: presetKind 우선 / feature 'section-fill' kebab-case 수용(수정 1건) / 섹션 채우기 tail=contextBefore
- Rust M0-a 최종 완료: resolve tolerant(presetKind 우선→feature 폴백), 'diagram'/'section-fill' 직접 수용, 196 tests green, clippy clean, deps +0
- T-017 complete (ghost text): 13 tests, Tab 비확정·Prec.high keymap·StateField 단일 트랜잭션 확정, MarkdownEditor.tsx 무변경(자체 완결 확장)
- T-017 필드 매핑 교정: contextBefore=커서 앞 본문(기존 heading 오류 수정), 계약 어서션 테스트로 고정
- T-013/T-016 complete (suggestion card chain): 42 tests, reduceCard 상태머신·문장경계 확장·stale 차단, 833 total green
- T-018 완결: 통합 배선 + 오류/무손상 UX + 툴바→카드 range 결선 + 검토 카드 레지스트리(§3 위반 해소) + truncated 경로 개통. 857 tests green
- T-019 완결: CSS(38셀렉터, hex 0) + 스크림 토큰화 + 게이트 매트릭스 전부 PASS (vitest 857 / cargo 197 / tsc 0 / clippy 0 / Playwright 회귀 0 — table-border 2건은 사전 존재) + @MX 6종 커버
- git stash 사고 발생·복구 검증 완료 (v0.5.0 백업 stash 온전)
- 남은 divergence: Windows 실측(단축키 Ctrl·저사양 스폰 지연)은 수동 검증 항목으로 이월
- Phase 2.8a evaluator-active PASS: 종합 0.93 (Func .93/Sec .95/Craft .90/Cons .95), critical 0, suggestion 2건(mermaid render 예외 무음, coverage 수치 미측정). 수동 이월 3건: Windows 단축키·스폰 지연 실측, 실제 CLI 릴레이
- Phase 2.8b TRUST 5 PASS: CRITICAL 0 / WARNING 4 (파일 500줄 초과 2건, 테스트 전용 export 2건 — 비차단 권고). drift 4.5%(음). side-effect 이상 없음
- 구현 완료 게이트: 사용자 선택 = "커밋 전 직접 확인" — 커밋 보류, 워킹 트리에 변경 유지. 재개: 확인 후 커밋 → /moai sync SPEC-AI-001
- [BUG] 사용자 실기기(macOS) 확인: 감지 실패 2건 — (1) GUI PATH에 ~/.local/bin 부재로 claude 미발견 (2) Keychain 저장 케이스에서 credentials 파일 부재로 미로그인 오판. 근거 확보(~/.claude.json oauthAccount 존재) → tdd-rust-m0a 재개·수정 위임
- [BUG FIX] 감지 2건 수정 완료: (1) 절대경로 해석(PATH→표준위치→nvm→로그인셸 프로브, OnceLock 캐시, spawn 공유) (2) is_logged_in에 ~/.claude.json oauthAccount 신호. 재현 테스트 2건 포함 +15 tests, cargo 212 green — 오케스트레이터 직접 재검증 완료(detect 29/29)
- [BUG FIX] 프리셋 클릭 무반응 해소: 근본 원인 = block widget을 ViewPlugin decorations로 공급(CM6 금지 조합) → 클릭 시 RangeError가 동기 전파되어 모든 가시 상태 침묵 소멸. 카드 데코레이션을 StateField+EditorView.decorations.from으로 이관(고스트 선례 동일). 재현 테스트(실 EditorView jsdom 마운트) RED→GREEN, 859 tests — 오케스트레이터 재검증 2/2
- [BUG FIX] invoke 거부 해소: Tauri 인자 래핑 불일치(평면 spread vs {args:...}) — ipc.ts 수정 + ipcErrorMessage로 거부 사유 카드 노출(P7) + Rust 래핑 계약 가드. vitest 860 / cargo 213 / tsc 클린. 실기기 재확인 대기
- 핸드오프 작성: .moai/specs/SPEC-AI-001/handoff.md (컨텍스트 클리어 대비)
- [E2E 검증 PASS] 2026-07-16 실기기 3층 검증 완료: (a) 실 claude CLI 직접 스폰(앱 동일 인자) → stream-json 파서 계약 일치, (b) WebKit Playwright + Tauri v2 충실 목으로 인라인 편집 여정 5건 PASS (e2e/ai-inline-edit.spec.ts 신규), (c) 실행 중 실제 앱에 dev 프로브 주입(HMR) → 섹션 채우기 전체 여정(실 Tauri 디스패치+실 CLI 스트리밍 7.5s+고스트 확정) PASS. 수정 필요 결함 0건. 게이트: vitest 860 / cargo 213 / tsc 0 / Playwright 22 pass(사전 존재 table-border 2건 제외). 남은 것: 커밋 → /moai sync
