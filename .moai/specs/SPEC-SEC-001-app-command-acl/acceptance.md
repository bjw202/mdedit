# SPEC-SEC-001 수용 기준

판정 규칙: 명령 뒤에 PASS/FAIL 조건을 적었다. `grep`은 일치 = 종료 코드 0이다. 모든 명령은 저장소 루트에서 실행한다. Rust 테스트는 `cargo test --manifest-path src-tauri/Cargo.toml`.

## 추적표

| REQ | AC |
|-----|----|
| REQ-SEC001-001 | AC-001 |
| REQ-SEC001-002 | AC-002 |
| REQ-SEC001-003 | AC-003 |
| REQ-SEC001-004 | AC-004, M-2 |
| REQ-SEC001-005 | AC-005, M-3 |
| REQ-SEC001-006 | AC-002, AC-006 |
| REQ-SEC001-007 | M-1, M-2 |
| REQ-SEC001-008 | AC-007 |
| REQ-SEC001-009 | AC-008 |

## 자동 검증

### AC-001: 매니페스트 호출 (REQ-001)
- Given `src-tauri/build.rs`
- When 내용을 검사하면
- Then `try_build`와 `app_manifest`와 `AppManifest::new().commands`를 모두 쓰고, 맨 끝의 `tauri_build::build()` 호출은 없다.
  - `grep -c "try_build" src-tauri/build.rs` → PASS = 1 이상; `grep -c "AppManifest::new().commands" src-tauri/build.rs` → PASS = 1 이상; `grep -c "tauri_build::build()" src-tauri/build.rs` → PASS = 0(종료 코드 1이어도 출력 0이면 통과)
- Then `cargo build --manifest-path src-tauri/Cargo.toml`이 종료 코드 0이다.

### AC-002: 명령 목록 일치 (REQ-002, 006)
- Given `src-tauri/app_commands.rs`의 `APP_COMMANDS`와 `src-tauri/src/lib.rs`의 `generate_handler!`
- When `cargo test --manifest-path src-tauri/Cargo.toml --test app_acl`을 실행하면
- Then `handler_list_matches_app_commands` 테스트가 통과하고 목록 길이가 26이다. `generate_handler!`에 명령 하나를 일부러 추가하고 `APP_COMMANDS`에는 넣지 않으면 이 테스트가 실패한다(RED 증거를 progress.md에 붙인다).

### AC-003: capability 구성 (REQ-003)
- Given `src-tauri/capabilities/*.json`
- When `capability_covers_every_app_command`와 `no_remote_urls` 테스트를 실행하면
- Then `main.json`의 `allow-*` 앱 권한 집합이 `APP_COMMANDS`의 kebab 변환(`read_file` → `allow-read-file`)과 정확히 같고, 모든 capability 파일에 `"remote"` 키가 없으며 `windows`는 `["main"]`이다.
  - `node -e "const c=require('./src-tauri/capabilities/main.json');process.exit(c.remote===undefined&&JSON.stringify(c.windows)==='[\"main\"]'?0:1)"` → PASS = 종료 코드 0

### AC-004: 거부 경로 단위 증명 (REQ-004)
- Given 빌드된 앱의 ACL 해석 결과(`gen/schemas` 또는 `OUT_DIR`의 `acl-manifests.json`·`capabilities.json`)
- When 앱 키(`__app__`) 항목을 읽으면
- Then 앱 매니페스트가 존재하고 `main` 창 로컬 출처에만 앱 명령이 연결되어 있다(원격 출처 규칙 0개).
  - 정확한 확인 명령은 M1에서 생성 산출물 경로를 확인한 뒤 progress.md에 확정해 적는다(경로가 plan 시점에 미확인). 확정 전에는 이 AC를 "명령 미확정 — 갭"으로 보고하고 M-2 실기기 판정이 거부 증거를 대신한다.

