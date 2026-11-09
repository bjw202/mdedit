# SPEC-PREVIEW-022 수용 기준

판정 규칙: 각 항목 뒤에 PASS/FAIL 조건을 적었다. 명령은 저장소 루트에서 실행한다. Rust 테스트는 `~/.cargo/bin/cargo test --manifest-path src-tauri/Cargo.toml`로 로컬에서 실행한다(CI는 `cargo test`를 돌리지 않는다).

- 자동 항목은 안 X(plan.md §B)를 기준으로 쓴다. 구현 승인 때 변형 X2를 고르면 요구사항은 그대로지만 AC-001~004는 그대로 쓸 수 없으므로, 다시 계획하고 재감사를 받는다(plan.md §D-1).
- `<base>`는 `$(git merge-base origin/main HEAD)`다. plan 시점 값은 `cdaadcf`다.

## 추적표

| REQ | AC |
|-----|----|
| REQ-PREVIEW022-001 | AC-001, AC-009 |
| REQ-PREVIEW022-002 | AC-001, AC-009 |
| REQ-PREVIEW022-003 | AC-001, AC-009 |
| REQ-PREVIEW022-004 | AC-002, AC-004, AC-010 |
| REQ-PREVIEW022-005 | AC-004, AC-007, AC-010 |
| REQ-PREVIEW022-006 | AC-004 |
| REQ-PREVIEW022-007 | AC-005, AC-011 |
| REQ-PREVIEW022-008 | AC-006, AC-007 |
| REQ-PREVIEW022-009 | AC-001, AC-002 |
| REQ-PREVIEW022-010 | AC-003 |
| REQ-PREVIEW022-011 | AC-008 |
| REQ-PREVIEW022-012 | AC-009 |

## 검증 경로

`release.yml`은 정식 버전 태그(`v[0-9]+.[0-9]+.[0-9]+`) push에서만 돌고 초안 릴리스만 만든다. 병합 전에 Windows 빌드를 만드는 CI 경로가 없다. 그래서 검증을 두 단계로 나눈다(SPEC-PREVIEW-020과 같은 방식).

| 단계 | 대상 빌드 | 확인 항목 | 통과 시 상태 |
|------|----------|----------|-------------|
| 병합 전 | macOS: 브랜치 HEAD 로컬 빌드(원본 보기는 토글로 선택) | 자동 AC-001~007, 수동 AC-008(재현), AC-009·010·011(macOS) | 병합 가능. sync에서 `implemented` |
| 병합 뒤 | Windows: 다음 릴리스 태그가 만든 초안 릴리스의 설치 파일 | 수동 AC-009·010·011(Windows) | `completed`로 닫는 PR |

- Windows를 더 일찍 확인하는 방법은 사용자가 고른다. (a) 사용자가 Windows에서 브랜치 HEAD를 `npm run tauri build`로 로컬 빌드한다. (b) 사용자가 승인한 정식 버전 태그로 초안 릴리스를 먼저 만든다(`-rc` 같은 프리릴리스 태그로는 `release.yml`이 돌지 않는다). 어느 경우든 Windows 판정은 같은 AC로 하고 빌드 SHA를 기록한다.
- 모든 수동 기록에는 OS, 빌드 SHA(또는 릴리스 버전), `probe` 출력, 캡처 경로를 적는다. Windows 기록은 사용자 보고로 남길 수 있다. 캡처가 없으면 "캡처 없음"을 함께 적는다.

## Fixture

위치: `src-tauri/tests/fixtures/charset/`. `.gitattributes`에 `src-tauri/tests/fixtures/charset/** binary`를 둔다. 모든 HTML fixture에는 ASCII로 된 같은 탐침 스크립트가 들어 있다. 스크립트는 `<pre id="probe">`에 두 값을 쓴다.

- `characterSet`: `document.characterSet`. **문서 자체의 판정 신호.**
- `content-type`: `fetch(location.href)` 응답의 값. 문서 요청과 다른 별도 요청이므로 **보조 기록**이다.

한글 본문은 400자 이상이다.

| 파일 | 바이트 구성 | 판정 함수 기대값 |
|------|------------|-----------------|
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

