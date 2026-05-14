## SPEC-PREVIEW-004 Progress

- Started: 2026-05-14
- Branch: feature/SPEC-PREVIEW-004
- Mode: TDD (manager-tdd), sub-agent, Standard Mode
- Execution scope (user choice): M1-M2 우선 — 보안 검증 가능한 수직 슬라이스 구현 후 수동 검증 라운드, 그 뒤 문서 갱신(M5)
- Harness: standard

### Phase log

- Phase 0: run 라우팅, SPEC v1.1.0 로딩, 코드베이스 탐색 완료
  - 발견: Cargo.toml `tauri` 의존성에 `protocol-asset` 피처 없음 → M1 선행 추가 필요
  - 폴더 열기 진입점: useFileSystem `openFolder` + `openFolderPath` (changeFolder는 openFolderPath에 위임)
- Phase 1-2: manager-tdd 위임 (M1-M2 구현) — 진행 중
