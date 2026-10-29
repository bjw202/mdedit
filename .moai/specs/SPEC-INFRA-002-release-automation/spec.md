---
id: SPEC-INFRA-002
title: "태그 푸시 기반 GitHub Actions 릴리스 자동화 — macOS·Windows 설치 파일 초안 릴리스"
version: "0.3.2"
status: in-progress
created: 2026-10-29
updated: 2026-10-29
author: jw (bjw202)
priority: High
phase: "v0.19.0 target"
module: ".github/workflows"
lifecycle: spec-anchored
tags: "ci, release, github-actions, tauri-action, distribution, docs"
tier: M
---

# SPEC-INFRA-002: 태그 푸시 기반 GitHub Actions 릴리스 자동화

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-10-29 | jw | 최초 작성. 사용자 결정(2026-10-29, AskUserQuestion 2라운드, `interview.md`): 플랫폼 = macOS Apple Silicon + Windows x64, 게시 = 초안만(사용자가 직접 Publish), 서명·공증 없음, 본문 = 고정 설치 안내 + 자동 생성 노트, 빌드 전 검증 = 태그-버전 일치만, 문서 = README 내려받기 절 + BUILD.md 배포 절 재작성. REQ 17건·AC 14건. |
| 0.2.0 | 2026-10-29 | jw | plan-audit 1차(`.moai/reports/plan-audit/SPEC-INFRA-002-iter1.md`, FAIL 0.75) 반영. Round 3 사용자 결정(2026-10-29, 감사 결과를 본 뒤, `interview.md`): (1) macOS ad-hoc 서명 포함 — `bundle.macOS.signingIdentity: "-"`를 산출물로(REQ-007), `xattr` 우회는 안내하지 않음; (2) 첫 자동 릴리스 = v0.19.0 — `phase` 변경, CHANGELOG는 `[0.19.0]` 절(REQ-015); (3) main 포함 여부 검사 요구 삭제 — BUILD.md 절차 단계와 잔여 위험으로 대체; (4) 자산 확인 job 삭제. 감사 결함 반영: 초안 보장을 생성 호출의 `draft: true`로 옮김(D3), 게시된 릴리스 재실행 보호 — 업로드 전 초안 여부 확인(D10), `persist-credentials: false`·단계 단위 토큰·서드파티 액션 축소(D11), 문서 AC를 새 문구 기준으로(D5), 모든 Then에 판정 명령(D6). REQ 17→16, AC 14→16, 전 문서 번호 재정렬. |
| 0.3.0 | 2026-10-29 | jw | plan-audit 2차(`.moai/reports/plan-audit/SPEC-INFRA-002-iter2.md`, PASS-WITH-DEBT 0.90) 부채 반영과 Decision Point 1 승인(2026-10-29). Round 4 사용자 선택(`interview.md`): (1) tauri-action은 커밋 SHA `1deb371b0cd8bd54025b384f1cd735e725c4060f`(v1·v1.0.0 태그가 가리키는 커밋)로 고정하고 `# v1.0.0` 주석(REQ-011, AC-009, N3); (2) 안내 블록 링크는 Releases 페이지 URL, 절 앵커 없음(REQ-005, AC-005); (3) R-8(빌드 중 Publish) 위험을 사용자가 수용, BUILD.md 규칙 "실행이 완전히 끝난 뒤 게시" 유지. 부채: N1 빌드 job 셸 단계 `shell: bash`, N4 BUILD.md "병합된 커밋" 문장 검사, N5 `github.token` 노출 검사, N6 낡은 문구, N7 줄 수 대신 서로 다른 사례 수, N8 로컬 macOS 빌드 ad-hoc 서명 안내, N9 `$W`를 같은 명령 안에서 정의. REQ·AC 번호 변경 없음(16/16). |
| 0.3.1 | 2026-10-29 | jw | Round 4 선택 (2) 해석 정정(사용자 답변, `interview.md` Round 4): 릴리스 본문 안내 블록의 링크는 Releases 페이지가 아니라 저장소 첫 화면(README) `https://github.com/bjw202/mdedit`, 절 앵커 없음. Releases 페이지 링크는 순환이라 기각. REQ-005·AC-005 수정. README 내려받기 절의 Releases 링크(REQ-013·AC-011)는 그대로. REQ·AC 16/16. |
| 0.3.2 | 2026-10-29 | jw | run 단계 감사 게이트(`.moai/reports/plan-audit/SPEC-INFRA-002-review-1.md`, PASS-WITH-DEBT 0.90) 문서 부채 반영 — 범위·결정·번호 변경 없음. D1: acceptance.md 판정 규칙을 명령 종류별로 다시 쓰고(grep은 일치 = 종료 코드 0이라 의미가 반대) 모든 자동 AC 명령에 PASS/FAIL 조건 명시. D2: AC-005 금지 링크 정규식을 경로 중간 앵커(`…/blob/HEAD/README.md#…`)까지 넓히고 REQ-005 문구 맞춤. D3: README 링크 끝 `/` 허용(REQ-005·AC-005). D4: References를 Round 1~4·감사 보고서 3건으로. D5: interview.md 라운드 수 표기 정정. D6: REQ-008·AC-008에 단계 단위 토큰 검사 추가(`npm ci` 등 다른 단계 `env`의 토큰 거부). REQ·AC 16/16. |