- **And** `euckr-tail-after-8k.html`의 앞 8,192바이트만 잘라 넣으면 `"text/html; charset=utf-8"`이 나온다는 단언을 함께 둔다. 앞부분만으로 판정하면 틀린다는 사실을 테스트로 고정한다(판정 함수가 아니라 호출 쪽이 전체를 넘겨야 한다는 근거).
- **And** 테스트가 fixture의 바이트 구성을 먼저 확인한다. `utf8-tail-after-8k.html`과 `euckr-tail-after-8k.html`은 길이가 8,192보다 크고 앞 8,192바이트가 모두 ASCII다. `euckr-*` 파일은 `std::str::from_utf8`이 실패한다. fixture가 포매터 등으로 바뀌면 이 단언이 먼저 실패한다.

### AC-PREVIEW022-002 — Range·HEAD는 판정하지 않는다 (unit + 소스 확인, REQ-004·009)

- **Given** 같은 테스트 파일에서
- **Then** `html_content_type("text/html", None)`은 `"text/html"`이다.
- **And** 패치된 `asset.rs`에서 주석을 뺀 줄 중 판정 호출은 정확히 1곳이고, 그 형태는 `html_content_type(&mime_type, Some(&buf))`다. 판정: `grep -v '^[[:space:]]*//' src-tauri/vendor/tauri/src/protocol/asset.rs | grep -c 'html_content_type(&mime_type, Some(&buf))'` → PASS = `1`. 같은 방식으로 `grep -c 'html_content_type('` → PASS = `1`(다른 호출 없음). Range·HEAD 분기가 바뀌지 않았다는 판정은 AC-004가 맡는다.

### AC-PREVIEW022-003 — 상류 추적 가드 (unit, REQ-010)

- **Given** `src-tauri/tests/asset_charset.rs`의 가드 테스트(기준 버전 상수 `2.10.3`)
- **When** `cargo test --test asset_charset`을 실행하면
- **Then** `Cargo.lock`의 `name = "tauri"` 항목이 `version = "2.10.3"`이고 그 항목에 `source =` 줄이 없을 때 통과한다.
- **And** RED 증거 두 건을 progress.md에 붙인다. (a) 패치 적용 전 트리(`source = "registry+…"`)에서 이 테스트가 실패한다. (b) 기준 버전 상수를 일부러 `2.10.4`로 바꾸면 실패하고, 실패 메시지에 `research.md §6` 문자열이 있다. 확인 뒤 되돌린다.

### AC-PREVIEW022-004 — 상류 diff 허용 목록 (REQ-004·005·006)

- **Given** `~/.cargo/bin/cargo build --manifest-path src-tauri/Cargo.toml`을 마친 작업 트리(빌드가 vendor 사본 안의 `permissions/*/autogenerated/`를 다시 쓸 수 있으므로 반드시 빌드 뒤에 실행한다)
- **When** `diff -rq ~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/tauri-2.10.3 src-tauri/vendor/tauri | grep -v '/permissions/[^ ]*/autogenerated'`를 실행하면
- **Then** 출력이 정확히 두 줄이다.
  - `Files …/src/protocol/asset.rs and src-tauri/vendor/tauri/src/protocol/asset.rs differ`
  - `Only in src-tauri/vendor/tauri/src/protocol: asset`
- **And** 걸러 낸 `permissions/*/autogenerated` 경로의 차이는 `build.rs`의 재생성으로만 생긴 것이어야 한다. M2에서 기록한 목록(progress.md)과 같아야 하며, 그 밖의 경로에서는 차이가 없어야 한다. 숨김 파일(`.cargo-ok`, `.cargo_vcs_info.json`)은 그대로 복사했으므로 차이로 나오지 않는다.
- **And** `diff -u …/src/protocol/asset.rs src-tauri/vendor/tauri/src/protocol/asset.rs`에 `-` 줄(지운 줄)이 없다. 판정: `diff -u … | tail -n +3 | grep -c '^-'` → PASS = 출력 `0`(앞 두 줄은 `---`·`+++` 머리글이라 건너뛴다. 빈 줄을 지운 경우도 센다). `+` 줄은 다음으로 한정된다.
  - `mod charset;` 선언과, 필요하면 `HeaderValue` 사용을 위한 `use` 한 줄
  - 마지막 `else` 분기(Range도 HEAD도 아닌 분기) 안에서 본문을 얻은 뒤 `html_content_type(&mime_type, Some(&buf))`를 계산하고, 결과가 `mime_type`과 다를 때만 `resp.headers_mut()`로 `CONTENT_TYPE`을 `insert`(교체)하는 줄
  - `@MX` 주석
