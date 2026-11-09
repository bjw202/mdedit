// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

// @MX:NOTE: [AUTO] SPEC-PREVIEW-022 패치 — HTML 응답의 charset 판정 (순수 함수)
// @MX:SPEC: SPEC-PREVIEW-022

/// asset 응답의 `Content-Type`을 정한다.
///
/// MIME 본질이 `text/html`이고 파일 **전체** 바이트가 올바른 UTF-8일 때만
/// `text/html; charset=utf-8`을 돌려준다. 그 밖에는 `mime`을 그대로 돌려준다.
///
/// - `full_body`가 `None`이면(Range·HEAD 등 전체를 읽지 않은 경우) 판정하지 않는다.
/// - UTF-8이 아닌 파일에 charset을 선언하면 `<meta charset>`보다 우선해
///   EUC-KR 등 기존에 바르게 보이던 파일이 깨지므로 선언하지 않는다.
/// - UTF-8 BOM은 올바른 UTF-8로 본다(BOM이 헤더보다 우선하므로 결과가 같다).
///   빈 파일도 올바른 UTF-8이다.
pub fn html_content_type(mime: &str, full_body: Option<&[u8]>) -> String {
    let essence = mime.split(';').next().unwrap_or("").trim();
    match full_body {
        Some(body)
            if essence.eq_ignore_ascii_case("text/html") && std::str::from_utf8(body).is_ok() =>
        {
            "text/html; charset=utf-8".to_string()
        }
        _ => mime.to_string(),
    }
}