## Overview

### 배경

- 지금은 코드만 GitHub에 올라가고, 설치 파일은 개발자가 로컬에서 빌드해 손으로 올린다. 게시된 릴리스는 v0.14.0(macOS dmg 1개)뿐이고 v0.15.0~v0.18.0은 태그만 있다(research.md §1).
- 목표: 버전 태그를 푸시하면 GitHub 서버가 macOS·Windows 설치 파일을 빌드해 **초안** 릴리스에 붙이고, 사용자가 검토한 뒤 직접 게시한다.

### Tier 판단

- Tier M. 새 워크플로 1개, 작은 스크립트와 테스트 1쌍, 설치 안내 블록 파일 1개, 설정 1줄(`src-tauri/tauri.conf.json` ad-hoc 서명), 문서 3개(README·BUILD.md·CHANGELOG)로 약 8개 파일이다. 코드량은 적지만 결과가 외부(공개 릴리스·최종 사용자)로 나가고 로컬에서 끝까지 검증할 수 없어 수용 기준을 별도 파일로 둔다. 근거 조사 기록을 위해 `research.md`를 추가 산출물로 둔다. 설계 난도가 낮아 `design.md`는 두지 않는다.

### 용어

- **버전 검사 job**(`version-check`): 빌드 전에 태그와 앱 버전을 비교하는 첫 job.
- **생성 job**(`create-release`): 초안 릴리스를 하나 만드는 job.
- **빌드 job**(`build`): 플랫폼별 설치 파일을 만들어 초안에 올리는 행렬 job.
- **직전 버전 태그**: 저장소의 `vX.Y.Z` 형식 태그 중 현재 태그보다 작은 것 가운데 가장 큰 것(숫자 비교).

## Requirements (GEARS)

### 모듈 A — 트리거와 사전 검증

#### REQ-INFRA002-001: 태그 푸시 트리거 (Event-driven + Unwanted)

- **When** GitHub 태그 필터 패턴 `v[0-9]+.[0-9]+.[0-9]+`(GitHub 필터 문법 — `.`은 문자 그대로, `+`는 앞 문자 1회 이상)와 맞는 태그가 푸시되면, the 릴리스 워크플로(`.github/workflows/release.yml`) shall 실행을 시작한다.
- The 릴리스 워크플로 shall not 브랜치 푸시, `pull_request`, `workflow_dispatch`, `schedule` 이벤트로 실행된다.

#### REQ-INFRA002-002: 태그-버전 일치 검사 (Event-driven)

