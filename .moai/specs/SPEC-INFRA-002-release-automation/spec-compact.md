# SPEC-INFRA-002 compact — 자동 생성 요약 (plan/run 컨텍스트 주입용)

> 전문은 `spec.md` / `plan.md` / `acceptance.md` / `research.md`. v0.3.1(plan-audit 2차 부채 N1~N9 + Round 4 승인 게이트 선택, 2026-10-29 승인; 안내 블록 링크 정정). REQ 16건·AC 16건. 첫 자동 릴리스 = v0.19.0.

## 요구

- REQ-001 (Event + Unwanted): GitHub 태그 필터 `v[0-9]+.[0-9]+.[0-9]+` 푸시로만 실행. 브랜치·PR·dispatch·schedule 없음.
- REQ-002 (Event): `version-check`가 맨 먼저 태그(v 제거) = `package.json`·`Cargo.toml [package]`·`tauri.conf.json` version 확인. 불일치 → 파일별 메시지로 실패. 정규식 `^v\d+\.\d+\.\d+$` 아니면 실패(`v0x19x0`·`v0.19.0.1`·`-rc` 포함). 실패 시 생성·빌드 없음. 단위 테스트 가능.
- REQ-003 (Ubiquitous + Unwanted): 생성 호출 본문에 `draft: true`(초안은 이것으로만 보장 — `releaseId`면 `releaseDraft` 무시). 태그당 1개. 게시·프리릴리스·Latest·삭제 금지. 빌드 job은 `releaseId`로만 업로드.
- REQ-004 (Event + Unwanted): 같은 태그 릴리스 있으면 생성 job 실패. 업로드 직전 대상이 초안 아니면 빌드 job 실패. 게시본 변경 금지. 빌드 job 셸 단계는 `shell: bash`(Windows 기본 `pwsh`).
- REQ-005 (Ubiquitous + Event): 이름 `mdedit vX.Y.Z`, 본문 = `.github/release-notes-header.md` + 생성 노트(시작점 = 직전 `vX.Y.Z` 태그, 없으면 미지정). 안내 블록에 세 파일 패턴 + 저장소 README 링크 `https://github.com/bjw202/mdedit`(첫 실행 대처법 안내용). 절 앵커·Releases 페이지 링크 금지(순환).
- REQ-006: macOS aarch64·Windows x64만 독립 빌드(`_aarch64.dmg`, `-setup.exe`, `.msi`), 한쪽 실패해도 계속, 고정 Tauri CLI + tauri-action, 게이트·cargo test·Linux·Intel 없음.
- REQ-007: `tauri.conf.json` `bundle.macOS.signingIdentity: "-"`, 다른 키 무변경.
- REQ-008: 최상위 `contents: read`, 생성·빌드 job만 `contents: write`, 쓰기 job 체크아웃 `persist-credentials: false`, 토큰은 단계 단위 env만.
- REQ-009: `GITHUB_TOKEN`만.
- REQ-010: 태그별 동시성(진행 중 취소 안 함).
- REQ-011: `uses:`는 `actions/checkout@v4`·`actions/setup-node@v4`·`tauri-apps/tauri-action@1deb371b0cd8bd54025b384f1cd735e725c4060f  # v1.0.0`만, Node 24, 다른 서드파티 금지(러너 이미지 Rust 사용).
- REQ-012: `frontend-gates.yml` 수정 금지.
- REQ-013: README `## 설치 파일 내려받기` — Releases 링크, 세 파일, Apple 공식 "개인정보 보호 및 보안 → 그래도 열기 → 열기", SmartScreen 절차. `xattr`·미지원 플랫폼 금지.
- REQ-014: BUILD.md 배포 절 — main에 이미 병합된 커밋에 태그 → 푸시 → 실행 확인 → 완전히 끝난 뒤 초안 검토 → 직접 Publish. 규칙: 실행 중 게시 금지(R-8, 사용자 수용), 게시 후 재실행 금지, 결함 시 초안·태그 삭제 후 재태깅. 로컬 macOS 빌드 ad-hoc 서명 안내 1문장. `gh release create`·우클릭·`xattr` 금지.
- REQ-015: CHANGELOG `## [0.19.0] - 2026-10-29` 절에 항목 1개.
- REQ-016 (Event): Apple Silicon dmg는 "손상됨" 없이 공식 경로로 실행, Windows setup.exe 실행.

## 수용 기준

| AC | REQ | 요지 (기법) |
|----|-----|-------------|
| 001 | 002 | 단위 — 일치·파일별 불일치·형식 위반 5종·Cargo 절 |
| 002 | 005 | 단위 — 직전 태그(숫자 비교, 없음, 비semver 무시) |
| 003 | 001·002 | actionlint + js-yaml — 트리거, job 3개·needs 사슬, 스크립트 호출 |
| 004 | 003 | js-yaml — 생성 호출 `draft=true`, 게시·삭제·Latest 0건, `releaseId` 사용 |
| 005 | 004·005 | js-yaml — 기존 릴리스 확인 단계·업로드 전 초안 확인 단계 순서, 빌드 셸 단계 `bash`, 노트 구성, 안내 블록 문구(README 링크 `…/mdedit`, `/releases`·앵커 없음) |
| 006 | 006 | js-yaml — 행렬 정확히 2, fail-fast false, 게이트·Linux·Intel 없음 |
| 007 | 007 | JSON 비교 — signingIdentity `-`, 나머지 기준과 동일 |
| 008 | 008·009·010 | js-yaml — 권한, persist-credentials, env(`secrets.`·`github.token`), 시크릿, 동시성 |
| 009 | 011 | js-yaml — uses 허용 목록(정확한 SHA `1deb371…`), `# v1.0.0` 주석 grep, Node 24 |
| 010 | 012 | git diff(병합 기준) 빈 출력 |
| 011 | 013·014·015 | 절 범위 awk+grep — 새 문구(`main에 이미 병합된 커밋에 태그`, `완전히 끝난 뒤`, `ad-hoc` 등) 있음·낡은 절차 없음, CHANGELOG `[0.19.0]` |
| 012 | 전체 | npm test·lint·typecheck 회귀 없음 |
| 013 | 002 | 수동 — 실패 경로 리허설 `v0.0.1` |
| 014 | 003·005·006 | 수동 — 정상 경로 리허설 v0.19.0(초안·파일·본문·prebuild 미실행) |
| 015 | 007·016 | 수동 — Apple Silicon `Signature=adhoc`, strict 검증 0, 첫 실행 |
| 016 | 016 | 수동 — Windows 첫 실행 |

## 변경 파일

- M1: [NEW] `scripts/check-release-version.mjs`, `scripts/check-release-version.test.mjs`
- M2: [NEW] `.github/workflows/release.yml`, `.github/release-notes-header.md`; [MODIFY] `src-tauri/tauri.conf.json`
- M3: [MODIFY] `README.md`, `docs/BUILD.md`(591-655행), `CHANGELOG.md`(`[0.19.0]`)
- 무변경: `.github/workflows/frontend-gates.yml`

## Exclusions

- Apple Developer ID 서명·공증, Windows 서명, 업데이터 플러그인 없음(ad-hoc만).
- Linux·Intel 맥·universal 빌드 없음.
- `workflow_dispatch`·프리릴리스 태그 지원 없음.
- v0.15.0~v0.18.0 소급 릴리스, v0.13.2 초안 정리 없음.
- main에 없는 커밋 태그 차단 없음(절차로만), 자산 목록 자동 검사 job 없음, cargo test·프런트 게이트 재실행·CI 결과 조회 없음, `.github/release.yml` 없음.
