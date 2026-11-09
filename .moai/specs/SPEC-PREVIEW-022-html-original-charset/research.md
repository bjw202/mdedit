# SPEC-PREVIEW-022 조사 기록

이 문서는 원인 근거, 대안 평가, 상류 재동기화 규칙을 담는다. 모든 근거는 소스 판독이다. 실기기에서 관찰한 값은 없다.

- 레지스트리 루트: `~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/` (아래에서는 생략)
- 버전(`src-tauri/Cargo.lock` 기준): tauri 2.10.3, tauri-utils 2.8.3, wry 0.54.3, infer 0.19.0, http-range 0.1.5
- `src-tauri/Cargo.toml`: `tauri = { version = "2", features = ["protocol-asset", "image-png"] }`
- `src-tauri/tauri.conf.json`: `security.csp: null`, `assetProtocol { enable: true, scope: [] }`. 범위는 런타임에 `register_asset_scope`(`src-tauri/src/commands/directory_ops.rs:136-144`, `app.asset_protocol_scope().allow_directory`)가 연다.
- 판독자 표시: [O] 코디네이터가 이 세션에서 읽고 브리프에 적은 것, [S] 이 SPEC 작성 중 다시 열어 확인한 것.

## §1 원인 근거

1. **[O][S] 내장 asset 핸들러는 charset을 붙이지 않는다** — `tauri-2.10.3/src/protocol/asset.rs:83-100`. 앞 `min(len, 8192)`바이트를 읽어 `MimeType::parse(&magic_buf, &path)`(90행)로 MIME을 정하고, `resp.header(CONTENT_TYPE, &mime_type)`(100행)로 그대로 쓴다. 다중 범위 응답도 184-187행(`multipart/byteranges`)과 198-199행(각 부분의 `Content-Type: {mime_type}`)에서 같은 `mime_type`을 쓴다. 비Range GET은 225-240행에서 파일 전체를 읽는다(8,192바이트 미만이면 93행의 `magic_buf`를 재사용).
2. **[O][S] HTML MIME은 늘 매개변수 없는 `text/html`이다** — `tauri-utils-2.8.3/src/mime_type.rs:33` `MimeType::Html => "text/html"`, 61행 `Some("html") => Self::Html`, 72행 알 수 없는 확장자(예: `htm`)는 `fallback`(=Html), 80-99행 `parse_with_fallback`은 `infer::get(content)`를 먼저 쓰고(`infer-0.19.0/src/map.rs:606-608`은 HTML 내용을 `"text/html"`로 매핑 [O]) 실패하면 URI 확장자를 쓴다. 어느 경로든 결과는 `text/html`이다.
3. **[O][S] wry는 헤더를 그대로 넘긴다** — macOS `wry-0.54.3/src/wkwebview/class/url_scheme_handler.rs:219-254`는 응답의 `Content-Type`과 모든 헤더를 `NSHTTPURLResponse` 헤더 사전에 복사한다. Windows `wry-0.54.3/src/webview2/mod.rs:1108-1132`는 헤더를 `이름: 값` 줄로 이어 `CreateWebResourceResponse`에 넘긴다. 둘 다 charset을 더하지 않는다.
4. **결론(소스 판독, 런타임 미관찰)**: 원본 보기 iframe 문서는 `Content-Type: text/html`(charset 없음)으로 도착한다. HTML 인코딩 판별 순서(BOM → 전송 계층 charset → `<meta>` 사전 탐색 → 구현 기본값·휴리스틱)상 BOM과 `<meta>`가 없는 UTF-8 파일은 WebView 기본값(로캘에 따른 레거시 인코딩, 예: windows-1252·EUC-KR)으로 해석되어 한글이 깨진다. 카드 t3 증상과 맞는다.
   - **갭**: 실제 응답 헤더를 기기에서 캡처하지 않았다. run 첫 작업(M0, REQ-011)이 캡처하고 깨짐을 재현한다. 관찰한 헤더가 다르면 멈추고 다시 계획한다.

## §2 이 수정이 지켜야 하는 소비자

