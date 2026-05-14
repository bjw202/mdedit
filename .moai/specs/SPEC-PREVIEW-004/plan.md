# SPEC-PREVIEW-004 — 구현 계획

> 권위 있는 설계문서: `docs/design/html-preview.md` (특히 4·5·7장). 본 계획은 그 권장 진행 순서(7장)를 따른다.

## 기술 접근

- **격리 전략**: 앱 본체 보안 설정은 그대로 두고, HTML은 `sandbox` 속성이 적용된 iframe 안에만 가둔다. 위험을 "부스 안"으로만 한정한다.
- **자산 전달 (런타임 scope 등록, 세션 누적)**: `tauri.conf.json`의 정적 `assetProtocol.scope`는 빈 배열로 두어 기본 차단 상태로 시작한다. 사용자가 폴더를 열거나 전환할 때마다 Rust 백엔드가 asset 프로토콜 scope 객체의 `allow_directory(<정규화된 폴더 경로>, recursive=true)`를 호출해 그 폴더를 런타임 허용 목록에 등록한다. scope는 이번 세션에 명시적으로 연 폴더만 누적하고 앱 재시작 시 초기화된다. `forbid_*`는 영구적이고 폴더 재오픈을 막으므로 사용하지 않는다. `allow_directory(folder, true)`는 `folder/**` glob을 만들어 `../../` 같은 경로 탈출 참조가 자동으로 매칭에서 탈락하므로, 별도의 수기 경로 검증 코드가 필요 없다. 폴더 경로는 SPEC-FS-001의 기존 경로 탈출 처리와 일관되게 정규화(절대 경로화 + 심링크 해소)해야 한다. iframe `src`는 등록된 폴더 내 HTML 파일의 asset URL을 가리킨다.
- **검증 출처**: 위 메커니즘은 Context7로 Tauri v2 문서 대조 확인 — asset 프로토콜 scope는 런타임 `tauri::scope::fs::Scope` 객체이며 앱 핸들의 asset 프로토콜 scope accessor로 접근 가능, `allow_directory`/`allow_file`/`forbid_*`/`is_allowed`/`is_forbidden`를 노출한다. run 단계에서 고정된 Tauri 버전에 대해 정확한 accessor 이름만 확인하면 된다.
- **명명 정리**: 설계문서가 가정한 `HtmlPreview`/`PreviewPanel` 명칭은 실제 코드베이스에 없다. 기존 `preview/` 디렉터리는 `MarkdownPreview.tsx` + `PreviewRenderer.tsx`로 구성된다. 신규 컴포넌트는 `HtmlFileViewer.tsx`(iframe 뷰어)와 `PreviewContainer.tsx`(파일 종류 분기)로 확정한다. 기존 두 파일은 변경 없이 마크다운 분기에서 재사용한다.
- **상태 모델**: 현재 선택 파일의 종류(markdown / html)를 store에서 파생하여 `PreviewContainer`와 편집기 패널이 함께 참조한다.

## 위험 분석 (설계문서 4장 기반)

| 위험 | 심각도 | 대비책 | 검증 |
|------|--------|--------|------|
| 앱 권한 탈취 (악성 HTML이 파일 삭제·수정 권한 사용) | 매우 높음 | iframe 격리 — 앱 권한에 손이 닿지 않음 | acceptance 시나리오 3 (공격 시뮬레이션) — **반드시 통과** |
| 경로 빠져나가기 (`../../`로 등록된 폴더 밖 접근) | 높음 | 런타임 등록된 `폴더/**` glob에 매칭 실패 → 자동 차단. 폴더 경로 정규화로 심링크 우회도 차단 | acceptance 시나리오 4 (경로 탈출) — **반드시 통과** |
| 다른 파일 훔쳐보기 (범위 밖 비밀 파일 읽기) | 높음 | sandbox + 어떤 등록 패턴에도 매칭 안 되는 절대 경로(예: `/etc/passwd`)는 차단 | acceptance 시나리오 5 (범위 밖 읽기) — **반드시 통과** |
| 정보 빼돌리기 (스크립트가 외부 서버로 전송) | 높음 | 읽을 수 있는 정보를 작업 폴더로 한정. **잔존 위험으로 수용** (Exclusions 참조) | 사용자 안내 — 코드로 완전 차단 불가 |
| 앱 화면 오염 (HTML 디자인이 앱 셸 침범) | 낮음 | iframe 경계가 스타일 차단 | acceptance 시나리오 2 |
| 앱 멈춤 (너무 큰 HTML / 무거운 스크립트) | 중간 | 5MB 초과 시 "미리보기 불가" 안내 | acceptance 시나리오 6 (성능) |
| 기존 기능 회귀 (설정 변경이 마크다운·수식·다이어그램 깨뜨림) | 중간 | asset 설정은 추가만, CSP 미변경 | acceptance 시나리오 7 (회귀) — **반드시 통과** |
| 제품 방향성 충돌 (앱 소개에 "HTML 미지원" 명시됨) | 중간 (제품 판단) | 독립 기능으로 추가 결정 완료 (설계문서 결정 사항 "확인 완료 — 진행"). 구현 후 product.md·README 갱신 | Task 7 |

