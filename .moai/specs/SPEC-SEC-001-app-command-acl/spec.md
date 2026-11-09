---
id: SPEC-SEC-001
title: "앱 명령 ACL 매니페스트 도입 — 원격·불투명 출처 프레임의 앱 명령 호출 차단"
version: "0.2.4"
status: completed
created: 2026-11-09
updated: 2026-11-09
author: jw (bjw202)
priority: High
phase: "v0.20.0 target"
module: "src-tauri/"
lifecycle: spec-anchored
tags: "security, tauri, acl, capability, ipc, windows, webview2"
tier: M
---

# SPEC-SEC-001: 앱 명령 ACL 매니페스트 도입

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-11-09 | jw | 최초 작성. 근거: SPEC-PREVIEW-018 super-advisor 처방(`.moai/reports/plan-audit/SPEC-PREVIEW-018-advisor.md` Q1·Q3)과 plan-audit review-3 D1. 사용자 결정 없음(코디네이터 브리프 기준). |
| 0.2.0 | 2026-11-09 | jw | plan-audit 1차(`.moai/reports/plan-audit/SPEC-SEC-001-review-1.md`, FAIL 0.69) 반영. 프런트 리터럴 호출 24→26 정정, REQ-001·002·003에서 구현 세부 분리, REQ-008 결과 단일화, Out of Scope 글머리표, R-6(srcdoc 거부는 미검증 가설)·R-7(Windows 기기 없음) 추가, `module` 경로형. REQ 9 / AC 8 + 수동 3 (번호 변경 없음). |
| 0.2.2 | 2026-11-09 | jw | sync 단계 보강: PREVIEW-019 감사가 지적한 프레임 이동(링크 클릭·meta refresh) 후에도 앱 명령이 거부되는지 확인하는 수동 항목 M-2b 추가. AC/REQ 번호 변경 없음. |
| 0.2.3 | 2026-11-09 | jw | sync: status in-progress→implemented (자동 AC 8/8 PASS, 수동 M-1·M-2·M-2b·M-3 대기로 completed 보류, R-7). |
| 0.2.4 | 2026-11-09 | jw | 수동 검증 종결: macOS M-2·M-2b·M-3 PASS(캡처 기록), Windows M-2·M-2b·M-3 PASS(사용자 보고 "윈도우에서도 문제 없다", 캡처 없음). M-1 기준선(선택)은 미수행. status implemented → completed. |

## Overview

### 배경과 문제

- 이 앱의 `src-tauri/build.rs`는 `tauri_build::build()`만 호출하고 `src-tauri/permissions/` 디렉터리가 없다. 그래서 앱 ACL 매니페스트가 없다. tauri 2.10.3은 이 경우 **플러그인 명령에만 ACL을 적용하고 앱이 직접 정의한 명령은 출처와 상관없이 ACL 검사를 건너뛴다**(`tauri-2.10.3/src/webview/mod.rs:1801-1805`: `plugin_command.is_some() || has_app_acl_manifest` 일 때만 검사). 확인함(소스 열람, 이 worktree 작업 중 직접 읽음).
- Windows의 wry는 IPC 초기화 스크립트를 하위 프레임에도 주입한다(advisor 보고서가 `wry-0.54.3/src/lib.rs:1003-1007`, `webview2/mod.rs:1301-1307`로 인용 — 이 SPEC 작성 중 재열람하지 않음, 가정으로 취급). 그러면 미리보기에 연 악성 HTML이 asset iframe 안에서 `window.__TAURI_INTERNALS__.invoke('write_file', …)` 등을 호출할 수 있다고 소스상 추정된다. `validate_path`는 `..`만 막고 절대경로는 막지 않는다(`src-tauri/src/commands/file_ops.rs:22-27`).
- **실기기에서 재현하지 않았다.** 이 SPEC의 위험 평가는 소스 판독에 근거한 가설이며, run 단계 첫 작업(M0)이 Windows 실기기 탐침으로 사실 여부를 확정한다. macOS는 WKWebView가 초기화 스크립트를 메인 프레임에만 주입하고(advisor 인용) 호출 키가 실행마다 무작위라 노출 가능성이 낮다고 추정한다(미검증).
- 노출 가능한 앱 명령은 `generate_handler!`에 등록된 **26개**다(직접 센 값, `src-tauri/src/lib.rs:78-105`). advisor 보고서의 "25개"와 다르다. 프런트엔드가 문자열 리터럴로 호출하는 명령도 26개로 등록 목록과 같다(`[a-z0-9_]+` 정규식으로 직접 센 값 — 숫자 없는 `[a-z_]+`로 세면 `base64` 이름 2개가 빠져 24로 잘못 나온다. 1차 감사 D1에서 정정). 동적 이름 호출(`invoke(변수)`)은 문자열 검색으로 잡히지 않으므로 M-3 스모크가 보완한다.