- `src/components/preview/HtmlFileViewer.tsx` — 원본 보기 iframe(`convertFileSrc`, `sandbox="allow-scripts allow-same-origin"`).
- `src/components/preview/ImageFileViewer.tsx` — 이미지 뷰어(asset 주소).
- `src/lib/image/imageResolver.ts` — 마크다운 미리보기 이미지.
- 원본 보기 HTML의 하위 리소스: 상대 경로 이미지·CSS·JS, WebKit이 Range로 요청하는 미디어(`<video>`, `<audio>`).

## §3 핵심 발견 — 앱이 스킴을 등록하면 asset 출처가 로컬이 된다

브리프의 안 A는 "앱이 `tauri::Builder::register_asynchronous_uri_scheme_protocol("asset", …)`로 같은 스킴을 등록하면 내장 핸들러가 빠지고 출처는 같으니 SEC-001 판정도 그대로"라는 전제에 섰다. 앞부분(대체)은 소스가 뒷받침하지만 뒷부분(SEC-001 유지)은 소스와 맞지 않는다.

1. **[O][S] 대체는 일어난다** — `tauri-2.10.3/src/manager/webview.rs:222-236`이 앱이 등록한 스킴을 `registered_scheme_protocols`에 모으고, 307-318행은 `asset`이 그 목록에 **없을 때만** 내장 핸들러를 등록한다(308행).
2. **[S] 앱이 등록한 스킴은 `uri_scheme_protocols` 맵에 들어간다** — `app.rs:2049-2066` `register_asynchronous_uri_scheme_protocol`(그리고 1981-2001행 동기판)이 `self.uri_scheme_protocols`에 넣고, 2107행이 그 맵을 매니저에 넘긴다(`manager/mod.rs:254, 287`). 플러그인이 등록한 스킴도 같은 맵으로 간다(`plugin.rs:810-814` → `manager/webview.rs:98-109`). 내장 asset 핸들러는 이 맵을 거치지 않고 `pending.register_uri_scheme_protocol`(315행)로 직접 등록된다.
3. **[S] 그 맵에 있는 스킴은 로컬 출처다** — `webview/mod.rs:1680-1720` `is_local_url`은 "사용자가 등록한 사용자 정의 프로토콜이면 로컬"로 판정한다(1697-1717행). macOS·Linux는 `protocols.contains_key(scheme)`(1703행) → `asset://localhost`가 로컬. Windows·Android는 도메인 첫 마디(`asset.localhost` → `asset`)가 맵에 있고 스킴이 앱 프로토콜 스킴(`http`)과 같으면 로컬(1707-1716행) → `http://asset.localhost`가 로컬.
4. **[S] IPC 요청의 URL은 보낸 프레임의 것이다** — 사용자 정의 프로토콜 IPC 경로는 `Origin` 요청 헤더를 URL로 쓴다(`ipc/protocol.rs:491-499`). postMessage 경로는 wry가 넘긴 요청 URI를 쓰는데(`ipc/protocol.rs:302`), Windows wry는 그 값을 `args.Source()`(보낸 문서의 URI)로 채운다(`wry-0.54.3/src/webview2/mod.rs:899-912`).
5. **[S] 로컬이면 `main` capability가 적용된다** — `webview/mod.rs:1768-1784`에서 `is_local`이면 `Origin::Local`로 ACL을 푼다. `src-tauri/capabilities/main.json`은 `windows: ["main"]`이고 앱 명령 26개, `core:default`, `opener:default`, `opener:allow-open-path`(`**`), `opener:allow-reveal-item-in-dir`(`**`)를 허용한다. iframe은 `main` 창의 웹뷰 안에 있다.
6. **SEC-001 본문의 같은 진술** — SPEC-SEC-001 Overview: "로컬 출처로 분류되는 프레임(예: 사용자 정의 스킴을 `Builder`에 등록한 경우)의 호출은 `main` capability가 그대로 적용되므로 막지 못한다." 이 SPEC 작성 전에 이미 같은 판독이 있었다.
7. **결론(소스 판독, 런타임 미관찰)**: 안 A를 쓰면 asset 출처 iframe의 스크립트가 앱 명령 26개(`read_file`, `write_file`, `delete_file` 포함)와 `plugin:opener|open_path`(범위 `**`)를 호출할 수 있게 된다고 본다. Windows는 wry가 하위 프레임에도 IPC 초기화 스크립트를 주입한다는 것이 SEC-001의 전제였다(SEC-001이 advisor 인용으로 기록, 이 SPEC은 재열람하지 않음). 원본 보기의 HTML은 사용자가 연 임의 파일이다.
8. **중앙 가드로 막을 수 있는가 — 불충분** — `Builder::invoke_handler`를 감싸 `invoke.message.headers()`의 `Origin`을 검사하는 방법을 검토했다(`app.rs:1526-1532`, `ipc/mod.rs:579` `headers()` 공개).
   - 플러그인 명령은 앱 `invoke_handler`를 거치지 않으므로 `opener:allow-open-path` 같은 호출을 막지 못한다.
   - postMessage 경로의 헤더는 JS가 넘긴 `options.headers`(`ipc/protocol.rs:304`)라 페이지가 `Origin`을 위조할 수 있다.
   - `InvokeMessage`에는 요청 URL 접근자가 없다(`ipc/mod.rs:498-583`, `webview()`는 메인 프레임 기준).
   - 그래서 가드로는 안 A의 회귀를 닫을 수 없다고 판단한다.

