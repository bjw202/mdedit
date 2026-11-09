# Sync Audit Report: SPEC-SEC-001

SPEC: SPEC-SEC-001 (앱 명령 ACL 매니페스트, Tier M, harness thorough)
대상: 브랜치 `WT-app-acl`, HEAD `36c5a8d`, 범위 `26e669d..HEAD`
감사자: sync-auditor (독립 재실행, progress.md 주장은 신뢰하지 않고 직접 실행)
감사 일자: 2026-11-09
Overall Verdict: **PASS (조건부)** — 종합 0.82 (조화평균), must-pass 3개 모두 충족. 단 이 PASS는 "자동 검증과 소스 판독 기준"이다. 실기기 M-1/M-2/M-2b/M-3은 아무도 수행하지 않았으므로 SPEC 상태는 `implemented`가 맞고 `completed`로 닫으면 안 된다.

## 쉬운 말 요약

이 변경은 "앱이 직접 만든 명령 26개"에 출입 허가 절차(ACL)를 거는 작업입니다. 지금까지는 허가 절차 자체가 꺼져 있어서, 미리보기에 연 악성 HTML이 파일 읽기·쓰기 명령을 부를 수 있다는 가설이 있었습니다. 이번 변경으로 절차가 켜지고, 메인 창에만 26개 명령이 허용됩니다. 저는 자동 검사 8가지를 전부 직접 다시 돌려 통과를 확인했고, 명령 목록 세 곳(등록 목록, 허용 목록, 권한 파일)이 서로 정확히 일치한다는 것도 테스트와 별개로 직접 비교해 확인했습니다. 제거한 shell·dialog 권한은 프런트엔드가 쓰지 않는다는 것도 확인했습니다. 다만 "실제로 거부되는지", "기존 기능이 안 깨졌는지"를 기기에서 눈으로 본 증거는 없습니다.

## 1. 재실행한 검증 명령 (이 run, 이 트리, HEAD 36c5a8d)

원문 출력은 `.moai/state/verify/sync-sec001/`에 보관했다(cargo-app-acl.txt, cargo-build.txt, cargo-all.txt, vitest-contract.txt, vitest-all.txt, lint.txt, tsc.txt, handler.txt, appcmds.txt, defs.txt, capcmds.txt). 아래는 실제로 본 출력의 발췌다.

주의: 이 셸에서는 `cargo`가 PATH에 없어 첫 시도가 `exit=127 / command not found: cargo`로 실패했다. `PATH="$HOME/.cargo/bin:$PATH"`를 앞에 붙여 재실행했다. 또 `build.rs`가 실제로 다시 돌게 하려고 `touch src-tauri/app_commands.rs`(내용 변경 없음, 수정 시각만)를 한 번 했다.