### 이 SPEC이 해결하는 것 / 하지 않는 것

- 해결: 앱 ACL 매니페스트를 도입하고 `main` capability(로컬 `main` 창)에만 앱 명령 26개를 허용한다. 그러면 `asset://` iframe과 기타 원격 출처 프레임이 보내는 앱 명령은 ACL 단계에서 거부된다(소스 판독 근거). `srcdoc` 불투명 출처 프레임도 거부될 것으로 기대하나 이는 실기기 전까지 가설이다(R-6).
- 해결하지 않음: 로컬 출처로 분류되는 프레임(예: 사용자 정의 스킴을 `Builder`에 등록한 경우)의 호출은 `main` capability가 그대로 적용되므로 막지 못한다. 명령 내부의 경로 정책(`validate_path` 강화)도 이 SPEC 범위가 아니다(§ Out of Scope).
- 후속 SPEC-PREVIEW-019(srcdoc 기반 선명한 배율)는 이 SPEC에 **의존한다**: 불투명 출처 iframe이 앱 명령을 호출하지 못한다는 조건이 이 SPEC 완료로 충족되어야 한다.

### Tier 판단

- Tier M. 수정·신규 파일은 `src-tauri/build.rs`, 명령 목록 파일 1개, `src-tauri/capabilities/main.json`, Rust 테스트 파일 1개, 프런트 계약 테스트 1개, 문서 1~2개로 약 6~8개다. 파일 수는 Tier S에 가깝지만, 보안 경계 변경이고 잘못 적용하면 **모든 앱 기능이 런타임에 거부**되며(빌드는 통과), Windows 실기기 없이는 핵심 주장을 검증할 수 없어 수용 기준과 실기기 단계를 별도로 둔다. 구현 마일스톤은 M1 하나(M0은 실기기 기준선, M2는 실기기 검증, M3은 선택 정리)이고 파일은 10개 미만이므로 Tier L(≥3 마일스톤 AND ≥10 파일)이 아니다.

## Requirements (GEARS)

### REQ-SEC001-001: 앱 ACL 매니페스트 생성 (Ubiquitous)

The 앱 빌드 shall 앱 ACL 매니페스트를 생성한다. 그 매니페스트는 `generate_handler!`에 등록된 앱 명령 26개 전부에 대응하는 권한을 정의한다. (구현 수단은 plan.md §B: `tauri_build::try_build` + `AppManifest::commands`. `try_build`의 오류는 `build.rs`가 빌드 실패로 전파한다.)

### REQ-SEC001-002: 명령 목록의 단일 출처 (Ubiquitous)

The 시스템 shall 앱 명령 이름 목록을 한 곳에서만 정의하고(plan.md §B: `src-tauri/app_commands.rs`), `lib.rs`의 `generate_handler!` 목록과 그 목록이 어긋나면 테스트가 실패하도록 한다.

### REQ-SEC001-003: main capability에만 허용 (Ubiquitous)