## §4 대안 평가와 결정

| 안 | 내용 | 판단 |
|----|------|------|
| **X (권장)** | tauri 2.10.3 크레이트 전체를 `src-tauri/vendor/tauri/`에 복사하고 `[patch.crates-io] tauri = { path = "vendor/tauri" }`로 바꿔 끼운다. 바꾸는 곳은 `src/protocol/asset.rs`의 비Range GET 헤더 결정 한 곳과 새 순수 함수 파일 하나다. | **권장.** 앱이 스킴을 등록하지 않으므로 `is_local_url` 판정이 그대로이고 asset 출처는 계속 원격이다(SEC-001이 구조적으로 유지됨). 출처·주소·프런트엔드가 그대로이며 HTML이 아닌 경로는 같은 코드라 바이트 단위로 같다. 비용: 저장소에 1.6 MB·143개 파일이 늘고, tauri를 올릴 때마다 다시 복사하고 패치해야 한다(§6, REQ-010 가드). 라이선스는 MIT/Apache-2.0이며 크레이트의 `LICENSE_MIT`·`LICENSE_APACHE-2.0`을 함께 복사한다. |
| X2 (변형) | 같은 패치를 사용자 GitHub 포크에 커밋하고 `[patch.crates-io] tauri = { git = "…", rev = "…" }`로 쓴다. | 저장소가 가벼워지는 대신 외부 포크와 네트워크에 의존한다. 릴리스 빌드(CI)가 포크를 받을 수 있어야 한다. X와 같은 보안 성질. 사용자 선택 사항. |
| A (브리프 권장, 기각) | 앱이 `Builder`에 `asset` 스킴을 등록하고 asset.rs를 복사해 charset 한 줄만 바꾼다. | **기각.** §3대로 asset 출처가 로컬이 되어 SEC-001이 막은 호출이 다시 열린다고 본다. 가드로 닫을 수 없다(§3-8). |
| B (기각) | HTML 전용 새 스킴(예: `mdedit-html://`). | **기각.** 앱이 등록한 스킴이라 A와 같은 로컬 판정 문제가 있다. 출처가 새로 생겨 상대 경로 하위 리소스도 모두 그 스킴이 처리해야 한다. |
| C (기각) | 프런트엔드가 파일을 읽어 `text/html;charset=utf-8` Blob URL로 띄운다. | **기각.** Blob은 앱 출처를 물려받으며 `allow-same-origin`과 함께면 앱 IPC에 닿는다(SEC-001 위반). 상대 경로 하위 리소스도 깨진다. |
| D (기각) | 로드 전에 JS로 `<meta charset>`을 넣거나 HTML을 고쳐 쓴다. | **기각.** 그것은 선명 모드의 일이다. 원본 보기는 파일을 있는 그대로 보여야 한다. |
| E (기각) | 디스크의 파일에 BOM을 붙이거나 인코딩을 바꾼다. | **기각.** 사용자 파일을 바꾼다. |
| F (기각) | 아무것도 하지 않고 "`<meta charset>`을 넣으라"고 안내한다. | **기각.** Windows 기본 경로(020)에서 한국어 사용자가 바로 겪는다. |

