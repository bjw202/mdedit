# Interview: GitHub Actions 릴리스 자동화 (SPEC-INFRA-002)

> 오케스트레이터가 2026-10-29 AskUserQuestion 두 차례로 진행한 인터뷰 결과다. 질문 원문은 오케스트레이터가 전달하지 않아 주제 단위로 적고, 답변은 전달받은 확정 결정을 그대로 옮긴다. 사용자 원 요청: "사용자가 설치 파일을 내려받을 수 있어야 한다. 지금은 코드만 GitHub에 올라간다. 버전 태그를 푸시하면 GitHub 서버가 설치 파일을 빌드해 GitHub Release에 붙이도록 GitHub Actions로 자동화하라."

## Interview Round 1: Scope

Question: 빌드 플랫폼 범위는?
Answer: macOS Apple Silicon(aarch64 `.dmg`) + Windows x64(NSIS `-setup.exe`, `.msi`). 기각: Intel 맥, Linux.

Question: 릴리스 게시 방식은?
Answer: 태그 푸시 → 워크플로가 설치 파일을 붙인 **초안(draft)** GitHub Release를 만든다 → 사용자가 검토 후 직접 Publish를 누른다. 기각: 자동 게시, `workflow_dispatch` 전용.

Question: 코드 서명·공증은?
Answer: 하지 않는다. 서명 없는 배포 + 첫 실행 경고 우회 안내 문서. 기각: 선택적 시크릿 구조, Apple 서명 의무화.

## Interview Round 2: Constraints

Question: 릴리스 본문 구성은?
Answer: GitHub 자동 생성 노트(병합된 PR 제목) + 고정 설치 안내 블록(OS별로 받을 파일, 첫 실행 경고 우회법). 기각: CHANGELOG 절 복사(항목이 수천 자짜리 기술 문단), 빈 본문.

Question: 빌드 전 검증 범위는?
Answer: 태그-버전 일치 검사만. 태그 `vX.Y.Z`가 `package.json`·`src-tauri/Cargo.toml`·`src-tauri/tauri.conf.json`의 `version`(현재 셋 다 0.19.0)과 같아야 하고, 다르면 빌드 전에 실패한다. 근거: `.github/workflows/frontend-gates.yml`이 main 푸시마다 lint·typecheck·vitest·Playwright를 이미 돌리므로 릴리스 워크플로에서 반복하지 않는다 — 태그가 CI를 통과한 main 커밋을 가리킬 때만 성립한다. 기각: 프런트 게이트 재실행, `cargo test` 실행(Windows `cargo test` 기록 없음).

Question: 문서 범위는?
Answer: README에 최종 사용자용 "설치 파일 내려받기" 절(Releases 페이지 링크, macOS·Windows 첫 실행 경고 우회법) 추가. `docs/BUILD.md`의 "GitHub Releases로 배포하기" 절(약 591행)을 수동 `gh release create` 절차에서 태그 푸시 자동 절차로 다시 쓴다.

## 오케스트레이터가 밝히고 사용자가 이의를 달지 않은 전제

- 별도 파일 `.github/workflows/release.yml`을 쓰고 `frontend-gates.yml`은 고치지 않는다(헤더에 Rust 게이트는 별도 job이라고 적혀 있고 구조 유지가 요구됨).
- 공식 `tauri-apps/tauri-action`을 쓴다.
- 자동 업데이트 플러그인은 범위 밖이다.

## Interview Round 3: Audit-driven decisions (2026-10-29)

> plan-audit 1차(`.moai/reports/plan-audit/SPEC-INFRA-002-iter1.md`, FAIL 0.75)를 본 뒤 사용자가 내린 결정. 오케스트레이터가 전달한 확정 내용을 그대로 옮긴다.