- **When** 릴리스 워크플로가 시작되면, the 버전 검사 job shall 생성 job과 빌드 job보다 먼저 태그에서 앞의 `v`를 뗀 값을 `package.json`·`src-tauri/Cargo.toml`(`[package]` 절)·`src-tauri/tauri.conf.json`의 `version`과 각각 비교한다.
- **When** 세 값 중 하나라도 태그와 다르면, the 버전 검사 job shall 실패하고, 실패 메시지에 태그 값과 파일별 경로·값을 모두 적는다.
- **When** 태그가 정규식 기준으로 정확히 `v<숫자>.<숫자>.<숫자>`가 아니면(예: `v0.19.0-rc.1`, `v0x19x0`, `v0.19.0.1`), the 버전 검사 job shall 형식 위반을 알리는 메시지와 함께 실패한다.
- **When** 버전 검사 job이 실패하면, the 릴리스 워크플로 shall 생성 job과 빌드 job을 실행하지 않는다.
- The 버전 검사 로직 shall 워크플로 밖에서 단위 테스트로 검증 가능한 형태로 둔다.

### 모듈 B — 초안 릴리스

#### REQ-INFRA002-003: 초안 생성과 게시 금지 (Ubiquitous + Unwanted)

- The 생성 job의 릴리스 생성 API 호출 shall 요청 본문에 `draft: true`를 명시한다. 초안 상태는 이 호출로만 정해진다(빌드 액션은 `releaseId`를 받으면 `releaseDraft` 입력을 보지 않는다 — research.md §2).
- The 생성 job shall 태그 하나당 릴리스를 정확히 하나 만든다.
- The 릴리스 워크플로 shall not 릴리스를 게시하거나(초안 해제), 프리릴리스로 표시하거나, Latest로 지정하거나, 릴리스를 삭제한다.
- The 빌드 job shall not 릴리스를 새로 만든다. 빌드 job은 생성 job이 넘긴 릴리스 id로만 파일을 올린다.

#### REQ-INFRA002-004: 기존·게시된 릴리스 보호 (Event-driven + Unwanted)

- **When** 생성 job이 시작될 때 같은 태그의 릴리스(초안 또는 게시본)가 이미 있으면, the 생성 job shall 기존 릴리스의 종류와 주소를 적은 메시지와 함께 실패한다.
- **When** 빌드 job이 파일을 올리기 직전에 대상 릴리스가 초안이 아니면(예: 사용자가 게시한 뒤 실패한 job을 다시 실행), the 빌드 job shall 업로드 전에 실패한다.
- The 빌드 job의 셸 명령 단계(초안 확인 포함) shall `shell: bash`로 실행된다(단계 또는 job `defaults.run.shell`). Windows 러너의 기본 셸은 `pwsh`라 bash 문법이 깨지기 때문이다(research.md §5).
- The 릴리스 워크플로 shall not 게시된 릴리스의 파일이나 내용을 바꾼다.

#### REQ-INFRA002-005: 릴리스 이름과 본문 (Ubiquitous + Event-driven)

- The 초안 릴리스 이름 shall `mdedit vX.Y.Z`(태그와 같은 버전) 형식이다.
- The 초안 릴리스 본문 shall 저장소의 고정 설치 안내 블록(`.github/release-notes-header.md`)을 맨 앞에, 그 뒤에 GitHub 자동 생성 노트를 담는다.
- The 고정 설치 안내 블록 shall OS별로 받을 파일(Apple Silicon 맥 = `_aarch64.dmg`, Windows = `-setup.exe` 권장 / `.msi` 대안)과, 첫 실행 경고 대처법을 안내하는 저장소 첫 화면(README) 링크 `https://github.com/bjw202/mdedit`(끝 `/` 허용)를 담는다(대처법은 README 내려받기 절에만 있다 — REQ-013).
- The 고정 설치 안내 블록의 저장소 링크(저장소 주소로 시작하는 모든 링크) shall not 경로 어디에든 절 앵커(`#…`)를 쓰거나(예: `…/blob/HEAD/README.md#…`) Releases 페이지(`…/releases`)를 가리킨다(릴리스 본문에서 Releases 페이지로 돌아가는 링크는 순환이고, 앵커는 제목이 바뀌면 조용히 깨진다 — 사용자 선택 Round 4).
- The 자동 생성 노트의 시작점 shall 직전 버전 태그다.
- **When** 직전 버전 태그가 없으면, the 생성 job shall 시작점을 지정하지 않고 노트를 만든다.

### 모듈 C — 빌드와 산출물

#### REQ-INFRA002-006: 플랫폼 행렬 빌드 (Ubiquitous + Event-driven + Unwanted)

