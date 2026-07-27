# Changelog

All notable changes to MdEdit are documented here.

## [Unreleased]

## [0.13.1] - 2026-07-27

### Fixed
- **AI 재생성이 멈춘 것처럼 보이던 문제 (SPEC-AI-010)**: 제안 카드에서 「↻ 다시」·방향 지시 「↻」·「⚡ 고급 모델로 다시 시도」·「다시 시도」·「다시 요청」을 눌러도 첫 응답 조각이 도착할 때까지 카드가 이전 제안을 그대로 띄운 채 아무 변화가 없어, 재생성이 진행 중인지 알 수 없었습니다. 이제 버튼을 누르는 즉시 카드가 생성 중 표시(글로우 테두리 + 스켈레톤)로 돌아가고, 8초 이상 걸리면 대기 안내도 다시 뜹니다. 원인은 재요청 발행 함수가 요청 id를 반환하기 **이전에** 스토어를 갱신해, 그 순간의 구독이 아직 이전 id를 보고 있어 「생성 중」 전이가 카드에 전달되지 않은 것입니다.
- **AI 요청이 영원히 멈춰 있던 문제 (SPEC-AI-010)**: AI 도구 쪽에서 응답이 끊기면 카드가 「생성 중」 상태에 영구히 갇혀 수동 취소 외에는 빠져나갈 방법이 없었습니다. 카드마다 최후 방어 타임아웃을 두어, 종료 신호가 끝내 도착하지 않으면 다시 시도·닫기가 가능한 오류 카드로 스스로 전환합니다. 임계값은 백엔드 하드 타임아웃(60초)에서 파생시켜 백엔드의 분류된 오류가 항상 먼저 표시되게 했습니다. 아울러 검토 대기 카드에서 재요청을 하면 동시에 생성 중이던 **다른** 카드의 응답이 통째로 버려져 그 카드가 멈추던 결함도 수정했습니다 — 진행 중 요청 슬롯이 1개인데 카드는 여러 개일 수 있어, 카드가 자기 요청 id의 응답을 끝까지 받도록 이벤트 전달 경로를 분리했습니다.
- **「아래에 삽입」이 문서 맨 아래로 가던 문제 (SPEC-AI-010)**: AI가 만든 표·목록을 「⤵ 아래에 삽입」으로 넣을 때, 선택 위치 아래에 빈 줄이 하나도 없으면 바로 아랫줄이 아니라 문서 맨 끝에 삽입됐습니다. 문단 끝을 빈 줄 유무로만 찾던 것이 원인으로, 마크다운은 제목·목록 항목·표 행을 빈 줄 없이 단일 줄바꿈으로 구분하기 때문에 그런 문서에서는 항상 발동했습니다. 이제 마크다운 블록 경계를 인식해 현재 블록 바로 다음에 삽입하며, 여러 줄 문단은 중간에서 쪼개지지 않습니다. 같은 원인으로 「바꾸기」의 교체 범위가 문서 끝까지 넓어질 수 있던 위험도 함께 제거했습니다.
- **「⚡ 고급 모델로 다시 시도」가 한 번도 나타나지 않던 문제 (SPEC-AI-010)**: 방향 없이 「↻ 다시」를 반복해도 3회 제한이 동작하지 않아, 고급 모델로 한 번 더 시도해보라는 안내가 실제로는 표시된 적이 없었습니다(SPEC-AI-001 REQ-AI-025 미구현). 이제 방향 없는 재요청 3회를 쓰면 제안 카드에 안내와 [⚡ 고급 모델로 다시 시도]가 나타납니다. 이때 **기존 제안·방향 지시 입력칸·적용 버튼은 그대로 남습니다** — 안내가 덧붙을 뿐이라 애써 받은 제안을 잃지 않습니다. 방향 지시를 적어 재요청하면 연속이 끊겨 횟수가 초기화되고, 고급 모델 시도와 오류 복구용 재시도는 횟수에 포함되지 않습니다.

## [0.13.0] - 2026-07-27

### Added
- **codex CLI를 두 번째 AI 프로바이더로 통합 (SPEC-AI-009)**: OpenAI `codex` CLI를 지원하는 두 번째 로컬 AI 프로바이더로 추가. `claude`와 `codex` 중 하나라도 설치·로그인되어 있으면 AI 글쓰기 도우미가 동작합니다. 설정 다이얼로그의 "AI 도구" 섹션은 두 provider를 형태가 동일한 라디오 행으로 대등하게 나열합니다(자동 감지 시 **claude가 우선**, 미사용 행은 사유를 행 안에 인라인으로 표시). codex는 빈 스크래치 작업 디렉터리 + `--ignore-user-config` + `--skip-git-repo-check` + `--ephemeral` + `--sandbox read-only` + stdin 차단(`Stdio::null()`)으로 격리하며, 사용자 홈의 `AGENTS.md` 자동 로딩은 차단됩니다. macOS GUI 환경(`cargo tauri dev`)은 PATH가 최소화돼 있어 node 스크립트인 codex를 못 찾는 문제가 있어, 로그인 셸에서 복원한 PATH를 codex 프로세스에만 주입합니다. codex `--json` JSONL의 `item.completed`(`agent_message`) 결과를 `ai://chunk`로 1회 emit하고 `turn.completed`에서 `ai://done`으로 마무리합니다. 「고급 모델 사용」 토글은 provider별로 모델·추론 강도를 함께 바꿉니다 — claude 고급 = sonnet(사고 예산은 CLI 기본값에 위임), codex 고급 = gpt-5.5 + 추론 강도 상향. 토글 라벨은 실제 인자를 조립하는 것과 동일한 백엔드 함수에서 파생된 문자열을 그대로 표시해(claude → `sonnet`, codex → `gpt-5.5 · 높은 추론`) 라벨과 실제 동작이 어긋날 수 없습니다. 기존 `claude` 경로(인자 조립·스트림 파싱·프롬프트·프론트엔드 IPC 계약)의 기본 티어 동작은 바이트 단위 회귀 스냅샷으로 보증됩니다. 초기 통합 후 발견된 결함도 함께 수정했습니다 — codex JSONL 파서가 실제 출력 형태(래퍼 없는 FLAT)를 인식하지 못해 매 요청이 실패하던 문제, AI 오류 카드가 다른 파일을 열어도 남아 있고 닫을 방법이 없던 문제(파일 전환 시 진행 중 요청·고스트·카드 자동 정리 + 모든 종결 상태 카드에 [닫기] 추가), 이어쓰기가 빈 응답으로 끝나면 "✨ 작성 중…" 상태로 고착되던 문제("더 쓸 내용을 찾지 못했어요" 안내 + [✕ 닫기]로 대체). 검증: cargo test 326 passed, vitest 1312 passed, tsc·eslint 통과.