| AC | 명령 | 관측 결과 | 판정 |
|----|------|----------|------|
| AC-001 | `grep -v '^[[:space:]]*//' src-tauri/build.rs \| tr -d '[:space:]' > b.txt; grep -c ...` | `try_build: 1` / `app_manifest(: 1` / `build(): 0` | PASS |
| AC-001 | `cargo build --manifest-path src-tauri/Cargo.toml` (build.rs 재실행) | `cargo build exit=0` / `Compiling mdedit v0.19.0 ...` / `Finished dev profile [unoptimized + debuginfo] target(s) in 4.77s` / `dup/already: 0` | PASS |
| AC-002 | `cargo test --manifest-path src-tauri/Cargo.toml --test app_acl` | `test handler_list_matches_app_commands ... ok` / `capability_covers_every_app_command ... ok` / `no_remote_urls ... ok` / `test result: ok. 3 passed; 0 failed` / `cargo test exit=0` | PASS |
| AC-003 | `node -e "const c=require('./src-tauri/capabilities/main.json');process.exit(c.remote===undefined&&JSON.stringify(c.windows)==='[\"main\"]'?0:1)"` | `exit=0` | PASS |
| AC-004 | `node -e "...acl-manifests.json['__app-acl__'] ... capabilities.json main-capability ..."` (build 직후 gen/schemas) | 출력 `26` / `remote undefined windows ["main"]` / `AC-004 exit=0` | PASS |
| AC-005 | `npx vitest run src/test/appCommandAcl.contract.test.ts src/test/exportOpenRegressionGuard.test.ts` | `invoke 리터럴 명령 26개` / `Test Files 2 passed (2)` / `Tests 5 passed (5)` / `vitest exit=0` | PASS |
| AC-006 | `npx vitest run` (전체) | `Test Files 111 passed (111)` / `Tests 1835 passed (1835)` / exit 0 | PASS |
| AC-006 | `cargo test --manifest-path src-tauri/Cargo.toml` (전체) | lib `367 passed; 0 failed`, tests/app_acl.rs `3 passed`, `cargo test all exit=0` | PASS |
| AC-006 | `npm run lint` | `eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0` / `lint exit=0` | PASS |
| AC-006 | `npx tsc --noEmit` | 출력 없음 / `tsc exit=0` | PASS |
| AC-007 | `grep -rnE "from ['\"]@tauri-apps/plugin-(shell\|dialog)" src --exclude-dir=test` | 출력 없음 / `exit=1` | PASS |
| AC-007 | `grep -cE '"(shell\|dialog):allow-' main.json` / `grep -c "opener:allow-open-path" main.json` | `shell/dialog perms: 0` / `opener: 1` | PASS |
| AC-008 | `grep -c "main.json" src-tauri/app_commands.rs` | `2` | PASS |

AC-006의 "기존 테스트 수가 줄지 않는다"는 기준선(1833)을 progress.md에서 가져왔다. 기준선은 내가 변경 전 트리에서 다시 측정하지 않았다(이월). 현재 111 파일 / 1835 테스트와 +2(계약 테스트 2개)는 산술적으로 맞는다. RED 증거(AC-002, AC-004, AC-006(a))는 재현하지 않았고 progress.md 기재를 그대로 둔다(Gap).

## 2. 보안 검토 (독립 교차 확인)

(a) 명령 목록 일치 — 테스트와 무관하게 셸로 직접 추출해 비교했다. `generate_handler!`(lib.rs), `APP_COMMANDS`, `#[tauri::command]` 정의, `main.json`의 `allow-*`(kebab→snake 변환) 네 집합이 각각 26개이고 `diff`가 세 번 모두 `SAME`이었다(handler vs appcmds, handler vs defs, handler vs cap). 통과.

(b) 정의됐지만 미등록인 `#[tauri::command]`: 없음. 정의 26개 = 등록 26개(`diff` SAME). 플러그인이 등록한 앱 명령도 없다. `register_uri_scheme_protocol` 사용 0건(`grep exit=1`).

(c) capability: `src-tauri/capabilities/`에 `main.json` 1개뿐. `"remote"`·`"webviews"`·`"urls"` 키 없음. `"windows": ["main"]`만 존재(grep 결과 한 줄). 창 라벨은 `tauri.conf.json`에 `label`이 없어 기본값 `main`이다. 추가 창 생성 코드(`WebviewWindowBuilder` 등)는 `src-tauri/src`에서 0건. 통과.

(d) main.json에 남은 플러그인 권한과 제거된 권한의 실제 사용 여부:
- 제거된 `dialog:allow-open/save/message`: 프런트엔드 비테스트 소스의 `@tauri-apps/` import는 `api/core`, `api/event`, `api/window`, `plugin-opener`뿐이다(`plugin-dialog`/`plugin-shell` 0건, 동적 `import()`도 같은 grep에 포함되어 0건). `plugin:` 문자열 직접 호출도 비테스트 소스에서 주석 외 0건. Rust의 `tauri_plugin_dialog::DialogExt`(directory_ops.rs:83, file_ops.rs:165/208, image_ops.rs:249)는 Rust 쪽 직접 호출이라 IPC ACL을 거치지 않으므로 권한 제거와 무관하다.
- 제거된 `shell:allow-execute/spawn`: `ShellExt` 사용 0건, 프런트 import 0건. 사용처 없음.
- 유지된 `opener:*`: `src/lib/tauri/ipc.ts`가 `openPath`, `revealItemInDir`를 import — 유지가 맞다.
- `core:default` + `core:window:allow-destroy`: `useWindowCloseGuard.ts`가 `getCurrentWindow().onCloseRequested`를, 훅들이 `listen(...)`(`ai://chunk|done|error`, `file-changed`, `open-file`)를 쓴다. Rust의 `emit` 대상과 일치한다.
- 결론: "여전히 쓰이는데 제거된 권한"은 정적으로 발견되지 않았다. 단 M-3 스모크 없이 정적 근거만이다(F1 참조).