## 작업 분해 (설계문서 7장 권장 순서)

### Phase 1 — asset 프로토콜 설정 (선행, 검증 필수)

- **Task 1.1** `tauri.conf.json`에 `app.security.assetProtocol` 블록 추가 — 정확히 `{ "enable": true, "scope": [] }`. 정적 scope는 빈 배열(보안 기본값).
- **Task 1.2** Rust 폴더 열기 커맨드(SPEC-FS-001의 네이티브 디렉터리 다이얼로그·폴더 로딩 처리 커맨드)에 `asset_protocol_scope().allow_directory(<정규화된 폴더 경로>, true)` 등록 호출 추가. 폴더 경로는 SPEC-FS-001의 기존 처리와 일관되게 정규화. run 단계에서 고정 Tauri 버전에 대해 accessor 이름 확인.
- **Task 1.3** 파일 전달 통로가 실제로 작동하는지 먼저 확인 — 폴더를 열면 그 폴더 내 자산 파일이 asset URL로 로드되는지, 등록 안 된 범위 밖은 차단되는지, 재시작 후 아무 폴더도 안 열면 빈 scope인지. **이게 안 되면 이후 작업 무의미.**
- 게이트: scope 등록·동작 확인 전까지 Phase 2 진입 금지.

### Phase 2 — 샌드박스 iframe 뷰어 (보안 테스트 우선)

- **Task 2.1** `HtmlFileViewer.tsx` 신규 작성 — `sandbox` 속성 적용 iframe, 5MB 초과 시 "미리보기 불가" 안내, 로드 오류 처리.
- **Task 2.2** **보안 테스트(acceptance 시나리오 3·4·5)부터 통과시키기** — 공격 시뮬레이션·경로 탈출·범위 밖 읽기 차단을 먼저 검증.
- 게이트: 보안 시나리오 3개 통과 전까지 Phase 3 진입 금지.

### Phase 3 — 파일 종류 분기 + 화면 연결

- **Task 3.1** `PreviewContainer.tsx` 신규 작성 — 선택 파일 확장자로 `MarkdownPreview` / `HtmlFileViewer` 분기.
- **Task 3.2** `AppLayout.tsx` 프리뷰 슬롯을 `PreviewContainer`로 교체.

### Phase 3.5 — MX 태그 계획

- `PreviewContainer`의 파일 종류 분기 로직: `@MX:ANCHOR` 후보 — `AppLayout` 및 양쪽 프리뷰의 공통 진입점(fan_in 증가 예상). `@MX:REASON` 필수.
- Rust 폴더 열기 커맨드의 `allow_directory` scope 등록 코드: `@MX:WARN` — asset 프로토콜의 신뢰 경계(trust boundary)를 정하는 보안 임계 코드. 잘못 넓은 경로를 등록하면 경로 탈출·범위 밖 파일 읽기로 직결되며, 설계문서가 "반드시 테스트"로 지정한 지점. `@MX:REASON` 필수 — 등록 경로 정규화 누락 또는 과도한 범위 등록이 자산 격리를 무너뜨림을 명시.
- `HtmlFileViewer`의 sandbox 속성 설정부: `@MX:WARN` 후보 — sandbox 권한을 넓히면 앱 권한 탈취 위험. `@MX:REASON` 필수.
- `useFileSystem.openFile`의 확장자 분기: `@MX:NOTE` 후보 — HTML/마크다운 처리 경로가 갈리는 지점.
- 코드 주석 언어: `language.yaml`의 `code_comments: ko` 준수.

### Phase 4 — 파일 열기 동작 + 편집기 보기 전용 처리

