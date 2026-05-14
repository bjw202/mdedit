# SPEC-PREVIEW-004 (compact)

> 자동 생성 요약. 정본은 `spec.md`. 연구 산출물: `docs/design/html-preview.md`.

- **id**: SPEC-PREVIEW-004 | **status**: draft | **priority**: P2 | **author**: jw | **issue**: 0
- **deps**: SPEC-FS-001, SPEC-PREVIEW-001, SPEC-UI-001
- **목표**: 독립 `.html` 파일을 웹브라우저처럼 보여주는 보기 전용 기능. 스크립트 실행·외부 자산 로드 허용, 샌드박스 iframe 격리, asset 프로토콜을 작업 폴더로 제한.

## EARS 요구 모듈 (5)

- **REQ-PREVIEW004-001** (Event-driven): `.html` 선택 시 HTML 보기 모드 진입, 편집기는 보기 전용 플레이스홀더, `.md` 복귀 시 마크다운 모드 복원.
- **REQ-PREVIEW004-002** (Ubiquitous + State-driven): 모든 HTML은 `sandbox` iframe 안에서만 렌더, 최소 권한만 부여, 스타일 누출 차단.
- **REQ-PREVIEW004-003** (Ubiquitous + Optional): `tauri.conf.json`에 `assetProtocol` 추가(`enable: true`), `scope`를 작업 폴더로 제한, 하위 폴더 HTML의 상위 자산 참조 허용.
- **REQ-PREVIEW004-004** (Event-driven): `filterMdOnly`를 확장해 `.html`도 사이드바에 표시, 디렉터리는 항상 표시.
- **REQ-PREVIEW004-005** (Unwanted): 앱 권한 접근·경로 탈출·범위 밖 읽기 차단, 5MB 초과 시 "미리보기 불가", 로드 오류 시 앱 미중단.

## [DELTA] 변경 맵

- [MODIFY] `tauri.conf.json` (assetProtocol 블록 추가), `FileExplorer.tsx` (filterMdOnly 확장), `useFileSystem.ts` (openFile 확장자 분기), `MarkdownEditor.tsx`/editor 패널 (HTML 플레이스홀더), `AppLayout.tsx` (프리뷰 슬롯 교체)
- [NEW] `preview/HtmlFileViewer.tsx` (샌드박스 iframe 뷰어), `preview/PreviewContainer.tsx` (파일 종류 분기)
- [EXISTING] `MarkdownPreview.tsx`/`PreviewRenderer.tsx` 변경 없음, SPEC-FS-001 경로 검증 의존성으로만 사용

## Exclusions

HTML 편집 / 네트워크 요청 차단(잔존 위험 수용) / 마크다운 안의 HTML 처리 / HTML 검색·스크롤 싱크 / 앱 본체 CSP 약화 / 다중 작업 폴더.

## 진행 순서 (plan.md)

asset 프로토콜 설정·검증 → 샌드박스 iframe + 보안 테스트 통과 → 파일 종류 분기·연결 → 파일 열기·편집기 플레이스홀더 → 사이드바 필터 → scope 강화 → 전체 검증 + product.md/README 갱신.

## must-pass 수용 기준

보안 시나리오 3(앱 권한 탈취 차단)·4(경로 탈출 차단)·5(범위 밖 읽기 차단), 회귀 시나리오 7(기존 마크다운·수식·다이어그램 정상).