(e) tauri 2.10.3 소스 판독 (`~/.cargo/registry/src/.../tauri-2.10.3`):
- `src/webview/mod.rs:1801-1805`: 검사 조건이 `(plugin_command.is_some() || has_app_acl_manifest) && invoke.acl.is_none()`이다. 매니페스트가 생기면 앱 명령도 검사 대상이 된다. SPEC 서술과 일치.
- `mod.rs:1680-1721 is_local_url`: 로컬 판정은 (1) `tauri://` 프로토콜, (2) `get_app_url().make_relative(url)`, (3) 사용자 등록 커스텀 스킴이다. `asset` 스킴은 `manager/webview.rs:308-315`에서 pending 웹뷰에 등록되고 매니저의 `uri_scheme_protocols` 맵(사용자 등록 전용, :74/:105)에는 들어가지 않는다. 이 앱은 사용자 스킴을 등록하지 않는다. 따라서 asset 출처 프레임은 Remote로 분류되어 `main` capability(원격 지정 없음)에 걸리지 않는다. 가장 중요한 전제였고 소스상 성립한다.
- R-4(`tauri dev`의 devUrl): `manager/mod.rs:345-359 get_app_url`이 `#[cfg(dev)]`에서 `dev_url`(http://localhost:1420)을 돌려주고 `make_relative`가 Some이면 로컬이다. 소스상 dev 로컬 출처는 인정된다. 실행 검증은 아니다.
- 불투명 출처(R-6): `src/ipc/protocol.rs:491-499`는 커스텀 프로토콜 IPC에서 `Origin` 헤더를 `Url::parse`하고 실패하면 요청을 오류로 거절한다. srcdoc+sandbox 프레임의 `Origin: null`은 파싱에 실패하므로 이 경로에서는 거절된다(소스상). postMessage 경로(`protocol.rs:302`)는 wry가 전달하는 `request.uri()`에 의존하므로 WebView2/WKWebView 실동작은 소스만으로 확정할 수 없다. 여전히 실기기(M-2/M-2b) 항목이다.

(f) 동적 `invoke(변수)`: `grep -rnE "invoke(<[^>]*>)?\(\s*[^'\"\` )]" src ...` 비테스트 결과는 `src/lib/ai/aiEventRouter.ts:51: invoke(sub.handlers);` 한 건이다. 이 `invoke`는 Tauri가 아닌 로컬 함수 호출이다(Tauri `invoke` import는 `ipc.ts`, `useFileWatcher.ts` 2곳뿐). 템플릿 리터럴 `invoke(\`...\`)`는 0건. 따라서 정적 계약 테스트가 놓치는 실제 동적 호출은 발견되지 않았다.

## 3. 문서 일관성

- spec.md `version: 0.2.3`, `status: implemented`: 자동 AC 8/8 PASS를 내가 재확인했고, 수동 항목이 미수행이므로 `implemented` 정당, `completed` 불가(R-7과 acceptance.md 수동 검증 머리말과 일치).
- CHANGELOG `[Unreleased] ### Security`의 수치 주장(AC-001~008 PASS, vitest 1835/111 파일, cargo lib 367 + app_acl 3, debug 빌드 exit 0)은 내 재실행과 일치한다. 커밋 b1f64c3/4ed9aaf/251b3e0는 `git log 26e669d..HEAD`에 존재한다. 수동 검사가 통과했다는 주장은 없고 오히려 M-1/M-2/M-2b/M-3 미수행을 명시한다(좋음).
- M-2b는 acceptance.md(3곳), spec.md(3곳), progress.md(6곳)에 존재한다. 탐침 파일 5개가 gitignore 경로(`.gitignore:262 **/.moai/state/*`)에 실제로 있다. 변경된 `src-tauri/gen/`·`src-tauri/permissions/autogenerated/`도 gitignore 처리(`.gitignore:247,249`)라 저장소가 더러워지지 않는다.

## 4. 평가 점수

| Dimension | 점수 | 판정 | 근거 |
|-----------|------|------|------|
| Functionality (40%) | 0.80 | PASS | 자동 AC 8개를 모두 직접 재실행해 통과. 목록 세 곳 독립 비교 일치. 단 핵심 결과("거부가 실제로 동작", "26개 기능 무회귀")를 기기에서 본 증거가 없다. M-1·M-2·M-2b·M-3 전부 미수행. |
| Security (25%) | 0.85 | PASS | 소스로 asset 출처가 Remote로 분류됨을 확인, remote/와일드카드 창 없음, 사용 중인 권한 제거 없음, 미사용 shell/dialog 권한 제거로 노출면 축소. 불투명 출처의 postMessage 경로는 미검증(R-6). |
| Craft (20%) | 0.80 | PASS | RED→GREEN 흐름이 progress.md에 있고 lint/tsc 클린. 테스트는 정확하나 파서가 취약(F2)하고 Rust 테스트는 CI에 없음. 커버리지 도구는 실행하지 않음(설정·목록 변경이라 라인 커버리지가 의미 없음, Gap으로 기재). |
| Consistency (15%) | 0.82 | PASS | 주석 한국어(`code_comments: ko`), @MX 태그 형식, CHANGELOG 문체가 기존 항목과 같다. REQ-008 선행 조건 위반(F1)과 CHANGELOG 단일 장문 항목 정도. |

종합(조화평균) = 4 / (1/0.80 + 1/0.85 + 1/0.80 + 1/0.82) = 4 / 4.896 = **0.817 → 0.82**. 임계 0.80 이상.

Must-pass 확인: (1) 자동 AC 전부 내 재실행으로 통과 — 충족. (2) 아직 쓰이는 권한 제거 없음 — 정적으로 충족(M-3 미수행 단서 포함). (3) remote capability 없음 — 충족.

## 5. 결함 목록 (Findings)

BLOCKING 결함: 없음.

- F1 [SHOULD-FIX] [optional] `.moai/specs/SPEC-SEC-001-app-command-acl/spec.md` REQ-SEC001-008 / `acceptance.md` AC-007 — REQ-008은 "M-3(전 기능 스모크)를 마친 뒤에만 수행한다"이고 AC-007의 Given도 "M-3 스모크가 통과한 뒤의 main.json"인데, 실제로는 M-3 없이 정적 근거만으로 4ed9aaf에서 먼저 제거했다(progress.md L96에 스스로 기록). 내 재검증으로 "여전히 쓰이는 권한 제거"는 정적 범위에서 없었고 롤백 커밋도 명시돼 있어 위험은 낮다. Required fix: `completed` 전환 전에 M-3 스모크로 확정하거나, 거부가 나오면 4ed9aaf(+251b3e0)만 되돌린다. SPEC 본문을 고치는 일이 아니라 수행 순서의 보고이므로 progress.md에 "REQ-008은 M-3 이전에 선행, M-3에서 사후 확정" 한 줄 유지로 충분.
- F2 [SHOULD-FIX] [optional] `src-tauri/tests/app_acl.rs:20-33` — `handler_commands()`가 `generate_handler![` 이후 첫 `]`까지를 자르고 `,`로 분할한다. 목록 안에 인라인 주석(`//`)이나 `#[cfg(...)]` 항목이 생기면 잘못 파싱하거나 잘못 통과/실패할 수 있다. 현재 목록에서는 정확함(내 독립 추출과 일치). Required fix: 필요해지는 시점에 주석 줄 제거·`#[cfg]` 항목 처리를 추가. 지금 고치면 과설계이므로 선택 사항.
- F3 [MINOR] [optional] `src-tauri/Cargo.toml:26-27`, `src-tauri/src/lib.rs:37-38` — `tauri-plugin-shell`은 Rust에서도 프런트에서도 쓰이지 않는데 `.plugin(tauri_plugin_shell::init())`로 여전히 초기화된다. 권한이 없어 호출은 막히지만 죽은 의존성이다. SPEC 범위는 권한 제거까지라 이번에는 범위 밖. Required fix: 후속 정리 SPEC 후보(지금 변경하지 않음).
- F4 [MINOR] [optional] `.moai/specs/SPEC-SEC-001-app-command-acl/spec.md` R-4 / progress.md Gaps — R-4(devUrl 로컬 인정)는 소스 판독으로 `cfg(dev)`에서 devUrl이 앱 URL로 쓰인다는 근거가 생겼다. Required fix: M-3(`tauri dev`)에서 거부 로그 0건이면 R-4를 닫고, 소스 근거(`manager/mod.rs:345-359`)를 progress.md에 한 줄 추가.
- F5 [MINOR] [optional] 환경 — 이 셸은 `cargo`가 PATH에 없다. 수동 검증자에게는 `~/.cargo/bin`을 PATH에 넣어야 한다는 점을 알리는 정도. Required fix: 없음(참고).
- F6 [INFO] 계약 테스트 한계 — 정규식이 `\binvoke(...)('literal'`만 잡는다. 다른 이름으로 import한 `invoke`나 래퍼 호출은 못 잡는다. 현재 `invoke` import는 2개 파일뿐이라 실제 누락은 없다(내 grep 확인). 조치 불필요.

## 6. 권고

- SPEC은 `implemented`로 유지. `completed`로 가려면 M-1(기준선), M-2·M-2b(적용 후 탐침, macOS 필수·Windows 가능 시), M-3(전 기능 스모크, 릴리스 빌드 포함)이 필요하다.
- 릴리스 전 M-3은 사실상 필수다. 권한이 하나 빠져도 빌드와 모든 자동 테스트는 통과하고, 실행할 때만 거부된다.
- PREVIEW-019가 이 SPEC에 의존한다. 불투명 출처 거부는 소스상 `Origin: null` 경로에서 거절되는 근거가 있으나 postMessage 경로는 M-2 추가 항목 결과로 확정해야 한다.

## 7. Gaps (관측하지 못한 것)

- M-1, M-2, M-2b, M-3 전부(기기에서 앱을 실행해 본 증거 없음), Windows 전 항목.
- 불투명 출처(srcdoc) postMessage 경로의 실제 분류(R-6), `tauri dev` 실행 중 R-4.
- RED 증거(AC-002/004/006(a))와 AC-006 기준선 테스트 수 1833은 progress.md 기재를 이월했고 재현하지 않았다.
- 릴리스(`--release`) 빌드와 번들 빌드는 실행하지 않았다(debug 빌드만).
- 커버리지 도구와 `cargo clippy`는 실행하지 않았다(`cargo clippy` 미실행은 프로젝트 게이트가 아니라는 판단이 아니라 단순 미실행).
- 교차 모델 감사(`audit_multi`)는 사용하지 않았다(`audit_model` 설정을 확인하지 않았고, Claude 단독 감사).

## 8. Residual Risk

- 권한 누락형 결함은 빌드와 자동 테스트를 모두 통과하고 런타임에서만 드러난다(목록 일치 테스트가 완화하지만 `core:*` 등 플러그인 권한 쪽 누락은 이 테스트가 보지 않는다).
- Rust 드리프트 테스트는 CI에서 돌지 않는다(`frontend-gates.yml`이 의도적으로 금지). 새 명령을 추가하고 로컬 `cargo test`를 건너뛰면 런타임 거부로 이어진다.
- 메인 창 자체의 임의 탐색(`on_navigation` 제한 없음)은 이 SPEC 범위 밖이며, 로컬 출처로 분류되는 프레임은 여전히 호출 가능하다(SPEC R-3 명시).