- The 빌드 job shall macOS Apple Silicon(aarch64)과 Windows x64 두 대상만 서로 독립적으로 빌드하고, 각각 `_aarch64.dmg` 1개와 `-setup.exe`·`.msi` 각 1개를 초안에 올린다.
- **When** 한 대상의 빌드가 실패하면, the 다른 대상의 빌드 job shall 취소되지 않고 끝까지 진행한다.
- The 빌드 job shall 프로젝트에 고정된 Tauri CLI(`@tauri-apps/cli`, `package-lock.json`)와 공식 `tauri-apps/tauri-action`으로 빌드한다.
- The 빌드 job shall not 프런트 게이트(lint·typecheck·vitest·Playwright)나 `cargo test`를 실행한다.
- The 빌드 job shall not Linux 설치 파일(`.deb`·`.rpm`·`.AppImage`)이나 Intel 맥 설치 파일을 만든다.

#### REQ-INFRA002-007: macOS ad-hoc 서명 (Ubiquitous + Unwanted)

- The `src-tauri/tauri.conf.json` shall `bundle.macOS.signingIdentity` 값으로 ad-hoc 의사 신원 `"-"`를 가진다(Apple 계정·인증서·시크릿 불필요).
- The 이 변경 shall not `tauri.conf.json`의 다른 키·값(`version`, `identifier`, `bundle.targets` 등)을 바꾼다.

### 모듈 D — 보안·운영

#### REQ-INFRA002-008: 최소 권한과 토큰 노출 최소화 (Ubiquitous + Unwanted)

- The 릴리스 워크플로 최상위 `permissions` shall `contents: read`만 부여한다.
- The 생성 job과 빌드 job shall job 단위로 `contents: write`만 부여받고, 버전 검사 job은 쓰기 권한을 받지 않는다.
- The 쓰기 권한 job의 체크아웃 단계 shall `persist-credentials: false`를 쓴다.
- The 토큰 shall 그것이 필요한 단계(릴리스 API 호출, 빌드 액션)의 단계 단위 `env`로만 전달되고, 워크플로·job 단위 `env`나 다른 단계(예: `npm ci`)의 `env`에는 들어가지 않는다.
- The 릴리스 워크플로 shall not `contents` 외의 권한 범위를 `write`로 부여한다.

#### REQ-INFRA002-009: 시크릿 불필요 (Ubiquitous + Unwanted)

- The 릴리스 워크플로 shall 기본 `GITHUB_TOKEN`만으로 끝까지 실행된다.
- The 릴리스 워크플로 shall not `secrets.GITHUB_TOKEN` 외의 시크릿을 참조한다.

#### REQ-INFRA002-010: 태그별 동시성(진행 중 취소 안 함) (Ubiquitous)

- The 릴리스 워크플로 shall 태그 참조별 동시성 그룹을 쓰고 `cancel-in-progress`를 `false`로 둔다.

#### REQ-INFRA002-011: 액션 출처와 버전 고정 (Ubiquitous + Unwanted)

- The 릴리스 워크플로의 `uses:` shall `actions/checkout@v4`, `actions/setup-node@v4`, 그리고 `tauri-apps/tauri-action@1deb371b0cd8bd54025b384f1cd735e725c4060f  # v1.0.0`(v1·v1.0.0 주석 태그가 가리키는 커밋 — 태그 객체 SHA가 아님)만 쓴다.
- The `actions/setup-node` 단계 shall `node-version: '24'`(`frontend-gates.yml`과 같은 메이저)를 쓴다.
- The 릴리스 워크플로 shall not 그 밖의 서드파티 액션(예: Rust 툴체인·캐시 액션)을 쓴다. Rust는 GitHub 호스트 러너 이미지에 설치된 stable 툴체인을 쓴다(research.md §4).

#### REQ-INFRA002-012: 기존 게이트 무변경 (Unwanted)

- The 이 SPEC의 변경 shall not `.github/workflows/frontend-gates.yml`을 수정한다.

### 모듈 E — 문서

#### REQ-INFRA002-013: README 내려받기 절 (Ubiquitous + Unwanted)

