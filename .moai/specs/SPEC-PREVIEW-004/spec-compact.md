# SPEC-PREVIEW-004 (compact)

> 자동 생성 요약. 정본은 `spec.md` (v1.1.0). 연구 산출물: `docs/design/html-preview.md`.

- **id**: SPEC-PREVIEW-004 | **version**: 1.1.0 | **status**: draft | **priority**: P2 | **author**: jw | **issue**: 0
- **deps**: SPEC-FS-001, SPEC-PREVIEW-001, SPEC-UI-001
- **목표**: 독립 `.html` 파일을 웹브라우저처럼 보여주는 보기 전용 기능. 스크립트 실행·외부 자산 로드 허용, 샌드박스 iframe 격리, asset 프로토콜은 런타임 scope 등록으로 열린 폴더만 허용.

## EARS 요구 모듈 (5)

- **REQ-PREVIEW004-001** (Event-driven): `.html` 선택 시 HTML 보기 모드 진입, 편집기는 보기 전용 플레이스홀더, `.md` 복귀 시 마크다운 모드 복원.
- **REQ-PREVIEW004-002** (Ubiquitous + State-driven): 모든 HTML은 `sandbox` iframe 안에서만 렌더, 최소 권한만 부여, 스타일 누출 차단.
- **REQ-PREVIEW004-003** (Ubiquitous + Event-driven + Optional): `tauri.conf.json`에 `assetProtocol: { enable: true, scope: [] }`(빈 정적 scope = 보안 기본값). 폴더 열기·전환 시 Rust 백엔드가 `allow_directory(<정규화 경로>, true)`로 런타임 등록. 세션 누적 + 재시작 시 초기화. `forbid_*` 미사용(영구적이라 재오픈 차단). 경로 정규화는 SPEC-FS-001과 일관.
- **REQ-PREVIEW004-004** (Event-driven): `filterMdOnly`를 확장해 `.html`도 사이드바에 표시, 디렉터리는 항상 표시.
- **REQ-PREVIEW004-005** (Unwanted): 앱 권한 접근 차단, `폴더/**` glob 미매칭 경로(`../../` 탈출·미등록 절대 경로 `/etc/passwd`) 차단, 5MB 초과 시 "미리보기 불가", 로드 오류 시 앱 미중단.

## [DELTA] 변경 맵

- [MODIFY] `tauri.conf.json` (`assetProtocol: { enable: true, scope: [] }` 정확히), Rust 폴더/디렉터리 열기 커맨드 (SPEC-FS-001 디렉터리 다이얼로그·폴더 로딩 커맨드 — `allow_directory` 등록 추가), `FileExplorer.tsx` (filterMdOnly 확장), `useFileSystem.ts` (openFile 확장자 분기), `MarkdownEditor.tsx`/editor 패널 (HTML 플레이스홀더), `AppLayout.tsx` (프리뷰 슬롯 교체)
- [NEW] `preview/HtmlFileViewer.tsx` (샌드박스 iframe 뷰어), `preview/PreviewContainer.tsx` (파일 종류 분기)
- [EXISTING] `MarkdownPreview.tsx`/`PreviewRenderer.tsx` 변경 없음, SPEC-FS-001 경로 검증 로직 변경 없음(폴더 열기 커맨드만 위 [MODIFY])

## Exclusions

HTML 편집 / 네트워크 요청 차단(잔존 위험 수용) / 마크다운 안의 HTML 처리 / HTML 검색·스크롤 싱크 / 앱 본체 CSP 약화 / 다중 작업 폴더·임의 경로 열람.

## 진행 순서 (plan.md)

asset 프로토콜 설정(빈 정적 scope) + Rust 폴더 열기 커맨드에 `allow_directory` 등록 + 통로 작동·빈 scope 검증 → 샌드박스 iframe + 보안 테스트 통과 → 파일 종류 분기·연결 → 파일 열기·편집기 플레이스홀더 → 사이드바 필터 → 런타임 scope 등록 강화·세션 누적 검증 → 전체 검증 + product.md/README 갱신.

## must-pass 수용 기준

보안 시나리오 3(앱 권한 탈취 차단)·4(`A/**` 미매칭 경로 탈출 차단 + 심링크 우회 차단)·5(미등록 절대 경로 차단)·5-A(폴더 미오픈 시 빈 scope), 회귀 시나리오 7(기존 마크다운·수식·다이어그램 정상).

## 미해결 사항 (run/sync 단계)

#2 5MB 임계값 확정 여부, #3 "HTML 미지원" 문서 문구 위치 확인. (#1 asset scope 동적 갱신은 런타임 등록 방식으로 해결됨.)
