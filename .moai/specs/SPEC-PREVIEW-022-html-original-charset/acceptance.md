# SPEC-PREVIEW-022 수용 기준

판정 규칙: 각 항목 뒤에 PASS/FAIL 조건을 적었다. 명령은 저장소 루트에서 실행한다. Rust 테스트는 `~/.cargo/bin/cargo test --manifest-path src-tauri/Cargo.toml`로 로컬에서 실행한다(CI는 `cargo test`를 돌리지 않는다). 자동 항목은 권장안 X(plan.md §B) 기준이며, 사용자가 다른 설계를 고르면 AC-002·AC-003·AC-004의 경로와 허용 목록을 그 설계에 맞게 다시 쓴다.

## 추적표

| REQ | AC |
|-----|----|
| REQ-PREVIEW022-001 | AC-001, AC-009 |
| REQ-PREVIEW022-002 | AC-001, AC-009 |
| REQ-PREVIEW022-003 | AC-001, AC-009 |
| REQ-PREVIEW022-004 | AC-002, AC-004, AC-010 |
| REQ-PREVIEW022-005 | AC-004, AC-010 |
| REQ-PREVIEW022-006 | AC-004 |
| REQ-PREVIEW022-007 | AC-005, AC-011 |
| REQ-PREVIEW022-008 | AC-006, AC-007 |
| REQ-PREVIEW022-009 | AC-001, AC-002 |
| REQ-PREVIEW022-010 | AC-003 |
| REQ-PREVIEW022-011 | AC-008 |
| REQ-PREVIEW022-012 | AC-009 |

## Fixture

위치: `src-tauri/tests/fixtures/charset/`. 모든 HTML fixture는 ASCII로 된 같은 탐침 스크립트를 담는다. 스크립트는 `document.characterSet`과 `fetch(location.href)` 응답의 `content-type`을 `<pre id="probe">`에 쓴다. 한글 본문은 400자 이상이다.

| 파일 | 바이트 구성 | 기대 `Content-Type` |
|------|------------|--------------------|
| `utf8-no-meta.html` | UTF-8, BOM 없음, `<meta charset>` 없음, 한글 본문 | `text/html; charset=utf-8` |
| `utf8-tail-after-8k.html` | 앞 9,000바이트 이상 ASCII(주석 채움), 그 뒤 UTF-8 한글. BOM·meta 없음 | `text/html; charset=utf-8` |
| `euckr-tail-after-8k.html` | 앞 9,000바이트 이상 ASCII, 그 뒤 EUC-KR 한글. BOM·meta 없음 | `text/html` |
| `utf8-bom.html` | UTF-8 BOM + 한글, meta 없음 | `text/html; charset=utf-8` |
| `euckr-meta.html` | EUC-KR 한글 + `<meta charset="euc-kr">` | `text/html` |
| `euckr-no-meta.html` | EUC-KR 한글, BOM·meta 없음 | `text/html` |
| `utf16le-bom.html` | UTF-16LE BOM + 한글 | `text/html` |
| `subres/page.html` | UTF-8, meta 없음. 상대 경로 `img.png`, `style.css`(`content: "한글"` 규칙 포함)를 참조 | `text/html; charset=utf-8` |
| `subres/img.png`, `subres/style.css` | 하위 리소스 | 지금과 같은 헤더 |

- 미디어(`<video>`) 확인은 저장소에 큰 바이너리를 넣지 않기 위해 시험자가 가진 mp4를 `subres/`에 임시로 두고 한다(커밋하지 않는다).

## 자동 검증

### AC-PREVIEW022-001 — 판정 함수 표 (unit, REQ-001·002·003·009)

- **Given** `src-tauri/tests/asset_charset.rs`가 `charset.rs`의 `html_content_type`과 fixture를 `include_bytes!`로 불러올 때
- **When** `~/.cargo/bin/cargo test --manifest-path src-tauri/Cargo.toml --test asset_charset`을 실행하면
- **Then** 아래 표가 모두 통과하고 종료 코드가 0이다.

| `mime` | `full_body` | 기대 |
|--------|-------------|------|
| `"text/html"` | `utf8-no-meta.html` | `"text/html; charset=utf-8"` |
| `"text/html"` | `utf8-tail-after-8k.html` | `"text/html; charset=utf-8"` |
| `"text/html"` | `utf8-bom.html` | `"text/html; charset=utf-8"` |
| `"text/html"` | `b""`(빈 파일) | `"text/html; charset=utf-8"` |
| `"text/html"` | `euckr-tail-after-8k.html` | `"text/html"` |
| `"text/html"` | `euckr-meta.html` | `"text/html"` |
| `"text/html"` | `euckr-no-meta.html` | `"text/html"` |
| `"text/html"` | `utf16le-bom.html` | `"text/html"` |
| `"TEXT/HTML"` | `utf8-no-meta.html` | `"text/html; charset=utf-8"` |
| `"text/css"`, `"text/javascript"`, `"image/svg+xml"`, `"image/png"`, `"video/mp4"`, `"text/plain"` | `utf8-no-meta.html` | 입력 `mime` 그대로 |