- 검토하지 않은 것: WebView 수준의 기본 인코딩 설정(WebView2 브라우저 인자, WKWebView 설정). 공개 API나 근거를 확인하지 못해 후보에 넣지 않았다.

## §5 권장안 X의 동작 설계 근거

- **판정 함수**: `html_content_type(mime: &str, full_body: Option<&[u8]>) -> String`(이름은 plan 제안). `mime`의 본질(매개변수 앞부분, 대소문자 무시)이 `text/html`이고 `full_body`가 `Some`이며 `std::str::from_utf8`이 성공하면 `"text/html; charset=utf-8"`, 그 밖에는 `mime`을 그대로 돌려준다.
- **추가 읽기 없음**: 비Range GET은 이미 파일 전체를 읽는다(§1-1, 225-240행). 판정은 그 버퍼를 쓰므로 IO가 늘지 않는다. 대신 헤더 결정을 본문을 읽은 뒤로 옮겨야 한다(지금은 100행에서 먼저 쓴다). Range·HEAD 분기는 손대지 않는다(REQ-004).
- **비용**: `from_utf8`은 선형 시간이다. 이미 메모리에 올린 전체 파일을 한 번 더 훑는 정도다.
- **원본 보기의 의미 유지**: 본문 바이트는 바꾸지 않는다. 바뀌는 것은 HTML 응답의 `Content-Type` 문자열뿐이다.

## §6 상류 재동기화 규칙 (tauri를 올릴 때)

1. 새 버전의 레지스트리 소스(`~/.cargo/registry/src/…/tauri-<new>/`)를 `src-tauri/vendor/tauri/`에 통째로 다시 복사한다.
2. 이전 패치를 다시 적용한다. 대상은 `src/protocol/asset.rs`의 헤더 결정 부분과 `src/protocol/asset/charset.rs`(새 파일)다.
3. 새 버전의 `asset.rs`가 바뀌었으면, 바뀐 부분을 읽고 REQ-004~006이 여전히 성립하는지 확인한다. 상류가 charset을 스스로 붙이기 시작했다면 패치를 걷어내고 `[patch.crates-io]`를 지우는 것을 먼저 검토한다.
4. `src-tauri/tests/asset_charset.rs`의 기준 버전 상수를 새 버전으로 고친다(REQ-010 가드가 그 전까지 실패한다).
5. `diff -ru ~/.cargo/registry/src/…/tauri-<new> src-tauri/vendor/tauri`의 결과가 허용 목록(AC-004)과 같은지 확인한다.
6. 실기기 확인(AC-009·AC-011)을 다시 한다.

## §7 남은 갭과 위험

| ID | 내용 | 대응 |
|----|------|------|
| G-1 | 원인과 §3 결론 모두 소스 판독이다. | M0이 원인을, AC-011이 거부 성질을 실기기에서 확인한다. 안 A는 기각이 확정됐다(plan.md §D-2). |
| G-2 | WebView가 HTML 문서를 Range로 요청하면 수정 효과가 없다. | M0·M2의 헤더 기록으로 드러난다. 그 경우 멈추고 다시 계획한다. |
| R-1 | 들여온 tauri 사본이 상류와 어긋난다(보안 수정 누락 포함). | REQ-010 가드가 버전 변경 때 실패시킨다. §6 절차. |
| R-2 | `[patch.crates-io]`가 적용되지 않아 레지스트리 tauri가 빌드되면 수정이 조용히 빠진다. | REQ-010 가드가 `Cargo.lock`의 `tauri` 출처가 레지스트리이면 실패한다. AC-009가 런타임으로 확인한다. |
| R-3 | 포매터·린터가 EUC-KR·UTF-16 fixture 바이트를 바꿀 수 있다(이 저장소에는 `.md` 포매터가 frontmatter를 깬 사례가 있다). | plan.md M1에서 커밋 뒤 `xxd`로 바이트를 확인하고, 필요하면 무시 목록에 넣는다. |
| R-4 | 들여온 사본이 저장소 도구(rustfmt, clippy, 검색)에 섞인다. | `cargo fmt`·`clippy`는 루트 패키지만 대상이다(가정, M2에서 확인). |