- The `README.md` shall 최종 사용자용 `## 설치 파일 내려받기` 절을 담고, 그 절은 Releases 페이지 링크(`https://github.com/bjw202/mdedit/releases`), OS별로 받을 파일(`_aarch64.dmg`, `-setup.exe`, `.msi`), macOS·Windows 첫 실행 경고 대처법을 포함한다.
- The macOS 대처법 shall Apple 공식 안내 문구(시스템 설정 → `개인정보 보호 및 보안` → `그래도 열기` → `열기`, research.md §6)를 따른다.
- The Windows 대처법 shall Microsoft Defender SmartScreen 경고가 뜰 수 있음과 실행을 이어가는 절차를 담는다.
- The `## 설치 파일 내려받기` 절 shall not 격리 속성 제거 명령(`xattr`)이나 지원하지 않는 플랫폼(Linux, Intel 맥)용 파일을 안내한다.

#### REQ-INFRA002-014: BUILD.md 배포 절 재작성 (Ubiquitous + Unwanted)

- The `docs/BUILD.md` `## GitHub Releases로 배포하기` 절 shall 다음 절차를 설명한다: 버전 3곳 맞추기 → **main에 이미 병합된 커밋에 태그 달기** → 태그 푸시 → `release.yml` 실행 확인 → 실행이 모두 끝난 뒤 초안 검토 → 직접 Publish.
- The 그 절 shall 다음 규칙을 담는다: 워크플로 실행이 완전히 끝난 뒤에 게시한다(실행 중 게시 금지), 게시한 뒤에는 실패한 job을 다시 실행하지 않는다, 결함이 있으면 초안과 태그(원격·로컬)를 지우고 다시 태그를 단다.
- The 그 절 shall not 수동 `gh release create` 업로드, 마우스 오른쪽 클릭 열기, `xattr` 명령을 안내한다.
- The 그 절의 macOS 첫 실행 안내 shall README와 같은 Apple 공식 경로를 쓴다.
- The 그 절 shall 로컬 macOS 빌드(`npm run build`)도 이제 ad-hoc 서명된다는 점(Xcode 명령줄 도구의 `codesign` 사용, Windows 빌드는 영향 없음)을 한 문장으로 알린다.

#### REQ-INFRA002-015: CHANGELOG 기록 (Ubiquitous)

- The `CHANGELOG.md`의 기존 `## [0.19.0] - 2026-10-29` 절 shall 릴리스 자동화 도입 항목 1개(`SPEC-INFRA-002` 표기)를 담는다.

#### REQ-INFRA002-016: 첫 실행 가능성 (Event-driven)

- **When** 사용자가 초안의 `_aarch64.dmg`를 Apple Silicon 맥에서 브라우저로 내려받아 README 안내대로 설치·실행하면, the mdedit 앱 shall "손상됨" 경고 없이 Apple 공식 승인 경로를 거쳐 실행된다.
- **When** 사용자가 초안의 `-setup.exe`를 Windows x64에서 내려받아 README 안내대로 설치·실행하면, the mdedit 앱 shall 실행된다.

## REQ-AC 대응

| REQ | AC | 검증 기법 |
|-----|-----|----------|
| 001 | AC-INFRA002-003 | 정적(js-yaml 파싱) |
| 002 | AC-INFRA002-001, AC-INFRA002-003, AC-INFRA002-013 | 단위 + 정적 + 실패 경로 리허설 |
| 003 | AC-INFRA002-004, AC-INFRA002-014 | 정적 + 정상 경로 리허설 |
| 004 | AC-INFRA002-005 | 정적(구조) |
| 005 | AC-INFRA002-002, AC-INFRA002-005, AC-INFRA002-014 | 단위(직전 태그) + 정적 + 리허설 |
| 006 | AC-INFRA002-006, AC-INFRA002-014 | 정적 + 리허설 |
| 007 | AC-INFRA002-007, AC-INFRA002-015 | JSON 비교 + 실기기 서명 확인 |
| 008 | AC-INFRA002-008 | 정적(js-yaml 파싱) |
| 009 | AC-INFRA002-008 | 정적 |
| 010 | AC-INFRA002-008 | 정적 |
| 011 | AC-INFRA002-009 | 정적 |
| 012 | AC-INFRA002-010 | git diff |
| 013 | AC-INFRA002-011 | 절 범위 grep |
| 014 | AC-INFRA002-011 | 절 범위 grep |
| 015 | AC-INFRA002-011 | 절 범위 grep |
| 016 | AC-INFRA002-015, AC-INFRA002-016 | 실기기(수동) |

