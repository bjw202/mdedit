# Progress: SPEC-FS-004

- id: SPEC-FS-004
- title: ".md 파일 연동 — 더블클릭으로 mdedit 직접 열기"
- tier: M
- current_phase: plan (완료) → run 대기

## §F.1 Plan-phase Completion

- plan_complete_at: 2026-08-25T02:17:14Z
- plan_status: audit-ready

판정 근거: plan-auditor iteration-1 **PASS** — 종합 1.0 (Tier M 임계 0.80), must-pass 7/7.
보고서: `.moai/reports/plan-audit/SPEC-FS-004-review-1.md`

## 개정 이력

- v1.0.0 (2026-08-25): Phase 10 최초 작성 (spec/plan/acceptance/spec-compact + research.md)
- v1.1.0 (2026-08-25): post-PASS 개정 — 감사 D1/D2/D4 + 렌즈 F1~F7 + 교차모델(codex) 4건 반영.
  핵심: REQ-008 가드 전체 래핑(같은 폴더 경로 포함, 데이터 유실 방지) · REQ-011 atomic-take 계약(이벤트=알림 전용) ·
  연속 오픈 single-flight latest-wins · 대소문자 접기 Windows 전용 · REQ-004 Linux unverified-by-design ·
  REQ-010 전 진입 경로 first-.md-only 일반화 · AC-001 `npm run build` 수정.

## 런타임 참고 (run-phase 진입 시)

- 실행 모드: Phase 4에서 재판정 (Tier M, coding-heavy → `serial` 예상)
- Git: Late-branch 경로 (git-strategy `auto_enabled: false`) — SPEC은 main에 커밋, PR 시점에 브랜치 분기
- 수동 인수 5종(AC-001/002/004/005/006)은 설치 빌드 필요 — `tauri dev`로 재현 불가