## [0.12.1] - 2026-07-24

### Fixed
- **「다른 이름으로 저장」이 다이얼로그를 건너뛰던 문제 (SPEC-FS-003)**: 기존 파일을 편집하다 「다른 이름으로 저장」을 실행하면 네이티브 저장 다이얼로그 없이 현재 파일에 즉시 덮어써서 일반 저장처럼 동작하던 결함. 모든 저장 진입점을 합친 단일 `saveDocument()`가 다이얼로그를 `currentFilePath` 유무로만 분기해 "다른 이름으로 저장 = 항상 다이얼로그"라는 의미가 유실된 것이 원인. `forceDialog` 옵션을 추가해 Save As 진입점(헤더 버튼·Ctrl/Cmd+Shift+S·저장 훅)에서만 다이얼로그를 강제하고, 일반 저장(Ctrl/Cmd+S)은 기존대로 현재 파일에 덮어쓴다.

## [0.12.0] - 2026-07-23

### Added
- **미저장 변경 보호 (SPEC-FS-003)**: 편집 중인 파일 전환·새 문서·창 닫기를 시도할 때 미저장 변경이 있으면 3버튼 모달(취소/저장 안 함/저장)로 보호한다. 재사용 가능한 `ConfirmDialog` 컴포넌트를 신설해 향후 다이얼로그의 공유 기반으로 둔다. 파일 워처 충돌 시엔 별도 모달(안전 선택지가 기본 포커스)로 분리. 동반 결함 3건도 함께 수정 — `openFile`의 dirty 리셋 누락, dirty 이중 소스 + 영속화된 stale `unsaved`, 5중 저장 중복을 단일 `saveDocument()`로 수렴. 폴더 이동의 허위 가드(문서를 버리지도 않는데 뜨던 경고)는 제거했다.
- **Export 후 열기 모달 (SPEC-EXPORT-002)**: HTML/DOCX 내보내기가 실제로 파일 쓰기까지 성공했을 때 저장 경로를 표시하고 3버튼(닫기/폴더에서 보기/열기) 모달을 띄운다. 기본 애플리케이션으로 열거나 파일 관리자에서 선택 표시(opener 플러그인, 크로스플랫폼). PDF는 OS 인쇄 다이얼로그가 경로를 소유해 이번 범위에서는 제외했다.

### Fixed
- **macOS에서 HTML/DOCX export 후 「열기」 실패**: 두 단계의 권한 결함이었다. (1) `opener:allow-open-path` 권한 누락 — `opener:default`에는 `allow-open-url`만 있고 `open_path`는 별도 explicit 권한이 필요. (2) path scope 누락 — 권한은 있어도 scope가 없으면 빈 scope로 모든 경로를 거부("Not allowed to open path"). 권한 + `{path:"**"}` scope 추가로 해결. Windows·Linux도 동일 원인.
- **앱이 닫히지 않는 문제(X 버튼)**: `core:window:allow-destroy` 권한 누락. `core:window:default`는 읽기/조회 권한만 담고 `destroy`/`close`/`hide`/`start-dragging`은 별도 explicit 권한이라, `getCurrentWindow().destroy()`가 권한 거부로 창을 닫지 못했다.

## [0.11.0] - 2026-07-22