The `main` capability shall 앱 명령 26개 각각에 대응하는 `allow-<명령-kebab>` 권한을 포함하고, 어떤 capability에도 `remote` 항목을 두지 않으며 `windows`는 `["main"]`을 유지한다.

### REQ-SEC001-004: 원격·불투명 출처 거부 (Event-driven)

When asset 출처(`asset://` / `http://asset.localhost`) 프레임이 `invoke`로 앱 명령을 보내면, the 런타임 shall 그 호출을 ACL 단계에서 거부하고 명령 본문을 실행하지 않는다. 불투명 출처(`null`, srcdoc) 프레임도 같은 거부를 받아야 하나, 그 분류는 실기기 전에는 가설이다(R-6, M-2 추가 항목이 증거). 이 거부는 프레임이 다른 asset 경로 문서로 이동한 뒤에도 유지되어야 한다(M-2b).

### REQ-SEC001-005: 기존 기능 무회귀 (Ubiquitous)

The `main` 창 shall 매니페스트 도입 후에도 프런트엔드가 호출하는 앱 명령 26개 전부와, Rust가 `emit`하는 이벤트(`ai://chunk`·`ai://done`·`ai://error`·`file-changed`·`open-file`)를 수신하는 `listen`을 거부 없이 수행한다.

### REQ-SEC001-006: 권한 누락 조기 발견 (Ubiquitous)

The 시스템 shall 새 앱 명령이 `generate_handler!`에 추가되었으나 `APP_COMMANDS`·capability에 빠진 경우 `cargo test`가 실패하도록 하는 점검을 둔다(런타임 거부 이전에 잡는다).

### REQ-SEC001-007: Windows 실기기 탐침 — 전·후 기록 (Event-driven, run 첫 마일스톤)

When run 단계가 시작되면, the 구현자 shall 코드를 바꾸기 전에 현재 빌드(기준선)에서 탐침 HTML을 미리보기로 열어 Windows와 macOS의 결과를 기록하고, 매니페스트 적용 후 같은 탐침을 다시 실행해 기록한다. 기준선에서 호출이 성공하면 이 SPEC의 위험 평가가 확정되고, 실패하거나 `__TAURI_INTERNALS__`가 없으면 위험 평가를 낮추고 사용자에게 보고한다.

### REQ-SEC001-008: 미사용 플러그인 권한 정리 (Optional — Should)

Where 프런트엔드(테스트 파일 제외)와 Rust가 사용하지 않음이 import 검색과 전 기능 스모크(M-3)로 확인되는 플러그인 권한이 `main.json`에 있으면, the 구현자 shall 그 권한을 `main.json`에서 제거한다. 제거 뒤 스모크에서 거부가 나오면 그 권한만 되돌리고 사유를 progress.md에 기록한다. 이 요구는 M-3(전 기능 스모크)를 마친 뒤에만 수행한다. 후보: `shell:allow-execute`, `shell:allow-spawn`(프런트에 `@tauri-apps/plugin-shell` import 없음), `dialog:allow-open`·`dialog:allow-save`·`dialog:allow-message`(대화상자는 Rust `DialogExt`로만 호출). `opener:allow-open-path`·`opener:allow-reveal-item-in-dir`는 `src/lib/tauri/ipc.ts`가 쓰므로 **제거하지 않는다**.

### REQ-SEC001-009: 회귀 안내 (Ubiquitous)

The 시스템 shall 새 앱 명령을 추가하는 개발자가 `APP_COMMANDS`·`main.json`을 함께 고쳐야 한다는 점을 `src-tauri/app_commands.rs` 머리 주석에 적는다.

## Exclusions (Out of Scope)

### Out of Scope — `validate_path` 강화

- 절대경로·작업 영역 밖 경로 제한을 추가하지 않는다.
- 앱 명령은 사용자가 고른 임의 파일을 열고 저장하는 것이 본래 기능이라 정책 설계가 별도 사용자 결정을 요구한다.

