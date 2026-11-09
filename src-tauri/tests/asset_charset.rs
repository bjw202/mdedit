// SPEC-PREVIEW-022: asset 응답의 HTML charset 판정 + 상류(tauri) 추적 가드.
//
// 판정 함수는 vendor 사본의 charset.rs를 그대로 불러와 검증한다.
// tauri 크레이트를 개발 의존성으로 두지 않고 앱의 `cargo test`로 돈다.

#[path = "../vendor/tauri/src/protocol/asset/charset.rs"]
mod charset;

use charset::html_content_type;

const UTF8_NO_META: &[u8] = include_bytes!("fixtures/charset/utf8-no-meta.html");
const UTF8_TAIL: &[u8] = include_bytes!("fixtures/charset/utf8-tail-after-8k.html");
const UTF8_BOM: &[u8] = include_bytes!("fixtures/charset/utf8-bom.html");
const EUCKR_TAIL: &[u8] = include_bytes!("fixtures/charset/euckr-tail-after-8k.html");
const EUCKR_META: &[u8] = include_bytes!("fixtures/charset/euckr-meta.html");
const EUCKR_NO_META: &[u8] = include_bytes!("fixtures/charset/euckr-no-meta.html");
const UTF16LE_BOM: &[u8] = include_bytes!("fixtures/charset/utf16le-bom.html");

const UTF8_HTML: &str = "text/html; charset=utf-8";

/// fixture 바이트 구성 확인: 포매터 등으로 바뀌면 판정 표보다 먼저 실패한다.
#[test]
fn fixture_byte_layout_is_intact() {
    for (name, body) in [("utf8-tail", UTF8_TAIL), ("euckr-tail", EUCKR_TAIL)] {
        assert!(body.len() > 8192, "{name}: 길이가 8,192바이트 이하");
        assert!(
            body[..8192].iter().all(|b| b.is_ascii()),
            "{name}: 앞 8,192바이트에 비ASCII가 섞임"
        );
    }
    assert!(std::str::from_utf8(UTF8_TAIL).is_ok());
    for (name, body) in [
        ("euckr-tail", EUCKR_TAIL),
        ("euckr-meta", EUCKR_META),
        ("euckr-no-meta", EUCKR_NO_META),
    ] {
        assert!(std::str::from_utf8(body).is_err(), "{name}: UTF-8로 읽히면 안 됨");
    }
    assert!(UTF8_BOM.starts_with(&[0xEF, 0xBB, 0xBF]));
    assert!(UTF16LE_BOM.starts_with(&[0xFF, 0xFE]));
}

#[test]
fn utf8_html_gets_charset() {
    for (name, body) in [
        ("utf8-no-meta", UTF8_NO_META),
        ("utf8-tail-after-8k", UTF8_TAIL),
        ("utf8-bom", UTF8_BOM),
        ("empty", &b""[..]),
    ] {
        assert_eq!(html_content_type("text/html", Some(body)), UTF8_HTML, "{name}");
    }
}

#[test]
fn mime_essence_match_is_case_insensitive() {
    assert_eq!(html_content_type("TEXT/HTML", Some(UTF8_NO_META)), UTF8_HTML);
}

#[test]
fn non_utf8_html_is_left_alone() {
    for (name, body) in [
        ("euckr-tail-after-8k", EUCKR_TAIL),
        ("euckr-meta", EUCKR_META),
        ("euckr-no-meta", EUCKR_NO_META),
        ("utf16le-bom", UTF16LE_BOM),
    ] {
        assert_eq!(html_content_type("text/html", Some(body)), "text/html", "{name}");
    }
}

/// 앞 8,192바이트만으로 판정하면 틀린다는 사실을 고정한다.
/// (호출 쪽이 파일 전체를 넘겨야 하는 근거)
#[test]
fn prefix_only_judgement_would_be_wrong() {
    assert_eq!(html_content_type("text/html", Some(&EUCKR_TAIL[..8192])), UTF8_HTML);
    assert_eq!(html_content_type("text/html", Some(EUCKR_TAIL)), "text/html");
}

#[test]
fn without_full_body_mime_is_unchanged() {
    assert_eq!(html_content_type("text/html", None), "text/html");
}

#[test]
fn non_html_mime_is_returned_as_is() {
    for mime in [
        "text/css",
        "text/javascript",
        "image/svg+xml",
        "image/png",
        "video/mp4",
        "text/plain",
    ] {
        assert_eq!(html_content_type(mime, Some(UTF8_NO_META)), mime);
    }
}

/// REQ-PREVIEW022-010: tauri 버전이 바뀌거나 패치가 빠지면 실패한다.
#[test]
fn vendored_tauri_tracks_patched_baseline() {
    const BASELINE_VERSION: &str = "2.10.3";
    let lock_path = concat!(env!("CARGO_MANIFEST_DIR"), "/Cargo.lock");
    let lock = std::fs::read_to_string(lock_path).expect("Cargo.lock을 읽을 수 없음");

    // [[package]] 블록 단위로 쪼개 name = "tauri" 항목만 고른다.
    let block = lock
        .split("[[package]]")
        .find(|b| b.lines().any(|l| l.trim() == "name = \"tauri\""))
        .expect("Cargo.lock에 tauri 항목이 없음");

    let version_line = format!("version = \"{BASELINE_VERSION}\"");
    assert!(
        block.lines().any(|l| l.trim() == version_line),
        "tauri 버전이 패치 기준 {BASELINE_VERSION}과 다름. 상류를 올렸다면 \
         .moai/specs/SPEC-PREVIEW-022-html-original-charset/research.md §6 절차로 \
         vendor 사본을 다시 맞추고 이 상수를 고칠 것"
    );
    assert!(
        !block.lines().any(|l| l.trim_start().starts_with("source =")),
        "tauri가 레지스트리에서 빌드됨(패치 미적용). src-tauri/Cargo.toml의 \
         [patch.crates-io]를 확인할 것. 절차: \
         .moai/specs/SPEC-PREVIEW-022-html-original-charset/research.md §6"
    );
}