- **And** `euckr-tail-after-8k.html`의 앞 8,192바이트만 잘라 넣으면 `"text/html; charset=utf-8"`이 나온다는 단언을 함께 둔다. 이는 앞부분만으로 판정하면 틀린다는 사실을 테스트로 고정한다(판정 함수가 아니라 호출 쪽이 전체를 넘겨야 한다는 근거).
- **And** 테스트가 fixture의 바이트 구성을 먼저 확인한다: `utf8-tail-after-8k.html`과 `euckr-tail-after-8k.html`은 길이가 8,192보다 크고 앞 8,192바이트가 모두 ASCII이며, `euckr-*` 파일은 `std::str::from_utf8`이 실패한다. fixture가 포매터 등으로 바뀌면 이 단언이 먼저 실패한다.

### AC-PREVIEW022-002 — Range·HEAD는 판정하지 않는다 (unit + 소스 확인, REQ-004·009)

- **Given** 같은 테스트 파일에서
- **Then** `html_content_type("text/html", None)`은 `"text/html"`이다.
- **And** 패치된 `src-tauri/vendor/tauri/src/protocol/asset.rs`에서 `html_content_type` 호출은 정확히 1곳이고 그 인자는 `Some(`로 시작한다. 판정: `grep -c 'html_content_type(' src-tauri/vendor/tauri/src/protocol/asset.rs` → PASS = `1`. Range·HEAD 분기의 헤더 줄이 바뀌지 않았다는 판정은 AC-004의 diff 허용 목록이 맡는다.

### AC-PREVIEW022-003 — 상류 추적 가드 (unit, REQ-010)

- **Given** `src-tauri/tests/asset_charset.rs`의 가드 테스트(기준 버전 상수 `2.10.3`)
- **When** `cargo test --test asset_charset`을 실행하면
- **Then** `Cargo.lock`의 `name = "tauri"` 항목이 `version = "2.10.3"`이고 그 항목에 `source =` 줄이 없을 때 통과한다.
- **And** RED 증거 두 건을 progress.md에 붙인다: (a) 패치 적용 전 트리(`source = "registry+…"`)에서 이 테스트가 실패한다. (b) 기준 버전 상수를 일부러 `2.10.4`로 바꾸면 실패하고, 실패 메시지에 `research.md §6` 문자열이 있다. 확인 뒤 되돌린다.

### AC-PREVIEW022-004 — 상류 diff 허용 목록 (REQ-004·005·006)

- **When** `diff -ru ~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/tauri-2.10.3 src-tauri/vendor/tauri`를 실행하면
- **Then** 차이는 다음 둘뿐이다: (1) `src/protocol/asset.rs` 수정, (2) `src/protocol/asset/charset.rs` 추가. 판정: `diff -rq … | sort` 출력이 정확히 두 줄(`Files …/src/protocol/asset.rs and … differ`, `Only in src-tauri/vendor/tauri/src/protocol: asset`)이다.
- **And** `diff -u …/src/protocol/asset.rs src-tauri/vendor/tauri/src/protocol/asset.rs`의 `+`/`-` 줄은 다음으로 한정된다: `mod charset;` 선언과 `use`, 100행의 `CONTENT_TYPE` 설정을 Range·HEAD·비Range GET 분기로 옮기는 줄, 비Range GET 분기의 `html_content_type` 호출, `@MX` 주석. 403·404·500 경로, `Access-Control-Allow-Origin`, `SafePathBuf`·`scope.is_allowed` 검사, 다중 범위 부분 헤더(198-199행), `CONTENT_LENGTH`·`CONTENT_RANGE`·`ACCEPT_RANGES` 줄은 diff에 없다. 검토 결과(허용 목록과 대조한 줄 목록)를 progress.md에 붙인다.

### AC-PREVIEW022-005 — 앱은 URI 스킴을 등록하지 않는다 (grep, REQ-007)

- **When** `grep -rn 'register_uri_scheme_protocol\|register_asynchronous_uri_scheme_protocol' src-tauri/src src-tauri/app_commands.rs src-tauri/build.rs`를 실행하면
- **Then** 출력이 없고 종료 코드가 1이다(plan 시점 기준선도 종료 코드 1).
- **And** `src-tauri/capabilities/` 아래 파일은 기준 커밋과 같다: `git diff --quiet <base>...HEAD -- src-tauri/capabilities` → PASS = 종료 코드 0.

### AC-PREVIEW022-006 — 프런트엔드·구성 무변경 (git diff, REQ-008)

- **When** `git diff --name-only <base>...HEAD`를 실행하면
- **Then** `src/`, `index.html`, `src-tauri/src/`, `src-tauri/capabilities/`, `src-tauri/tauri.conf.json`, `src-tauri/build.rs`로 시작하는 경로가 없다. 판정: `git diff --name-only <base>...HEAD | grep -E '^(src/|index\.html$|src-tauri/src/|src-tauri/capabilities/|src-tauri/tauri\.conf\.json$|src-tauri/build\.rs$)'` → PASS = 출력 없음, 종료 코드 1.

### AC-PREVIEW022-007 — 회귀 스위트 (REQ-005·008)