### AC-005: 프런트엔드 호출 계약 (REQ-005)
- Given `src/**`의 `invoke('…')` 문자열 리터럴
- When `npx vitest run src/test/appCommandAcl.contract.test.ts`를 실행하면
- Then 리터럴 명령 24개가 모두 `APP_COMMANDS`에 있고, 테스트가 통과한다(24는 plan 시점 직접 센 값 — run에서 테스트가 실제 개수를 출력한다).

### AC-006: 회귀 스위트 무손상 (REQ-006)
- Given 변경 후 전체 트리
- When `npm test`, `npm run lint`, `npx tsc --noEmit`, `cargo test --manifest-path src-tauri/Cargo.toml`을 실행하면
- Then 네 명령 모두 종료 코드 0이고 기존 테스트 수가 줄지 않는다(기준선 수는 M1 시작 때 기록).

### AC-007: 미사용 권한 정리 증거 (REQ-008, Should)
- Given 제거 후보 권한
- When `grep -rn "plugin-shell\|plugin-dialog" src` 를 실행하면
- Then 후보별로 (a) 프런트 import 없음이 출력 없음(종료 코드 1)으로 확인되고, (b) 제거했다면 M-3 스모크가 통과하며, (c) 제거하지 않았다면 progress.md에 사유가 있다. `opener:allow-open-path`·`opener:allow-reveal-item-in-dir`가 `main.json`에 남아 있다.
  - `grep -c "opener:allow-open-path" src-tauri/capabilities/main.json` → PASS = 1 이상

### AC-008: 안내 주석 (REQ-009)
- Given `src-tauri/app_commands.rs`
- When 머리 주석을 검사하면
- Then `capabilities/main.json`과 함께 고쳐야 한다는 문장이 있다.
  - `grep -c "main.json" src-tauri/app_commands.rs` → PASS = 1 이상

## 수동 검증 (실기기)

### M-1: 기준선 탐침 — 코드 변경 전 (REQ-007)
- Given `main` 빌드(HEAD 57b3231 이후, 매니페스트 적용 전)
- When plan.md §C M0의 탐침 HTML을 Windows와 macOS에서 미리보기로 열면
- Then 각 OS의 `internals` 값과 호출별 ok/err를 progress.md에 원문으로 기록한다. 판정은 두 가지: (a) Windows에서 `read_file` ok → 위험 확정, (b) 그 외 → 위험 평가 하향을 코디네이터에게 보고(SPEC은 PREVIEW-019 전제로 계속 유지). 어느 쪽이든 run이 진행된다.

### M-2: 적용 후 탐침 (REQ-004, 007)
- Given 매니페스트가 적용된 빌드
- When 같은 탐침을 Windows와 macOS에서 다시 열면
- Then `read_file`·`ai_policy_status`·`plugin:dialog|message` 호출이 모두 err(거부)이거나 `internals`가 `undefined`다. ok가 하나라도 있으면 FAIL이며 run을 멈추고 보고한다.
- 추가: `srcdoc` + `sandbox="allow-scripts"` 불투명 출처 프레임에서도 같은 호출을 시험해 거부를 확인한다(PREVIEW-019 전제 증거). 시험용 임시 HTML이며 저장소에 커밋하지 않는다.

### M-3: 전 기능 스모크 (REQ-005)
- Given 매니페스트가 적용된 `tauri dev` 빌드와 릴리스 빌드(macOS 필수, Windows는 가능한 한)
- When 다음을 차례로 수행하면: 폴더 열기·파일 열기·저장·다른 이름으로 저장·새 파일·이름 바꾸기·삭제·파일 변경 감시 알림·클립보드 이미지 붙여넣기·이미지 삽입·내보내기(HTML/DOCX 등 앱이 지원하는 것)·인쇄·AI 요청과 취소·`.md` 더블클릭 외부 열기·창 닫기 가드·탐색기에서 보기·기본 앱으로 열기
- Then 어느 단계도 "not allowed"/ACL 거부 오류 없이 동작한다. 개발 빌드 콘솔에 거부 로그가 0건이다.