- **And** 100행 `resp = resp.header(CONTENT_TYPE, &mime_type);`, Range 분기(단일·다중 범위, 184-187행과 198-199행 포함), HEAD 분기, 403·404·500 경로, `Access-Control-Allow-Origin`, `SafePathBuf`·`scope.is_allowed` 검사, `CONTENT_LENGTH`·`CONTENT_RANGE`·`ACCEPT_RANGES` 줄은 바뀌지 않는다(`-` 줄 0개로 보장된다). `+` 줄 목록을 허용 목록과 대조한 결과를 progress.md에 붙인다.

### AC-PREVIEW022-005 — 앱은 URI 스킴을 등록하지 않는다 (grep, REQ-007)

- **When** `grep -rn 'register_uri_scheme_protocol\|register_asynchronous_uri_scheme_protocol' src-tauri/src src-tauri/app_commands.rs src-tauri/build.rs`를 실행하면
- **Then** 출력이 없고 종료 코드가 1이다(plan 시점 기준선도 종료 코드 1).
- **And** `src-tauri/capabilities/` 아래 파일은 `<base>`와 같다. 판정: `git diff --quiet "$(git merge-base origin/main HEAD)" HEAD -- src-tauri/capabilities` → PASS = 종료 코드 0.

### AC-PREVIEW022-006 — 프런트엔드·구성 무변경 (git diff, REQ-008)

- **When** `git diff --name-only "$(git merge-base origin/main HEAD)" HEAD`를 실행하면
- **Then** `src/`, `index.html`, `src-tauri/src/`, `src-tauri/capabilities/`, `src-tauri/tauri.conf.json`, `src-tauri/build.rs`로 시작하는 경로가 없다. 판정: `git diff --name-only "$(git merge-base origin/main HEAD)" HEAD | grep -E '^(src/|index\.html$|src-tauri/src/|src-tauri/capabilities/|src-tauri/tauri\.conf\.json$|src-tauri/build\.rs$)'` → PASS = 출력 없음, 종료 코드 1.

### AC-PREVIEW022-007 — 회귀 스위트 (REQ-005·008)

- **When** `npm run typecheck`, `npm run lint`, `npx vitest run`, `~/.cargo/bin/cargo build --manifest-path src-tauri/Cargo.toml`, `~/.cargo/bin/cargo test --manifest-path src-tauri/Cargo.toml`을 실행하면
- **Then** 다섯 명령 모두 종료 코드 0이고, 기존 테스트 수가 줄지 않는다(기준선 수는 M1 시작 때 같은 명령으로 기록). `cargo test`에는 SPEC-SEC-001의 `app_acl` 테스트가 포함된다.
- 참고: 이 worktree 안에 중첩 worktree 사본이 남아 있으면 `npx vitest run`이 그 사본까지 돌 수 있다(SPEC-PREVIEW-020 progress 기록). 그 경우 제외 경로를 명시한 명령과 결과를 함께 기록한다.

## 실기기 수동 검증

수동 항목은 우리가 자동화로 관찰한 값이 아니다. 결과를 progress.md에 남긴다(§ 검증 경로의 기록 항목). macOS는 기본이 선명 모드이므로 토글로 원본 보기를 고른다.

### AC-PREVIEW022-008 — M-1 수정 전 재현 (REQ-011)

- **Given** 수정 전 빌드. macOS는 `<base>`의 로컬 빌드, Windows는 이미 설치된 v0.20.0 릴리스 빌드(tauri 2.10.3. v0.20.0의 Windows 기본은 선명 모드이므로 토글로 원본 보기를 고른다)
- **When** `utf8-no-meta.html`과 `euckr-meta.html`을 원본 보기로 열면
- **Then** OS마다 `characterSet`(판정), `content-type`(보조), 한글 표시 상태(깨짐/정상)를 기록한다.
- **판정(OS별)**:
  1. 어느 OS든 `content-type`에 charset이 이미 있으면 → 멈추고 다시 계획한다(차단 보고).
  2. 한 OS 이상에서 `utf8-no-meta.html`의 한글이 깨지고 `characterSet`이 UTF-8이 아니면 → PASS(재현). 깨지지 않은 OS는 그 사실만 기록한다.
  3. 두 OS 모두 깨지지 않으면 → 멈춘다(원인 가설이 틀림).
- **진행 규칙**: 재현이 한 OS에서도 기록되기 전에는 GREEN 커밋을 만들지 않는다. 그동안 macOS에서 테스트만 쓰는 M1 RED는 진행할 수 있다.

### AC-PREVIEW022-009 — M-2 수정 확인 (REQ-001·002·003·012)