(AC-INFRA002-012는 회귀 감시: 기존 테스트 스위트·lint·typecheck 통과.)

## 경계 사례

| 사례 | 기대 동작 | 근거 |
|------|-----------|------|
| main에 없는 커밋에 태그 | **막지 않는다**(수용한 잔여 위험). BUILD.md 절차가 "main에 병합된 커밋에 태그"를 요구 | REQ-014, 위험 R-7 |
| 태그와 버전 불일치 | 버전 검사 job 실패, 파일별 값 출력, 생성·빌드 없음 | REQ-002 |
| 프리릴리스형 태그 `v0.19.0-rc.1` | 필터가 전체 일치로 해석되면 실행 안 됨(가능성 높음, research.md §5). 실행되더라도 형식 위반으로 실패 | REQ-001, 002 |
| 같은 태그 재푸시·삭제 후 재생성(이전 릴리스 남음) | 생성 job 실패, 기존 릴리스 보존. 사용자가 초안을 지우고 다시 태그 | REQ-004 |
| 한 플랫폼만 빌드 실패(Windows 도구 내려받기 실패 포함) | 다른 플랫폼은 끝까지 진행, 실행 결과는 실패(빨간색), 릴리스는 초안 유지. 사용자가 게시 전에 손으로 확인 | REQ-003, 006 |
| 초안 상태에서 "실패한 job만 다시 실행" | 빌드 job은 업로드 전 초안 확인을 통과하고 다시 올린다. 생성 job 출력 재사용 여부는 문서에 없음(미확인) — 재실행되면 기존 릴리스 때문에 실패하므로 어느 쪽이든 게시본은 안전 | REQ-004, research.md §3 |
| 게시한 뒤 실패 job 재실행 | 빌드 job이 업로드 전 초안 확인에서 실패, 게시본 무변경 | REQ-004 |
| 실행 도중 사용자가 게시 | 확인 시점과 업로드 시점 사이(빌드 단계 전체) 틈이 남음 — 사용자가 수용한 잔여 위험. BUILD.md 규칙 "실행이 완전히 끝난 뒤 게시"로 막음 | REQ-014, 위험 R-8 |

## Exclusions (What NOT to Build)

### Out of Scope — 서명과 업데이트

- Apple Developer ID 서명·공증, Windows 인증서 서명은 하지 않는다(ad-hoc 서명만 포함).
- `tauri-plugin-updater`와 업데이터 JSON·서명 파일은 다루지 않는다.

### Out of Scope — 플랫폼

- Linux(`.deb`·`.rpm`·`.AppImage`)와 Intel 맥(`x86_64-apple-darwin`, universal) 빌드는 하지 않는다.

### Out of Scope — 트리거와 재빌드

- `workflow_dispatch` 수동 실행·재빌드 입력은 두지 않는다.
- 프리릴리스(`-rc` 등) 태그 지원은 하지 않는다.

### Out of Scope — 과거 릴리스 정리

- v0.15.0~v0.18.0 릴리스 페이지 소급 생성은 하지 않는다.
- 낡은 초안 v0.13.2 정리는 하지 않는다.

### Out of Scope — 검증 범위

- 워크플로는 main에 없는 커밋의 태그를 막지 않는다(절차로만 다룸, 위험 R-7).
- 빌드 결과 파일 목록을 자동으로 검사하는 job은 두지 않는다(실패한 빌드는 실행을 빨갛게 만들고, 초안은 게시 전에 사람이 확인한다).
- 릴리스 워크플로에 `cargo test` 추가, 프런트 게이트 재실행, `frontend-gates.yml` 결과 조회는 하지 않는다.
- 릴리스 노트 분류 설정(`.github/release.yml`)은 만들지 않는다.

## 위험