### Added
- **AI 다이어그램 형태 선택 (SPEC-AI-008)**: ✨ 선택 툴바의 「🧜 다이어그램으로」에 호버 플라이아웃 서브메뉴 추가 — 「자동 (AI 판단)」 + 형태 7종(순서도·시퀀스·간트·클래스·상태·파이·마인드맵). 형태를 고르면 해당 mermaid 문법 제약이 프롬프트에 주입되어 원하는 형태로 생성되고, 자동 재요청에도 선택이 승계된다. 「자동」은 기존과 완전히 동일(조립 프롬프트 바이트 동일을 스냅샷 테스트로 보증). 검증 게이트는 기존과 같이 parse 유효성만 — 형태 불일치는 실패로 보지 않는다. 다듬기·개요·표·짧게·직접 입력 5종 프롬프트 무변경 가드 포함 (#40)
- **툴바 다이어그램 삽입 드롭다운 (SPEC-UI-008)**: 툴바에 mermaid 프리셋 7종 + 사용자 정의를 제공하는 다이어그램 삽입 드롭다운 추가 (#39)
- **가이드·활용사례 영상 갱신**: 가이드 영상(video/)에 SPEC-AI-008 다이어그램 형태 선택 플라이아웃 줌인 연출과 익스포트(PDF·HTML) 장면을 반영(4분35초). AI 활용사례 영상(영업·홍보 페르소나 2케이스, 88초)을 신규 추가

### Fixed
- **다이어그램·표 메뉴 3종이 패널 경계에서 잘리던 문제 (#40)**: AI 다이어그램 형태 서브메뉴, 툴바 다이어그램 드롭다운, 표 삽입 그리드 피커가 좁은 창 또는 넓은 창의 좁은 편집 패널에서 화면 밖·패널 밖으로 잘렸다. 잘림의 주체는 창이 아니라 `overflow-hidden` 편집 패널이어서 뷰포트 기준 판정으로는 잡히지 않았다. 실효 클리핑 경계(뷰포트 ∩ 클리핑 조상)를 계산해 여유 있는 쪽으로 뒤집고(flip), 그래도 넘치면 경계 안으로 밀어 넣는(clamp) 2단 배치로 교정 — 세 메뉴가 공용 헬퍼(`menuPlacement.ts`)를 공유한다. 실제 분할 레이아웃에서 패널 rect 기준으로 단언하는 Playwright 회귀 가드 4케이스 추가

## [0.10.1] - 2026-07-20

### Fixed
- **Ctrl+V 붙여넣기가 「다른 이름으로 저장」으로 가로채이던 문제 (#36)**: 새 문서에서 텍스트를 붙여넣으면 붙여넣기 대신 저장 대화상자가 뜨고 텍스트는 들어가지 않았다. 클립보드에 `image/*` 항목이 하나라도 있으면 이미지 붙여넣기로 단정한 것이 원인 — Windows 클립보드는 브라우저·Word·Excel·탐색기에서 **텍스트**를 복사해도 `text/plain` 과 함께 `image/png` 를 같이 싣는 경우가 흔해, 평범한 텍스트 붙여넣기가 이미지로 오판되고 있었다. 이제 쓸 만한 텍스트가 있으면 텍스트를 우선한다. 조사 중 발견한 관련 결함 2건도 함께 수정:
  - 이미지를 data URI 로 문서에 직접 넣는 기본 모드(`inline-blob`)는 파일 경로가 필요 없는데도 저장을 요구해, 새 문서에 이미지를 붙여넣을 때 불필요하게 저장 대화상자가 떴다. 경로가 실제로 필요한 「파일로 저장」 모드에서만 요구하도록 좁혔다
  - 「파일로 저장」 모드에서 저장 위치를 고르는 동안 브라우저가 클립보드를 무효화해, 저장을 마쳐도 이미지가 삽입되지 않았다. 대화상자를 띄우기 전에 이미지를 확보하도록 바꿨다
  - 드래그·드롭 경로는 의도적으로 그대로 두었다 — 드롭은 항상 기준 경로가 필요하므로 저장 요구가 정당하고, 파일만 다루므로 텍스트 오판 문제도 없다

## [0.10.0] - 2026-07-19

### Added
- **✨ 프리셋 메뉴 길이 가드 안내 상시 표시 (SPEC-AI-007)**: 선택이 길어 프리셋이 비활성(>4,000자) 또는 편집 비활성·변환 삽입 전용(2,001~4,000자)이 될 때, 이유를 메뉴 안 안내 줄로 상시 표시 — 회색 메뉴만 보고 원인을 알 수 없던 문제 해소. ≤2,000자에서는 기존과 동일(무변경)

### Changed
- **AI 적용 방식을 사용자가 선택 (#26)**: 길이 가드에 걸리지 않는 한 모든 프리셋이 「✓ 바꾸기」와 「⤵ 아래에 삽입」 두 버튼을 노출한다. 이전에는 다듬기·짧게·직접 입력이 제자리 바꾸기만, 표·다이어그램이 아래에 삽입만 가능했다. 기능이 없던 것이 아니라 정책이 막고 있던 것으로, 두 적용 경로는 이미 구현되어 있었다. 기본 강조만 계열별로 다르다(표·다이어그램은 아래에 삽입, 나머지는 바꾸기). 긴 선택(2,001~4,000자)의 삽입 전용 제한은 안전장치이므로 유지
- **길이 초과 안내에 글자 수·한도·이유 표시 (#29)**: "선택이 너무 길어요" 한 줄이던 문구를 `지금 5,170자예요 — 다듬기·직접 입력은 2,000자까지만 돼요…` 형태로 교체하고, 왜 잘라서라도 처리하지 않는지(못 읽은 부분이 조용히 사라짐) 설명을 덧붙였다. 편집(2,000자)과 변환(4,000자)의 한도가 다른데 두 경우 모두 같은 문구를 써서 어느 한도에 걸렸는지 구분되지 않던 문제도 함께 해소. 부분 허용 구간(2,001~4,000자) 안내도 같은 형식으로 통일

### Fixed
- **Windows 사용 중 발견된 UI·프로세스 결함 3건 (#25)**:
  - 분할 모드에서 스플리터를 오른쪽으로 밀어도 편집 영역이 전체 폭의 80%에서 멈추던 문제 — 최소 패널 폭을 퍼센트 대신 px(240px) 기준으로 바꿔, 넓은 창에서는 편집 영역이 88%까지 확장되고 좁은 창에서도 미리보기가 접히지 않는다
  - AI 프리셋 메뉴가 오른쪽 분할선 근처에서 잘리던 문제 — 기존 상하 flip과 대칭으로 좌우 flip을 추가. 가로 방향의 경계는 뷰포트가 아니라 편집 패널이므로 `overflow-x` 클리핑 조상을 기준으로 판정한다
  - AI 기능 실행 시 콘솔 창이 포그라운드로 떴다 사라지던 문제 — Windows에서 자식 프로세스에 `CREATE_NO_WINDOW`를 적용. `spawn_claude`·`detect_claude`·`open_url_in_browser` 세 지점이 공용 헬퍼를 경유한다
- **AI 표 생성 결과에 삽입 전 구조 검증 추가 (#27)**: 다이어그램에는 사전 검증·자동 재요청이 있었으나 표에는 없어, 구분선(`|---|---|`)이 빠진 출력이 파이프 문자가 붙은 문단으로 그대로 삽입되고 열 수가 어긋나면 GFM이 조용히 셀을 버렸다. `table_open` 토큰 존재(구분선 누락·코드펜스로 감싼 응답·산문을 한 번에 포착)와 열 수 일치를 검사해 1회 자동 재요청하고, 재요청도 무효면 사용자가 직접 판단하도록 통과시킨다. 열 수는 토큰이 아니라 원본 라인을 되짚어 센다 — markdown-it은 본문 행을 헤더 열 수만큼만 `td`로 만들고 초과 셀을 버려서, 토큰을 세면 실제 데이터 유실 케이스가 영구 미검출된다
- **AI 제안 카드가 첫 청크에서 얼어붙던 문제 (#31)**: 프리셋 메뉴 결과 카드는 스트리밍하도록 설계돼 있었으나 실제로는 첫 몇 글자만 보이고 멈췄다가 완성본이 한 번에 나타났다(이어쓰기는 다른 렌더 경로라 정상). 카드 key 가 버퍼를 `skeleton`/`filled` 두 값으로만 표현해 첫 청크 이후 고정되고, key 가 같으면 `eq()` 가 true 라 CodeMirror 가 DOM 을 아예 건드리지 않는 것이 원인. 버퍼가 찬 뒤에는 key 에 길이를 싣고, `updateDOM` 으로 스트리밍 텍스트만 제자리 패치해 위젯 재생성 없이 갱신한다 — 재생성이 없으므로 글로우 애니메이션(REQ-AI2-013)과 스크롤 재킹 방지(BUG-8)가 그대로 유지된다. `updateDOM` 은 같은 *타입*의 위젯이 만든 DOM 을 받을 뿐 같은 카드라는 보장이 없어, 다른 `requestId` 의 DOM 을 패치하면 취소 버튼이 이전 카드 콜백을 붙들게 되므로 key 를 dataset 에 새겨 대조한다
- **AI CLI 내장 도구 전면 비활성화 (#28)**: `claude` CLI 실행 인자에 도구 제한이 하나도 없어, 격리가 능력 차단이 아니라 "빈 스크래치 디렉터리라 찾을 것이 없다"는 정황에만 의존하고 있었다(실측 확인: 파일이 있는 디렉터리에서 동일 인자로 실행하면 Read 도구가 동작해 내용을 반환). 이 앱의 AI 기능은 전부 순수 텍스트 변환이라 도구가 필요 없으므로 `--tools ""`로 전면 비활성화. 동작 영향 없음. 향후 작업 디렉터리를 바꾸는 기능이 추가되어도 방어선이 남는다

## [0.9.0] - 2026-07-17

### Added
- **AI 인라인 편집·섹션 채우기 (SPEC-AI-001, 로컬 Claude Code CLI 기반)**:
  - ✨ 선택 툴바: 텍스트 선택 시 ✨ 버튼 → 프리셋 6종(🖊 다듬기, 📋 개요로 정리, 📊 표로 만들기, 🧜 다이어그램으로(mermaid — 사전 검증·자동 재요청·목록 폴백), ✂️ 짧게 줄이기, ✏️ 직접 입력)
  - 제안 카드: 실시간 스트리밍 → 검토 → 바꾸기/아래 삽입, Cmd+Z 1회 복원, ↻ 다시/직접 지시 재요청, 고급 모델(sonnet) 토글
  - 섹션 채우기: 빈 헤딩 아래 빈 줄에서 Cmd+Enter(또는 3초 멈춤 힌트 클릭) → 회색 고스트 스트리밍 → Cmd+Enter 확정 / Esc 버리기, [✓ 넣기]·[✕ 지우기]·[■ 중지] 버튼
  - 문서 끝 이어쓰기: 문서 끝 빈 줄에서 Cmd+Enter 또는 "✨ 이어쓰기" 힌트로 문체 상속 이어쓰기
  - 전제: 로컬 Claude Code CLI(`claude`) 설치·로그인 필요, 설정 모달(헤더 톱니)에서 연결 상태 확인, 미로그인 시 온보딩 안내, 조직 정책 kill-switch(`MDEDIT_AI_DISABLED=1` 또는 정책 파일) 지원
  - 프라이버시: 문서 내용은 로컬 CLI를 통해서만 전송, 앱 자체 서버 없음, 요청당 CLI 프로세스 1개·동시 1개 처리
- **AI 작업 중 로딩 인디케이터 (SPEC-AI-002)**: 제안 카드에 글로우 그라데이션 테두리 + shimmer 스켈레톤, 고스트 텍스트에 "✨ 작성 중…" 펄스 애니메이션, `prefers-reduced-motion` 설정 시 정적 표시로 대체
- **에디터 툴바 표 삽입 (SPEC-UI-007)**: 툴바에 표 삽입 버튼 + 8×8 그리드 피커 팝오버 추가 — 셀 호버 시 "행 × 열" 크기 라벨과 하이라이트 표시, 클릭 시 헤더/구분 행 포함 markdown 표 스켈레톤을 커서 위치에 삽입하고 첫 헤더 셀 선택 상태로 포커스 복귀 (#11)
- **AI 자유 위치 이어쓰기 (SPEC-AI-003)**: 문서 임의 커서 위치에서 Cmd+Enter(또는 힌트)로 이어쓰기 트리거 — 코드펜스·표 내부는 자동 배제, 리스트·인용 내부는 수동 트리거만 허용(힌트 제외), 미종결 문장 줄 끝 3초 멈춤 시 힌트 알약 표시(2단 자격), 뒤 문맥을 인지해 반복·선점 없이 매끄럽게 연결하는 프롬프트, 스트리밍 중 타이핑 시 고스트 소멸과 함께 진행 중 요청도 즉시 취소
- **AI 기능 사용자 켜기/끄기 토글 (SPEC-AI-005)**: 설정 모달 AI 섹션에 영속 토글("AI 기능 사용", 기본 켜짐) 추가 — 끄면 ✨ 선택 툴바·3초 유휴 이어쓰기 힌트·`Mod+Enter` 신규 이어쓰기 트리거가 모두 사라지고 진행 중인 AI 요청은 즉시 취소되며 어떤 요청도 발생하지 않음(문서 본문은 무손상). 조직 정책 잠금(REQ-AI-017)이 항상 사용자 토글에 우선하며, 정책 잠금 시 토글은 비활성+🔒로 표시(정책 잠금이 편집기 표면도 인지하지 못하던 기존 미비를 부수 수정). 사용자 OFF 값은 정책과 독립적으로 저장되어 정책 해제 후에도 유지. IPC·Rust·프롬프트 무변경
- **AI 프롬프트 정밀화 + 요청 워치독 + 이어쓰기 UX 3종 (SPEC-AI-006)**:
  - 인라인 변환(다듬기/개요/표/다이어그램/줄이기/직접 입력) 시스템 프롬프트에 대상-스코핑 절 부착 — 앞뒤 문맥을 결과에 흡수하던 버그 해소, Polish 프롬프트의 "한국어 문장 교정기" 하드코딩을 언어 중립 표현으로 대체(입력 언어 유지)
  - 요청당 하드 타임아웃 워치독(기본 60초) 추가 — 응답 없는 `claude` 프로세스를 종료하고 기존 login/network/parse/other와 구별되는 `timeout` 오류를 표면화, 정상 완료·취소·신규 요청 교체와의 경합에서도 terminal 이벤트 정확히 1회만 발행(단일발행 선점)
  - 첫 응답 없이 8초 경과 시 카드 스켈레톤·고스트 플레이스홀더에 "아직 생성 중이에요 — 취소할 수 있어요" 대기 안내 문구 표시(가짜 진행률 없음), 응답/취소 시 즉시 제거
  - 완료(done) 상태의 고스트에 재요청(↻) 추가 — 원 트리거 인자를 재사용해 동일 종류의 요청을 재발행(카드 재요청과 동일 의미론), streaming 중에는 미노출
  - 이어쓰기(문체 상속) 전용 길이 옵션(짧게/보통) 추가 — 설정 모달 AI 섹션 토글로 영속 설정, 기본값 '보통'은 기존 동작과 바이트 동일 유지, 인라인 변환·섹션 채우기에는 영향 없음
  - 신규 런타임 의존성 없음, 이어쓰기/섹션 채우기 프롬프트 하위호환 보존

### Fixed
- **AI 프롬프트 품질 핫픽스 (SPEC-AI-004)**: 인라인 편집이 앞/뒤 문맥을 변환 대상으로 흡수하던 문제, 이어쓰기가 커서 앞 텍스트를 재복창하던 문제, 다이어그램 생성이 금지된 코드펜스를 재출력하던 문제, 이어쓰기가 미요청 형식으로 과잉 생성하던 문제를 프롬프트 지시문 정비로 수정

---

## [0.8.0] - 2026-07-16

### Added
- **이미지·SVG 뷰어 (SPEC-PREVIEW-008)**:
  - `ImageFileViewer`(png/jpg/gif/webp/bmp/ico/avif): `asset://` 로드, zoom/pan, 체커보드 배경, 픽셀·용량 메타 표시
  - `SvgFileViewer`: 렌더↔소스 토글, DOMPurify SVG 프로파일 sanitize
  - 마크다운 내 인라인 `<svg>`: placeholder-restore + DOMPurify 복원(`html:false` 유지)
- **Mermaid 다이어그램 라이트/다크 테마 연동 (SPEC-PREVIEW-010)**:
  - mermaid 다이어그램 테마가 앱 라이트/다크 모드를 따라감(dark→`dark`, light→`default`)
  - 테마 토글 시 이미 렌더된 다이어그램도 라이브 재채색(SVG 색이 baked되므로 재초기화+재렌더)
  - `securityLevel: 'strict'`는 베이스 상수화로 약화 차단, `system` 모드는 OS `prefers-color-scheme` 변경에 반응

### Fixed
- **코드 파일 미리보기 배경을 앱 서피스에 맞춤**: Shiki 인라인 배경을 투명화해 컨테이너 배경 상속(라이트/다크 정합)
- **사이드바 접기 토글과 헤더 겹침 해소**
- **파일 탐색기 상위 폴더 화살표 아이콘 광학 정렬 수정**
- **인라인코드 `<svg>` 언급이 실제 SVG 추출을 막던 버그 수정 (SPEC-PREVIEW-008)**
- **Windows: 작업표시줄에 옛 아이콘이 표시되던 문제**: 실행 시 모든 창에 `set_icon`(WM_SETICON)으로 아이콘을 직접 세팅해 AppUserModelID별 셸 iconcache를 덮어씀 (tauri `image-png` feature 추가)
- **Windows: 릴리즈 빌드에서 바뀐 아이콘이 .exe에 재임베드되지 않던 문제**: `build.rs`에 아이콘·설정 파일 `cargo:rerun-if-changed` 등록으로 아이콘 변경 시 리소스 자동 재임베드

---

## [0.7.0] - 2026-07-15

### Changed
- **UI 디자인 시스템 리스킨 (SPEC-UI-006)**:
  - Claude Design 핸드오프(steel-blue 디자인 시스템)를 채택한 전체 UI 리스킨 — 헤더·푸터·사이드바·에디터·프리뷰 표면의 시각 스타일 전면 교체
  - 시맨틱 디자인 토큰 CSS(`mdedit-tokens.css`) + 컴포넌트 클래스 CSS(`mdedit-components.css`) 도입, 라이트/다크 테마 정비
  - 이모지·리터럴 파이프 아이콘을 인라인 SVG 아이콘(Lucide 기반)으로 교체
  - Barlow / Barlow Condensed / IBM Plex Mono 로컬 웹폰트 번들(오프라인 데스크톱 앱, 신규 런타임 의존성 없음)
  - `useTheme`에 `data-theme` 테마 브리지 추가
  - 앱 아이콘 교체: 기존 밝은 파란 M 스퀘어클 → 다크 나이트 타일 + 흰색 해시(#) + steel-blue 연필. Codex로 SVG 디자인, `tauri icon`으로 전체 세트(PNG/icns/ico/android/ios) 재생성. 새 디자인 시스템과 톤 통일.
  - 동작 로직(Tauri IPC, export, CodeMirror extensions, store) 무변경 — 표현 계층만 변경

---

## [0.6.3] - 2026-07-15

### Fixed
- **폴더 이름의 연속 점('..')으로 폴더가 열리지 않던 문제**:
  - 경로 검증 가드가 `path.contains("..")` 부분 문자열 검사를 사용해, 이름에 연속된 점이 포함된 정상 폴더(예: `...오징어게임..-시장...`)를 경로 탈출로 오탐하여 폴더 열기·파일 작업을 차단하던 문제 수정
  - `validate_path`(모든 파일/디렉터리 IPC 경유)와 `canonicalize_folder_path`(asset scope 등록)를 경로 컴포넌트 단위 `Component::ParentDir` 판정으로 교체
  - 이름 내부의 `..`는 허용하고 실제 `../` 경로 탈출만 차단 — 보안 무손상(기존 탈출 거부 테스트 유지)
  - 회귀 방지 단위 테스트 2건 추가, 실제 폴더 경로 통합 검증 통과 (command 테스트 76 통과)
  - 앱 소스(프론트엔드) 변경 없음, 신규 의존성 없음

---

## [0.6.2] - 2026-06-26

### Changed
- **파일 탐색기 전체 파일 노출 (SPEC-PREVIEW-007)**:
  - 확장자 allowlist 필터 제거 — 폴더의 모든 파일(dotfile·확장자 없는 파일 포함)과 디렉터리를 노출 (SPEC-PREVIEW-004/005의 필터 동작 대체)
  - 인식 안 되는 텍스트 파일(`.gitignore`, `.rs`, `.log`, `.csv` 등)은 평문으로 표시 + 편집 가능
  - 바이너리/읽기 불가 파일(`.png`, `.pdf`, `.zip` 등)은 "미리보기 불가" 플레이스홀더 표시, 편집기에 로드하지 않음 (신규 `UnsupportedFileViewer`)
  - 대용량 파일(5MB 초과)은 전체 로드 없이 "미리보기 건너뜀" 안내 (`FileNode.size` 기반 사전 가드)
  - `.md`/`.markdown`은 항상 마크다운으로 렌더 — 평문 폴백 회귀 방지
  - 모든 파일 클릭이 예외 없이 안전하게 처리됨(이전 "모든 파일 노출 시 깨짐" 버그 해소)
  - Rust 변경 없음, 신규 런타임 의존성 없음, 55개 테스트 추가 (전체 534 통과)

### Fixed
- **mermaid subgraph 제목 줄바꿈 (SPEC-PREVIEW-006)**:
  - 긴 한국어 subgraph(cluster) 제목이 mermaid의 하드코딩 `foreignObject width=200`(mermaid #6110) 때문에 2줄로 줄바꿈되던 문제를 patch-package로 해결 — 이제 1줄로 표시
  - cluster `rect` 렌더러의 `createText` 호출에 명시적 width 전달 (`patches/mermaid+11.12.3.patch`)
  - mermaid를 정확히 `11.12.3`으로 고정 + `postinstall`로 패치 결정론적 재적용
  - Playwright 가드 테스트로 1줄 표시·무겹침 검증 (버전 드리프트·패치 누락 시 자동 실패)
  - config-only / CSS·JS patchwork / ELK 대안은 검증 후 기각 (SPEC에 근거 기록)
  - 앱 소스 변경 없음, 신규 런타임 의존성 없음

---

## [0.6.0] - 2026-05-21

### Added
- **뷰 모드 토글 (SPEC-UI-004)**:
  - Header에 3-버튼 세그먼티드 토글(편집/분할/미리보기) 추가
  - Editor/Preview 영역을 split(기본값) / editor / preview 세 모드로 전환
  - 선택한 뷰 모드는 앱 재시작 후에도 복원(localStorage 자동 영속화)
  - `.html` 파일은 editor 모드에서 자동 미리보기 표시(렌더링 한정, store 값 보존)
  - 신규 `ViewModeToggle` 컴포넌트로 분리(ImageModeToggle 패턴 재사용)
  - 22개 신규 테스트 추가 (전체 테스트 448 통과)
  - 신규 의존성 없음

- **소스/설정 파일 제네릭 보기 (SPEC-PREVIEW-005)**:
  - 코드·데이터 파일 `.py`, `.js`/`.mjs`/`.cjs`, `.ts`, `.json`, `.jsonl`, `.yaml`/`.yml`, `.toml`, `.sh`/`.bash`, `.css`를 확장자 기반 라우팅으로 감지
  - 신규 `CodeFileViewer` 컴포넌트가 공유 Shiki 하이라이터로 구문 강조된 보기 전용 렌더링 제공
  - 에디터 버퍼 변경 시 300ms 디바운스로 라이브 재렌더
  - 다크/라이트 테마 자동 감지 및 연동 (`github-dark`/`github-light`)
  - 구문 강조 오류 또는 미지원 확장자 발생 시 안전한 텍스트 폴백 처리
  - 신규 의존성 없음 — 기존 Shiki 싱글톤 재사용
  - 79개 신규/확장 테스트 추가 (전체 테스트 424 통과)
  - `src/lib/preview/extensionLangMap.ts` + `src/components/preview/CodeFileViewer.tsx` 신규 작성
  - `PreviewContainer.tsx` 타입 확장 (`'code'` 분기 추가)
  - `src/lib/markdown/codeHighlight.ts` `toml` 언어 추가

### Fixed
- **미리보기 폰트 크기 축소/확대 (A-/A+) 통합**: 헤더의 A-/A+ 폰트 조절이 마크다운 미리보기의 헤딩·코드·표·이미지·간격을 zoom 배율로 함께 확대/축소하도록 통합
  - 이전: A-/A+ 버튼은 에디터만 확대/축소, 미리보기 헤딩과 코드는 고정 크기 적용 (인라인 코드, 표도 동일)
  - 현재: fontSize 설정을 CSS zoom = fontSize/14로 해석하여 미리보기 및 코드 뷰어에 동시 적용, 모든 요소가 브라우저 zoom처럼 비례 축소
  - 대상 파일: `src/lib/preview/previewZoom.ts` (신규), `MarkdownPreview.tsx`, `CodeFileViewer.tsx`, `src/index.css`, 관련 테스트 개선
  - `.html` iframe 뷰어와 에디터는 변경 없음
  - 신규 npm 의존성 없음 (456개 테스트 통과, 타입 체크 통과)

---

## [0.5.0] - 2026-05-19

### Added
- **독립 HTML 파일 보기 (SPEC-PREVIEW-004)**:
  - 사이드바 파일 트리에서 `.html` 파일 표시 및 선택 가능
  - 샌드박스 iframe (`sandbox="allow-scripts allow-same-origin"`)에서 보기 전용 렌더링
  - 같은 폴더의 외부 자산(CSS, 이미지)과 스크립트 정상 로드
  - Tauri asset 프로토콜 + 런타임 scope 등록으로 열린 폴더로만 접근 제한
  - 편집기 패널에는 "이 형식은 편집할 수 없습니다" 플레이스홀더 표시
  - 마크다운 렌더링 파이프라인에 미영향
- **사이드바 파일 익스플로러 `.md` 필터**: 마크다운 파일만 표시하도록 필터 적용
- **Playwright E2E 회귀 테스트**: `e2e/html-file-viewer.spec.ts`로 HtmlFileViewer 동작 검증
- **HTML 미리보기 샘플 4종**: `samples/html/`에 basic / rich-content / interactive 샘플 + README 추가

### Changed
- **HTML 파일 미리보기 5MB 임계 제거** (SPEC-PREVIEW-004 v1.3.0): Tauri asset 스트리밍 기반으로 변경되어 대용량 HTML도 미리보기 가능

### Fixed
- **Windows WebView2 CSP 차단 수정** (SPEC-PREVIEW-004 Windows 호환성):
  - Tauri v2 IPC(`ipc:`) 및 `tauri:` 호스트를 CSP `frame-src`에 허용
  - `frame-src`를 스킴 단위(`asset:`, `tauri:`, `https:` 등)로 광범위 허용해 Windows에서 iframe 차단 해소
  - iframe asset URL의 Windows 백슬래시(`%5C`) 인코딩을 슬래시로 정규화
  - `index.html` 메타 CSP를 Windows asset URL 차단 회귀에 맞춰 정정 (SPEC-PREVIEW-004 v1.3.1)
  - `directory_ops.rs` 보강으로 asset scope 등록 안정화
  - CSP 진단 과정에서 일시 비활성화했던 설정을 본 fix 이후 정상 복구

---

## [0.4.0] - 2026-04-01

### Added
- **KaTeX LaTeX 수식 렌더링 (SPEC)**
- **이미지 위젯 장식 (SPEC-IMG-WIDGET-001)**:
  - CodeMirror 6 ViewPlugin + WidgetType으로 inline-blob 이미지를 컴팩트 위젯으로 시각화
  - Data URI 이미지(`data:image/...;base64,...`) 자동 감지 및 위젯 렌더링
  - 위젯은 썸네일(최대 80px 높이), alt 텍스트, MIME 타입, 파일 크기 KB 단위 표시
  - 파일 경로(`./images/...`)나 HTTP URL(`https://...`)은 위젯 미적용 (Data URI만 처리)
  - 문서 변경 시 동적 업데이트 (이미지 붙여넣기, 삭제 등)
  - 위젯 클릭으로 원본 마크다운 텍스트 접근 가능
  - 다크/라이트 모드 테마 자동 적응 (CSS 변수 사용)
  - 32개 TDD 테스트 추가 (모두 통과)
- **이미지 삽입 모드 설정 (SPEC-IMG-MODE-001)**:
  - 기본값: 이미지 inline-blob 모드 (base64로 마크다운에 직접 임베드)
  - `Image` 드롭다운 메뉴로 Inline/File 모드 전환 가능
  - 선택한 모드는 localStorage에 자동 저장
- **이미지 지원 (SPEC-IMG-001)**:
  - 클립보드 붙여넣기(Cmd+V)로 이미지 삽입 → `images/` 폴더에 자동 저장
  - 툴바 이미지 버튼 또는 Cmd+Shift+I로 파일 다이얼로그 이미지 삽입
  - 이미지 파일 드래그앤드롭 지원 (복수 파일 처리)
  - 미저장 파일에서 이미지 삽입 시 Save As 자동 안내
  - 미리보기 패널에서 상대경로 이미지를 Tauri `asset:` 프로토콜로 렌더링
  - HTML 익스포트 시 로컬 이미지 base64 임베드 (self-contained HTML)
  - PDF 익스포트 시 `page-break-inside: avoid` CSS 적용
  - DOCX 익스포트 시 `ImageRun`으로 실제 이미지 바이너리 임베드
  - 경로 탐색 공격 방지 (`validate_path()` 검증), 이미지 크기 10MB 제한
- **File explorer with standard navigation UI**:
  - `..` parent directory entry at top of file list for quick parent navigation
  - Go Up (↑) button in sidebar header with parent path tooltip
  - Refresh button to reload directory contents after external changes
  - Search/filter input to find files within opened folder
- **File tree directory navigation**: click directory to navigate into it
- **File node serialization**: `FileNode` Rust model now serializes with `camelCase` JSON keys (`#[serde(rename_all = "camelCase")]`)
  matching TypeScript interface — fixes directory detection always returning `undefined`
- **Non-blocking file watcher**: File watcher (`startWatch`) runs non-blocking; watcher failure no longer prevents folder navigation
- Test suite: 192 tests passing (21 test files, frontend) + 78 tests passing (Rust backend)

### Fixed
- **Directory navigation bug**: Clicking a directory triggered `openFile` instead of `openFolderPath` because
  `node.isDirectory` was always `undefined` (Rust serialized `is_directory` instead of `isDirectory`)
- **Unhandled Promise rejection**: "Path is a directory, not a file" when clicking `.claude` folder
- **Test mock fix**: `openFolderPath` returned `undefined` instead of `Promise<void>`, causing `.catch()` errors
- **system 테마 export 정합성**: `system` 테마일 때 HTML/PDF/DOCX export가 항상 라이트 테마로 출력되던 버그 수정 — `window.matchMedia('prefers-color-scheme: dark')`로 실제 OS 다크 모드를 반영 (`AppLayout.tsx`)
- **파일 경로 이중 상태 불일치**: `Mod-Shift-s`, `Mod-Shift-i` 단축키 및 이미지 붙여넣기/드래그 핸들러에서 `fileStore.currentFile`이 갱신되지 않아 헤더 파일명이 구버전을 표시하던 버그 수정 (`MarkdownEditor.tsx`)
- **단축키 일관성**: `Mod-s`를 미저장 파일에서 실행 시 아무 동작도 하지 않던 문제를 수정 — 헤더 Save 버튼과 동일하게 Save As 다이얼로그로 연결 (`MarkdownEditor.tsx`)
- **`Mod-n` 단축키**: 새 문서 생성 시 `fileStore.currentFile`을 초기화하지 않아 헤더에 이전 파일명이 남던 버그 수정 (`MarkdownEditor.tsx`)

---

## [0.1.0] — Initial Implementation

### Added
- Tauri v2 + React 18 desktop application scaffold
- CodeMirror 6 Markdown editor with syntax highlighting
- Real-time Markdown preview via markdown-it 14
- Shiki 3 syntax highlighting for code blocks in preview
- Mermaid 11 diagram rendering (flowcharts, sequence, state, etc.)
- Zustand 5 state management (fileStore, uiStore)
- Resizable sidebar / editor / preview panels
- System dark/light theme support
- File explorer sidebar with context menu (New File, New Folder, Rename, Delete)
- Rust backend file operations: read, write, create, delete, rename
- Path traversal attack prevention in all Rust file commands
- File watcher integration for external change detection
- Lazy directory loading (children fetched on first expand)
- Header with font size controls and theme toggle
- Footer with cursor position, line count, and encoding info
- Full test suite: Vitest (frontend) + cargo test (Rust backend)