- **Given** 수정 후 빌드. 병합 전 macOS(브랜치 HEAD), 병합 뒤 Windows(§ 검증 경로)
- **When** 위 표의 HTML fixture를 모두 원본 보기로 열면
- **Then** 각 OS에서:
  - `utf8-no-meta.html`, `utf8-tail-after-8k.html`, `utf8-bom.html`: `characterSet: UTF-8`(판정)이고 한글이 정상이다(8 KB 뒤 한글 포함). 보조로 `content-type: text/html; charset=utf-8`이다.
  - `euckr-meta.html`: `characterSet: EUC-KR`, 한글 정상. 보조로 `content-type: text/html`.
  - `euckr-tail-after-8k.html`, `euckr-no-meta.html`, `utf16le-bom.html`: 보조 `content-type: text/html`. `characterSet`과 표시는 M-1과 같다(`euckr-no-meta.html`은 수정 전처럼 해석되며 범위 밖, `utf16le-bom.html`은 BOM으로 정상).
- **And** 같은 fixture를 선명 모드로 열면 수정 전과 같게 보인다(선명 모드 무영향).
- **And** `characterSet`과 보조 `content-type`이 어긋나면(예: `content-type`에는 charset이 있는데 `characterSet`이 UTF-8이 아님) FAIL로 기록하고 멈춘다. 문서 요청에 Range가 붙는 경우일 수 있다(research.md G-2).

### AC-PREVIEW022-010 — M-3 회귀 (REQ-004·005)

- **Given** 수정 후 빌드. 병합 전 macOS, 병합 뒤 Windows
- **Then** 각 OS에서:
  - `subres/page.html`의 이미지가 보이고 CSS가 적용되며 CSS의 `content: "한글"`이 정상으로 보인다.
  - 이미지 뷰어로 PNG·JPG·SVG 파일이 보인다.
  - 마크다운 미리보기에서 상대 경로 이미지가 보인다.
  - `<video controls src="sample.mp4">`를 담은 UTF-8 HTML에서 재생과 탐색(seek)이 된다(WebKit은 미디어를 Range로 요청한다).

### AC-PREVIEW022-011 — M-4 보안 탐침 (REQ-007)

- **Given** 수정 후 빌드와 SPEC-SEC-001 M-2·M-2b 방식의 탐침 HTML(`.moai/state/verify/preview-022-probe/`에 두고 커밋하지 않는다)
- **When** 탐침을 원본 보기로 열고, 링크 클릭과 `<meta http-equiv="refresh">`로 다른 asset 경로 탐침 문서로 이동한 뒤에도 같은 호출을 하면
- **Then** `read_file`, `ai_policy_status`, `plugin:app|version` 호출이 모두 거부(err)되거나 `__TAURI_INTERNALS__`가 없다.
- 탐침에는 파괴적 명령(`write_file`, `delete_file`, `plugin:opener|open_path`)을 넣지 않는다.
- **macOS(병합 전)**: 하나라도 ok이면 FAIL이며 병합하지 않는다.
- **Windows(병합 뒤 릴리스 빌드, 또는 사용자가 고른 더 이른 Windows 빌드)**: 하나라도 ok이면 다음 순서로 대응한다. (1) 진행을 멈춘다. (2) 그 빌드의 초안 릴리스를 게시하지 않는다. (3) 패치를 되돌리는 PR을 올리거나, 원인을 고치는 SPEC 개정을 연다. 어느 쪽인지는 사용자가 고른다. (4) 다음 릴리스는 그 처리가 병합된 뒤에만 게시한다. 병합 전의 더 이른 Windows 빌드에서 ok가 나오면 병합하지 않는다.

## Definition of Done

- **병합 조건**: AC-001~007이 PASS이고 증거(명령, 출력)가 progress.md §E.2에 있다. AC-008이 한 OS 이상에서 재현으로 기록되어 있다. AC-009·010·011이 macOS에서 PASS이고 빌드 SHA가 기록되어 있다.
- **`implemented`**: 병합 조건을 채운 뒤 sync에서 이 상태로 닫는다. Windows 판정 전에는 `completed`로 닫지 않는다.
- **`completed`**: AC-009·010·011이 Windows 빌드(빌드 SHA 기록)에서 PASS로 기록되면, 상태를 `completed`로 바꾸는 PR을 따로 올린다.
- **Windows 탐침 실패**: AC-011의 Windows 대응을 따르며, SPEC은 `completed`로 닫지 않는다.