### Out of Scope — `opener:allow-open-path` 범위(`**`) 좁히기

- `main.json`의 `opener:allow-open-path`·`opener:allow-reveal-item-in-dir` 범위(`**`)를 바꾸지 않는다.
- 현재 `**`는 사용자가 연 파일·폴더를 OS 기본 앱으로 여는 기능에 쓰이며, 범위 축소는 기능 변경이라 별도 SPEC 후보다.

### Out of Scope — 명령 안의 호출 출처 이중 검사

- advisor가 제안한 "명령 안에서 `Webview` URL 검사" 보조 방어선을 구현하지 않는다.
- ACL이 제 역할을 하는지 실기기(M-2)에서 확인된 뒤에 필요 여부를 판단한다.

### Out of Scope — SPEC-PREVIEW-019 구현

- srcdoc 기반 배율 구현은 하지 않는다(SPEC-PREVIEW-019).
- 이 SPEC은 그 전제 조건(앱 명령 ACL)만 제공한다.

### Out of Scope — `cargo test`를 CI에 추가

- `.github/workflows/`에 cargo 스텝을 추가하지 않는다(`frontend-gates.yml` 머리말이 의도적으로 금지).
- 이 SPEC의 Rust 테스트는 로컬(`cargo test --manifest-path src-tauri/Cargo.toml`)에서 실행하며, CI 편입은 별도 결정이다.

## Risks

| ID | 위험 | 대응 |
|----|------|------|
| R-1 | 권한 하나라도 빠지면 그 기능이 런타임에서만 거부된다(빌드는 통과) | REQ-002·006 목록 일치 테스트, REQ-005 프런트 계약 테스트, M2 실기기 전 기능 스모크 |
| R-2 | 자동 생성 권한 파일이 `src-tauri/permissions/autogenerated/`에 쓰여 저장소를 더럽힌다 | 결정: `.gitignore`에 추가하고 커밋하지 않는다(plan §B-6). M1에서 실제 생성 위치를 확인해 줄만 맞춘다 |
| R-3 | 로컬 출처로 분류되는 프레임은 여전히 호출 가능 | 이 SPEC 범위 밖임을 명시 |
| R-6 | srcdoc 불투명 출처 프레임이 거부되는지는 WebView2가 `postMessage` 경로에서 출처를 어떻게 귀속하는지에 달려 있다(advisor 처방의 추정, 미검증). ACL은 호출이 도달했을 때 출처가 Remote로 분류되면 거부하지만, 불투명 출처가 어떤 분류를 받는지는 실기기 전에는 알 수 없다 | M-2 추가 항목(불투명 출처 프레임 시험)이 증거다. 거부가 확인되지 않으면 PREVIEW-019는 이 SPEC에 의존하는 설계를 재검토한다 |
| R-7 | Windows 실기기가 없으면 M-1·M-2의 Windows 판정을 할 수 없다 | 코디네이터가 기기 확보를 확인한다(plan.md §D-4). 없으면 Windows 판정은 "미검증 갭"으로 명시하고 SPEC을 completed로 닫지 않는다(implemented까지) |
| R-4 | `tauri dev`의 `devUrl`(http://localhost:1420) 출처가 `main` capability에서 로컬로 인정되는지 | M1에서 `tauri dev`로 확인 |
| R-5 | 실기기 탐침에서 기준선이 이미 안전(호출 실패)이면 SPEC의 긴급도 평가가 과장이었던 것 | REQ-007이 그 경우 사용자 보고를 요구; ACL 도입 자체는 PREVIEW-019의 전제라 유지 가치가 있음 |

## References

- `.moai/reports/plan-audit/SPEC-PREVIEW-018-advisor.md` § 1·§ 3·§ 4, `SPEC-PREVIEW-018-review-3.md` D1
- tauri 2.10.3 `src/webview/mod.rs:1780-1805`, tauri-build 2.5.6 `src/acl.rs`(`app_manifest_permissions`)