Question: macOS ad-hoc 서명(D-1)을 넣을까?
Answer: 넣는다. `src-tauri/tauri.conf.json`에 `bundle.macOS.signingIdentity: "-"`를 산출물로 추가(한 줄, Apple 계정·시크릿 불필요). ad-hoc 서명으로도 "확인되지 않은 개발자" 경고는 남으므로 README·BUILD.md 첫 실행 안내는 Apple의 "그래도 열기" 경로를 유지한다. `xattr -d com.apple.quarantine` 우회는 안내하지 않는다(기각) — research.md에 비공식 방법으로 기록만 한다. 실제 Apple Silicon 맥에서 dmg를 여는 수동 리허설 AC는 유지한다.

Question: 첫 자동 릴리스 버전(D-2)은?
Answer: `v0.19.0`. 세 버전 파일이 이미 0.19.0이고 v0.19.0 태그가 없다. `phase: "v0.19.0 target"`, CHANGELOG 항목은 기존 `## [0.19.0] - 2026-10-29` 절에 추가(`[Unreleased]` 아님).

Question: main 포함 여부 검사(D-3, 구 REQ-INFRA002-003)를 유지할까?
Answer: 삭제. BUILD.md 절차에 "main에 이미 병합된 커밋에 태그를 단다" 단계로 넣고, "워크플로는 main에 없는 커밋의 태그를 막지 않는다"를 제외 목록·위험에 수용한 잔여 위험으로 적는다.

Question: 자산 확인 job을 유지할까?
Answer: 삭제(요구·AC 포함). 실패한 빌드는 실행을 빨갛게 만들고, 초안은 게시 전에 사람이 확인한다.

## Interview Round 4: Approval gate choices (2026-10-29)

> plan-audit 2차(`.moai/reports/plan-audit/SPEC-INFRA-002-iter2.md`, PASS-WITH-DEBT 0.90) 뒤 Decision Point 1에서 사용자가 계획을 승인하며 고른 내용. 오케스트레이터가 전달한 확정 내용을 그대로 옮긴다.

Question: tauri-action을 어떻게 고정할까?
Answer: 전체 커밋 SHA로 고정. 오케스트레이터가 `gh api`로 커밋 `1deb371b0cd8bd54025b384f1cd735e725c4060f`(2026-06-29, "Apply Version Updates From Current Changes (#1191)")가 있고, `v1`·`v1.0.0` 두 태그 모두 이 커밋을 가리키는 주석 태그임을 확인했다. 태그 객체 SHA(`944946e…`, `2d793bf…`)는 커밋이 아니므로 쓰지 않는다. `# v1.0.0` 주석을 붙인다.

Question: 릴리스 본문 안내 블록의 링크는?
Answer: 저장소 Releases 페이지 URL(`https://github.com/bjw202/mdedit/releases`), 절 앵커 없음.
Clarification (2026-10-29, 위 답의 해석을 사용자가 정정): 안내 블록은 OS별 파일 목록과 함께 저장소 첫 화면(README) `https://github.com/bjw202/mdedit`로 링크한다(절 앵커 없음). 첫 실행 경고 대처법("그래도 열기" 경로 등)은 README 내려받기 절에만 있기 때문이다. 릴리스 본문에서 Releases 페이지로 가는 링크는 순환이라 기각. README 내려받기 절은 계속 Releases 페이지 `https://github.com/bjw202/mdedit/releases`로 링크한다.

Question: 빌드 도중 Publish를 누를 때의 위험(R-8)을 수용할까?
Answer: 수용한다. BUILD.md 규칙 "워크플로 실행이 완전히 끝난 뒤에 게시한다"를 유지한다.

Decision Point 1: 사용자가 계획을 승인했다(2026-10-29).

## Clarity Score

Initial: 기록 없음(오케스트레이터 미전달)
Final: 기록 없음(오케스트레이터 미전달) — 두 라운드 뒤 범위·제약이 확정되어 인터뷰 종료
Rounds completed: 4 (Round 3 = 감사 결과에 따른 결정, Round 4 = 승인 게이트 선택)