- **Task 4.1** `useFileSystem.ts` `openFile`에 확장자 분기 추가 — `.html`은 편집기에 싣지 않고 HTML 보기 상태를 store에 설정.
- **Task 4.2** 편집기 패널 — HTML 파일 선택 시 "이 형식은 편집할 수 없습니다" 플레이스홀더 표시.

### Phase 5 — 사이드바 필터 확장

- **Task 5.1** `FileExplorer.tsx` `filterMdOnly`(약 39-49행)의 `.endsWith('.md')` 조건을 `.md` 또는 `.html`로 확장.

### Phase 6 — 런타임 scope 등록 강화 + 검증

- **Task 6.1** Rust 폴더 열기 커맨드의 `asset_protocol_scope().allow_directory()` 등록이 폴더 열기·전환 모든 경로(`openFolder`/`openFolderPath`/`changeFolder` 대응 커맨드)에서 빠짐없이 호출되는지 확인. 경로 정규화(절대 경로화 + 심링크 해소)가 모든 호출에 적용되는지 검증.
- **Task 6.2** 세션 누적·재시작 초기화 동작 확인 — 여러 폴더를 연 뒤 각각의 자산이 모두 로드되는지, 재시작 후 scope가 빈 상태인지.

### Phase 7 — 전체 검증 + 문서 갱신

- **Task 7.1** acceptance.md 전체 시나리오 실행 — 기능·보안·성능·회귀.
- **Task 7.2** 테스트용 샘플 폴더 구성 (HTML + 참조 자산 + 하위 폴더 HTML).
- **Task 7.3** `product.md`·`README` 소개 문서 갱신 — HTML 보기 기능을 독립 기능으로 반영. 마크다운 편집이 핵심이라는 점은 유지.

## 마일스톤 (우선순위 기반, 시간 추정 없음)

- **M1 (Priority High)**: Phase 1 — asset 프로토콜 설정 + 통로 작동 확인.
- **M2 (Priority High)**: Phase 2 — 샌드박스 iframe 뷰어 + 보안 시나리오 3개 통과.
- **M3 (Priority Medium)**: Phase 3 + 3.5 + 4 + 5 — 분기·연결·파일 열기·편집기 플레이스홀더·사이드바 필터.
- **M4 (Priority Medium)**: Phase 6 — scope 강화.
- **M5 (Priority Low)**: Phase 7 — 전체 검증 + 문서 갱신.

순서 제약: M1 완료 후 M2 시작, M2 보안 시나리오 통과 후 M3 시작.

## Definition of Done

- spec.md의 5개 EARS 요구 모듈이 모두 구현·검증됨.
- acceptance.md의 모든 Given/When/Then 시나리오 통과 — 특히 보안 시나리오 3·4·5와 회귀 시나리오 7.
- `cargo clippy` / `cargo test` (Rust 측) 및 프런트엔드 타입체크·테스트 통과.
- MX 태그 계획(Phase 3.5)에 따라 `@MX:ANCHOR`/`@MX:WARN`/`@MX:NOTE` 부착, `@MX:REASON` 포함.
- `product.md`·`README` 갱신 완료.

## 해결된 사항

- **(구 open question #1) asset scope 동적 갱신** — 해결됨. 런타임 scope 등록 방식 확정: 정적 `scope: []` + 폴더 열기마다 `allow_directory(<정규화 경로>, true)` 호출, 세션 누적, 재시작 시 초기화. Phase 1.2 / Phase 6에 구체 작업으로 반영. spec.md REQ-PREVIEW004-003 재작성, [DELTA]에 Rust 폴더 열기 커맨드 [MODIFY] 추가.

## 미해결 사항 (run 단계 확인 필요)

- **#2 5MB 임계값** — 설계문서가 "예: 5MB"로 제시한 값을 그대로 채택했다. 확정 수치인지 추후 조정 대상인지 run 단계에서 확인 권장.
- **#3 "HTML 미지원" 문서 위치** — 설계문서가 `product.md`·README에 "HTML 미지원"이 명시되어 있다고 언급하나 실제 문구 위치는 미확인. sync 단계에서 grep으로 찾아 갱신 필요.

> 참고: 런타임 scope 등록의 Rust accessor 정확한 이름(`asset_protocol_scope()` 추정)은 미해결 항목이 아니라 Phase 1.2의 통상적 구현 확인 사항이다 — 메커니즘 자체는 확정.