- **When** `npm run typecheck`, `npm run lint`, `npx vitest run`, `~/.cargo/bin/cargo build --manifest-path src-tauri/Cargo.toml`, `~/.cargo/bin/cargo test --manifest-path src-tauri/Cargo.toml`을 실행하면
- **Then** 다섯 명령 모두 종료 코드 0이고, 기존 테스트 수가 줄지 않는다(기준선 수는 M1 시작 때 같은 명령으로 기록). `cargo test`에는 SPEC-SEC-001의 `app_acl` 테스트가 포함된다.
- 참고: 이 worktree 안에 중첩 worktree 사본이 남아 있으면 `npx vitest run`이 그 사본까지 돌 수 있다(SPEC-PREVIEW-020 progress 기록). 그 경우 제외 경로를 명시한 명령과 결과를 함께 기록한다.

## 실기기 수동 검증

수동 항목은 우리가 자동화로 관찰한 값이 아니다. 결과(OS, 빌드 SHA, 화면의 `probe` 출력, 캡처 경로)를 progress.md에 남긴다. macOS는 기본이 선명 모드이므로 토글로 원본 보기를 고른 뒤 확인한다. Windows는 원본 보기가 기본이다. Windows 확인은 사용자가 한다.

### AC-PREVIEW022-008 — M-1 수정 전 재현 (REQ-011)

- **Given** 수정 전 빌드(기준 `cdaadcf` 또는 그 위의 fixture 커밋만 있는 빌드)
- **When** `utf8-no-meta.html`과 `euckr-meta.html`을 원본 보기로 열면
- **Then** 각 OS에 대해 `probe`의 `content-type`, `characterSet`, 한글 표시 상태(깨짐/정상)를 기록한다. 가설에 맞는 결과는 `utf8-no-meta.html`이 `content-type: text/html`(charset 없음), `characterSet`이 UTF-8이 아님, 한글 깨짐이다.
- **멈춤**: `content-type`에 charset이 있거나 `utf8-no-meta.html`의 한글이 정상이면 run을 멈추고 차단 보고를 돌려준다.

### AC-PREVIEW022-009 — M-2 수정 확인 (REQ-001·002·003·012)

- **Given** 수정 후 빌드
- **When** 위 표의 HTML fixture를 모두 원본 보기로 열면
- **Then** 두 OS 모두에서:
  - `utf8-no-meta.html`, `utf8-tail-after-8k.html`, `utf8-bom.html`: `content-type: text/html; charset=utf-8`, `characterSet: UTF-8`, 한글 정상(8 KB 뒤 한글 포함).
  - `euckr-meta.html`: `content-type: text/html`, `characterSet: EUC-KR`, 한글 정상.
  - `euckr-tail-after-8k.html`, `euckr-no-meta.html`, `utf16le-bom.html`: `content-type: text/html`. 표시는 M-1과 같다(`euckr-no-meta.html`은 수정 전처럼 해석되며 범위 밖, `utf16le-bom.html`은 BOM으로 정상).
- **And** 같은 fixture를 선명 모드로 열면 수정 전과 같게 보인다(선명 모드 무영향).

### AC-PREVIEW022-010 — M-3 회귀 (REQ-004·005)

- **Given** 수정 후 빌드
- **Then** 두 OS 모두에서:
  - `subres/page.html`의 이미지가 보이고 CSS가 적용되며 CSS의 `content: "한글"`이 정상으로 보인다.
  - 이미지 뷰어로 PNG·JPG·SVG 파일이 보인다.
  - 마크다운 미리보기에서 상대 경로 이미지가 보인다.
  - `<video controls src="sample.mp4">`를 담은 UTF-8 HTML에서 재생과 탐색(seek)이 된다(WebKit은 미디어를 Range로 요청한다).

### AC-PREVIEW022-011 — M-4 보안 탐침 (REQ-007)

- **Given** 수정 후 빌드와 SPEC-SEC-001 M-2·M-2b 방식의 탐침 HTML(`.moai/state/verify/preview-022-probe/`에 두고 커밋하지 않는다)
- **When** 탐침을 원본 보기로 열고, 링크 클릭과 `<meta http-equiv="refresh">`로 다른 asset 경로 탐침 문서로 이동한 뒤에도 같은 호출을 하면
- **Then** 두 OS 모두에서 `read_file`, `ai_policy_status`, `plugin:app|version` 호출이 모두 거부(err)되거나 `__TAURI_INTERNALS__`가 없다. 하나라도 ok이면 FAIL이며 SPEC은 병합하지 않는다.
- 탐침에는 파괴적 명령(`write_file`, `delete_file`, `plugin:opener|open_path`)을 넣지 않는다.

## Definition of Done

- AC-001~AC-007이 PASS이고 증거(명령, 출력)가 progress.md §E.2에 있다.
- AC-008~AC-011이 macOS·Windows에서 PASS로 기록되어 있다. Windows는 사용자 보고로 기록할 수 있으며, 그 경우 "캡처 없음"을 함께 적는다.
- Windows 판정이 없으면 SPEC은 `implemented`까지만 닫는다.