| ID | 위험 | 영향 | 대응 |
|----|------|------|------|
| R-1 | 서명 없는(ad-hoc) 앱의 첫 실행 마찰 — Gatekeeper "확인되지 않은 개발자", SmartScreen 경고 | 사용자가 앱을 여는 데 단계가 늘어남 | README에 공식 경로 안내. ad-hoc 서명으로 "손상됨"은 막고(REQ-007), 실기기에서 확인(AC-015) |
| R-2 | tauri-action 동작 변화 | 업로드 실패·자산 이름 변화 | SHA 고정(REQ-011), 정상 경로 리허설에서 자산 이름 확인 |
| R-3 | 일부 파일만 붙은 초안 | 사용자가 불완전한 초안을 게시 | 실행 결과가 빨간색으로 표시, 게시는 사람이 함, BUILD.md 규칙 |
| R-4 | 러너 분 비용 | 비용 발생 | 공개 저장소라 macOS·Windows 러너가 무료라는 전제(`frontend-gates.yml` 주석) — 요금 문서는 재확인하지 않음 |
| R-5 | 쓰기 토큰이 액션·빌드 스크립트에 노출 | 공급망 위험 | 액션은 GitHub `actions/*`와 Tauri 공식 `tauri-apps/tauri-action`(SHA 고정)만. 체크아웃 자격 증명 저장 안 함, 토큰은 단계 단위. 남는 위험: 빌드 단계 안에서 실행되는 `vite build`·Cargo 빌드 스크립트는 그 단계의 토큰 환경 변수를 볼 수 있다 — 수용 |
| R-6 | 생성 노트 기본 시작점 미확인 | 노트가 v0.14.0부터 쌓임 | 직전 버전 태그 명시(REQ-005) |
| R-7 | main에 없는 커밋에 태그 | CI를 거치지 않은 코드가 초안으로 빌드됨 | 수용한 잔여 위험(사용자 결정 Round 3). BUILD.md 절차, 게시 전 사람 확인 |
| R-8 | 실행 도중 게시 | tauri-action은 빌드와 업로드를 한 단계에서 하므로 초안 확인은 Rust·Vite 빌드 전체보다 앞에 온다. 확인~업로드 틈은 빌드 단계 전체이고, 그동안 Publish를 누르면 게시본에 파일이 올라갈 수 있음 | BUILD.md 규칙 "실행이 완전히 끝난 뒤 게시". **사용자가 2026-10-29 승인 게이트에서 수용**(Round 4) |
| R-9 | 캐시 액션 제거로 빌드가 매번 처음부터 | 실행이 길어짐 | 태그 푸시 때만 돌므로 수용 |

## @MX 계획

- `scripts/check-release-version.mjs`: 내보내는 검사 함수에 `@MX:ANCHOR` — 워크플로 job과 단위 테스트가 함께 의존하는 계약(입력: 태그·파일 내용, 출력: 오류 목록). `@MX:REASON` 필수.
- 같은 파일: `^v\d+\.\d+\.\d+$` 정규식과 Cargo `[package]` 절 파싱에 `@MX:NOTE`(점을 이스케이프한 이유, 프리릴리스 거부가 의도라는 점). CLI 부분은 import 시 실행되지 않게 둔다(테스트가 import함).
- `.github/workflows/release.yml`: 한국어 주석으로 "초안은 생성 호출의 `draft: true`로만 보장된다 — 이 값을 지우거나 게시 단계를 추가하지 말 것"을 남긴다(MX 도구는 YAML을 스캔하지 않으므로 일반 주석).
- 주석 언어: `code_comments: ko`.

## Acceptance

수용 기준과 Given/When/Then 시나리오는 `acceptance.md`, 마일스톤·변경 파일·결정 기록은 `plan.md`, 외부 근거는 `research.md`.

## References

- 인터뷰·결정: `interview.md`(Round 1~4)
- plan-audit: `.moai/reports/plan-audit/SPEC-INFRA-002-iter1.md`, `.moai/reports/plan-audit/SPEC-INFRA-002-iter2.md`, run 단계 감사 게이트 `.moai/reports/plan-audit/SPEC-INFRA-002-review-1.md`
- 기존 게이트: `.github/workflows/frontend-gates.yml`
- 관련 문서: `README.md`, `docs/BUILD.md` 591-655행, `CHANGELOG.md`, `src-tauri/tauri.conf.json`
