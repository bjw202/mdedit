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
- Phase 1-2: manager-tdd 위임 (M1-M2 구현) — 완료 (커밋 0196b74)
  - M1: Cargo.toml protocol-asset 피처, tauri.conf.json assetProtocol, register_asset_scope 커맨드 + canonicalize_folder_path
  - M2: HtmlFileViewer, PreviewContainer, openFile .html 분기, FileExplorer .html 필터, 편집기 플레이스홀더
  - 검증: Rust 102 통과, 프런트엔드 366 통과, TypeScript 0 에러
- 보안 수동 검증 (manual-verification.md):
  - 1차: 시나리오 3·4·6·2·7 PASS. 시나리오 1 CSS·이미지 미로드 발견, 시나리오 5 ⚠️(테스트 HTML 버그)
  - 수정: HtmlFileViewer sandbox에 allow-same-origin 추가(커밋 48028f4),
    iframe asset URL %2F→/ 복원으로 상대경로 해소(커밋 b9e64dd)
  - 2차: 시나리오 1 PASS(CSS·이미지·스크립트 정상), 시나리오 5 PASS(status=403/body0 확정),
    시나리오 3 PASS(allow-same-origin 후에도 IPC 차단 유지)
  - 오픈 질문 5-B 확정: allow-same-origin 필요 + %2F→/ URL 복원 필요 (둘 다)
  - 5-A 정밀 테스트 PASS (restored=200 | /etc/passwd=403) — scope가 bounded임 증명
  - SPEC v1.2.0 정밀화 완료 (커밋 bc11570) — REQ-003 + 5-A를 자동 복원 동작에 맞게 수정
- 보안 수동 검증 전체 완료: 시나리오 1·2·3·4·5·5-A·6·7 모두 PASS
- 커밋: 0196b74(M1-M2), 48028f4(sandbox), b9e64dd(asset URL), bc11570(SPEC v1.2.0)
- M5 문서 갱신:
  - SPEC-PREVIEW-004/spec.md: status draft→completed, Implementation Notes 섹션 추가 (sandbox allow-same-origin, asset URL %2F→/ 디코딩, runtime scope 정밀화)
  - product.md: Feature 2a "Standalone HTML File Viewing" 신규 추가, Feature Status에 SPEC-PREVIEW-004 완료 표시
  - README.md: 주요 기능에 HTML 파일 보기 항목 추가
  - CHANGELOG.md: Unreleased 섹션에 SPEC-PREVIEW-004 항목 추가
  - progress.md: M5 완료 표시
  - 코드맵: frontend.md 컴포넌트 수 증가(HtmlFileViewer, PreviewContainer) 및 backend.md register_asset_scope 커맨드 추가 — 갱신 권장
- M5 완료, SPEC-PREVIEW-004 전체 완료 → PR 준비 완료
