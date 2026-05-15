# HTML 미리보기 샘플

`HtmlFileViewer` (SPEC-PREVIEW-004) 검증용 HTML 샘플 모음.

## 파일

| 파일 | 목적 |
|---|---|
| `01-basic.html` | 기본 텍스트 + 인라인 CSS 렌더링 |
| `02-rich-content.html` | 표 · 코드 블록 · 그리드 레이아웃 |
| `03-interactive.html` | 자체 스크립트 동작 + 샌드박스 격리 검증 |

## 사용

1. 앱 실행 (`npm run dev`)
2. 폴더 열기 → 이 `samples/html/` 폴더 선택
3. 좌측 트리에서 각 HTML 파일 클릭
4. 우측 미리보기 패널에 iframe으로 렌더링되는지 확인

## 회귀 체크리스트

| 항목 | 확인 방법 |
|---|---|
| Windows asset URL 차단 | 모든 샘플이 빈 화면 없이 정상 표시되어야 함 |
| CSP `frame-src` | DevTools Console에 CSP 위반 메시지가 없어야 함 |
| 샌드박스 격리 | `03-interactive.html`의 "부모 접근 시도" 결과가 모두 "차단됨 ✓" |
| 자체 완결형 HTML | 외부 리소스 의존 없이 단일 파일로 표시됨 |
