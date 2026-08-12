# Acceptance Criteria: SPEC-IMG-LOAD-002

> **범위**: Axis A(뷰포트/폴딩)·B(스트리밍)·C(Worker)·D(임계값) 전체 인수 조건 + WIDGET-001 회귀 가드. 각 AC는 마일스톤(M1~M4)에 대응한다.

## Test Scenarios (Gherkin Given/When/Then)

### Axis A — 뷰포트 렌더링 + 라인 폴딩 (Milestone 1)

#### AC-2-A1: 위젯 데코레이션 뷰포트 한정 (REQ-A-001)

```gherkin
Given 4MB 마크다운 문서에 data URI 이미지 100개가 분산되어 있다
And CodeMirror visible viewport는 처음 50줄만 표시한다 (data URI 5개 포함)
When buildDecorations(view)가 호출된다
Then visible 범위의 5개 data URI에 대해서만 Decoration.replace 위젯이 생성된다
And visible 범위 밖의 95개 data URI는 데코레이션에서 무시된다
And view.state.doc.toString()은 호출되지 않는다 (full-doc copy 회피)
```

**자동화**: UT-A1-001 (단위 — `buildDecorations(view)` 모킹 visible 범위, 데코레이션 수가 visible data URI 수와 일치 단언 + `toString` 미호출 스파이)

#### AC-2-A2: 뷰포트 변경 시 데코레이션 갱신 (REQ-A-002)

```gherkin
Given 사용자가 문서 상단에 있어 처음 50줄이 visible이다 (data URI 5개)
When 사용자가 스크롤하여 51~100줄이 visible되면 (data URI 10개 추가)
Then update 훅이 viewportChanged에서 트리거된다
And 새로 visible 된 10개 data URI의 위젯이 렌더링된다
And 더 이상 visible하지 않은 위젯은 제거된다
```

**자동화**: UT-A1-002 (단위 — viewport 변경 이벤트 시뮬레이션, 데코레이션 갱신 단언) + PT-A1-002 (Playwright — 스크롤 후 위젯 출현)

#### AC-2-A3: 거대 라인 자동 폴딩 (REQ-A-003)

```gherkin
Given 문서에 2MB 단일 라인이 있다 (base64 data URI 한 줄 — LINE_FOLD_THRESHOLD 1MB 초과)
When 문서가 로드되거나 편집될 때
Then 해당 라인은 자동으로 fold된다
And fold 표시(예: "…folded")가 표시된다
And 라인의 전체 내용이 렌더링되지 않는다 (디스플레이 비용 절감)
```

**자동화**: UT-A1-003 (단위 — `LINE_FOLD_THRESHOLD` 초과 라인이 `Decoration.fold`를 받음 단언)

#### AC-2-A4: 폴드 토글 (REQ-A-004)

```gherkin
Given 2MB 라인이 fold되어 "…folded" 표시가 보인다
When 사용자가 fold 표시를 클릭한다
Then 해당 라인이 펼쳐져 전체 내용이 표시된다
When 사용자가 다시 클릭한다
Then 라인이 다시 fold된다
```

**자동화**: PT-A1-004 (Playwright — must-pass. 클릭/hover 경로는 jsdom에 잡히지 않으므로 Playwright 필수 — [feedback-jsdom-pointer-blindspot])

#### AC-2-A5: 이미지 삽입 시 폴딩 힌트 (REQ-A-005)

```gherkin
Given imageInsertMode가 "inline-blob"이다
And 사용자가 이미지를 붙여넣거나 다이얼로그에서 선택한다
When insertImageMarkdown이 data URI(1.5MB)를 삽입한다
Then 삽입된 라인이 즉시 fold 트리거된다
And 두 진입점(툴바 버튼, Cmd+Shift+I) 모두 동일한 폴딩 힌트를 적용한다 (001 REQ-IMG-LOAD-A-004 대칭)
```

**자동화**: UT-A1-005 (단위 — `insertImageMarkdown` 호출 후 fold effect dispatch 단언, 4개 호출부 대칭)

#### AC-2-A6: 대용량 파일 편집 시 동결 없음 (REQ-A-006)

```gherkin
Given 4MB 마크다운 파일에 거대 base64 라인 20개가 포함되어 있다
When 사용자가 파일을 열고 에디터에 글자를 입력한다
Then 입력 후 INPUT_RESPONSIVENESS_BUDGET_MS(5초) 이내에 첫 paint가 발생한다
And 메인 스레드가 동결하지 않는다
And 사용자가 추가 입력을 계속할 수 있다
```

**자동화**: PT-A1-006 (Playwright — must-pass. 4MB fixture 오픈 후 타이핑, 5초 이내 keydown→paint 단언. CI에서는 warning-only 허용 — OD-1)

### Axis B — chunked 스트리밍 읽기 (Milestone 3)

#### AC-2-B1: 청크 단위 읽기 IPC (REQ-B-001)

```gherkin
Given 10MB 텍스트 파일 "/path/to/large.md"가 있다
When readFileChunk("/path/to/large.md", 0, 262144)가 호출된다 (256KB)
Then 첫 256KB가 올바른 UTF-8 문자열로 반환된다
And offset=262144에서 다음 256KB가 반환된다
And 마지막 청크는 256KB보다 짧을 수 있다 (파일 끝)
And 빈 청크는 EOF를 의미한다
And validate_path가 경로 탈출("..")을 거부한다 (SPEC-FS-001)
```

**자동화**: UT-B1-001 (단위 — IPC 래퍼) + CT-B1-001 (cargo — offset/len/EOF/validate_path)

#### AC-2-B2: UTF-8 멀티바이트 경계 안전 (REQ-B-002)

```gherkin
Given 파일에 4바이트 UTF-8 이모지 "🎯"(U+1F3AF, F0 9F 8E AF)가 포함되어 있다
And 이모지가 offset=1022에서 시작한다 (청크가 offset=1024에서 끝나면 시퀀스 중간 잘림)
When readFileChunk(path, 0, 1024)가 호출된다
Then 반환된 문자열은 offset=1022까지만 포함한다 (이모지 이전)
And 잘린 2바이트(F0 9F)는 다음 청크로 이월된다
And 반환 문자열은 항상 유효한 UTF-8이다 (String::from_utf8 검증 통과)
```

**자동화**: CT-B1-002 (cargo — 멀티바이트 경계 단언, 다양한 시퀀스 길이 2/3/4바이트)

#### AC-2-B3: truncated/malformed tail 무한 루프 금지 (REQ-B-003, D4)

```gherkin
Given trim_to_utf8_boundary 함수가 다음 입력을 받는다:
  - 잘린 4바이트 시퀀스의 마지막 2바이트
  - malformed continuation byte만 있는 버퍼
  - 빈 버퍼
  - ASCII-only 버퍼
When trim_to_utf8_boundary가 각 입력에 대해 호출된다
Then 모든 케이스에서 5초 이내에 종료한다 (무한 루프 없음)
And 반환값은 항상 buf.len() 이하이다 (유효한 인덱스)
```

**자동화**: CT-B1-003 (cargo — 타임아웃 5초 설정으로 무한 루프 검출, D4 인수 이행)

#### AC-2-B4: pull 기반 백프레셔 (REQ-B-004)

```gherkin
Given 20MB 파일을 스트리밍 로드 중이다
When 프런트엔드가 청크를 당겨오는(pull) 중이다
Then Rust 측이 프런트엔드 의사와 무관하게 다음 청크를 밀어넣지 않는다
And 프런트엔드가 readFileChunk 호출을 멈추면 스트리밍이 중단된다
```

**자동화**: 코드 리뷰 (diff — pull 모델 단정). 단위 테스트로 강제 불가한 아키텍처 속성.

#### AC-2-B5: 점진적 append dispatch (REQ-B-005)

```gherkin
Given 20MB 마크다운 파일이 SOFT_THRESHOLD(30MB) 이하이므로 스트리밍 로드 대상이다
When 사용자가 파일을 연다
Then 전체 content를 한 번에 dispatch하지 않고 청크 단위로 append dispatch한다
And 첫 청크 도착 후 즉시 에디터에 부분 렌더링된다
And 후속 청크가 도착하며 문서가 점진적으로 채워진다
And 오픈 순간에 메인 스레드가 동결하지 않는다 (단일 dispatch 회피)
```

**자동화**: UT-B1-005 (단위 — append dispatch 단언, 단일 dispatch 미호출 스파이) + PT-B1-005 (Playwright — 20MB 파일 오픈 후 점진적 렌더, 첫 paint 5초 이내)

#### AC-2-B6: 비-UTF-8 파일 우아한 저하 (REQ-B-006)

```gherkin
Given 파일이 유효한 UTF-8이 아니다 (바이너리·latin-1 등)
When readFileChunk가 청크를 읽는다
Then 시스템이 크래시하지 않는다
And 잘못된 바이트 시퀀스는 U+FFFD로 대체되거나(String::from_utf8_lossy) 또는 Result<String,String> 에러가 반환된다
And 001 Group B의 read_file 현행 동작(전체 거부 또는 동일한 U+FFFD)과 정합한다
```

**자동화**: CT-B1-006 (cargo — 비-UTF-8 입력 fixture, 크래시 없음 + U+FFFD/에러 단언)

### Axis C — markdown-it Web Worker (Milestone 4)

#### AC-2-C1: Worker 마크다운 렌더링 (REQ-C-001)

```gherkin
Given 에디터 content가 300ms 동안 안정化了되었다 (디바운스)
When usePreview가 프리뷰를 갱신한다
Then 마크다운 파싱이 Web Worker에서 수행된다
And 완성된 HTML(data-mdedit-svg 마커 포함)이 메인 스레드에 반환된다
And 파싱 중에도 메인 스레드가 에디터 입력에 응답한다
And embedPreviewImages는 메인 스레드에서 실행된다 (IPC-bound)
```

**자동화**: UT-C1-001 (단위 — Worker postMessage往返 모킹) + PT-C1-001 (Playwright — 대용량 마크다운 파싱 중 타이핑 응답 단언)

#### AC-2-C2: generation counter (REQ-C-002)

```gherkin
Given Worker가 content 버전 1 파싱 중이다 (generation=1, 10초 소요 예정)
When 사용자가 content를 추가 수정하여 generation=2가 된다
And Worker가 버전 1의 HTML을 반환한다
Then 메인 스레드는 generation 불일치로 버전 1 결과를 폐기한다
And 버전 2 파싱 완료 후 버전 2의 HTML만 setHtml에 반영된다
```

**자동화**: UT-C1-002 (단위 — generation 불일치 시 결과 폐기 단언)

#### AC-2-C3: Worker 크래시 폴백 (REQ-C-003)

```gherkin
Given 150MB 마크다운 파일이 Worker 파싱을 유발한다
When Worker가 파싱 도중 크래시한다 (onerror/onmessageerror 트리거)
Then 시스템이 동기 렌더(renderMarkdownSync)로 폴백한다
And 프리뷰가 빈 화면 없이 렌더링된다
And 사용자에게 에러가 표시되거나 동기 렌더 결과가 보인다
```

**자동화**: UT-C1-003 (단위 — onerror 핸들러 동기 폴백 호출 단언) + PT-C1-003 (Playwright — Worker 강제 크래시 시뮬레이션, 동기 렌더 결과 단언)

#### AC-2-C4: 파일 전환 시 in-flight 취소 (REQ-C-004)

```gherkin
Given 파일 A의 Worker 파싱이 진행 중이다 (generation=5)
When 사용자가 파일 B를 연다 (generation=6으로 증가)
Then 파일 A의 in-flight 파싱 결과는 폐기된다
And 파일 B의 파싱이 새로 시작된다
And 파일 A의 HTML이 파일 B 화면에 잘못 렌더링되지 않는다
```

**자동화**: UT-C1-004 (단위 — 파일 전환 시 generation 증가 + 이전 결과 폐기 단언)

#### AC-2-C5: Shiki Worker 소유 (REQ-C-005)

```gherkin
Given Worker가 코드 블록이 포함된 마크다운을 파싱 중이다
When highlight 콜백이 실행된다
Then Shiki codeToHtml가 Worker 내부에서 실행된다 (메인 스레드 아님)
And 메인 스레드의 Shiki 싱글턴은 usePreview/exportHtml/CodeFileViewer 소비자(fan_in >= 4)를 위해 그대로 유지된다
And 메인 스레드 소비자의 기존 동작에 회귀가 없다
```

**자동화**: 코드 리뷰 (highlight 콜백이 Worker 내부 단정) + 회귀 테스트 (usePreview/exportHtml/CodeFileViewer 기존 테스트 green 유지)

#### AC-2-C6: Worker 중복 파싱 직렬화 (REQ-C-006)

```gherkin
Given 300ms 디바운스 창 내에 사용자가 5회 content를 수정한다
When 디바운스가 만료된다
Then Worker에는 마지막 content(5회차)만 전달된다
And 중간 content(1~4회차)에 대한 파싱은 수행되지 않는다
And 동일 content에 대해 중복 파싱이 발생하지 않는다
```

**자동화**: UT-C1-006 (단위 — 디바운스 내 다중 수정 시 마지막 요청만 Worker 전달 단언)

#### AC-2-C7: Worker lifecycle (REQ-C-007)

```gherkin
Given 세션이 시작되었지만 아직 파일을 열지 않았다
Then Worker는 생성되지 않는다 (lazy)
When 사용자가 첫 파일을 열어 프리뷰가 렌더링된다
Then Worker가 처음으로 lazy 생성된다
When 사용자가 파일을 닫거나 세션을 종료한다
Then Worker가 정리(terminate)된다
And Worker 리소스가 누수되지 않는다
```

**자동화**: UT-C1-007 (단위 — lazy spawn 시점 + 파일 닫기 시 terminate 단언)

### Axis D — 임계값 정책 (Milestone 2)

#### AC-2-D1: SOFT_THRESHOLD 명명 상수 (REQ-D-001)

```gherkin
Given previewLimits.ts에 임계값 상수가 정의된다
When SOFT_THRESHOLD를 참조하면
Then 값은 30 * 1024 * 1024 (30MB)이다 (OD-1 확정값)
And 상수는 export되어 useFileSystem에서 사용 가능하다
```

**자동화**: UT-D1-001 (단위 — 상수 존재 + 값 단언)

#### AC-2-D2: HARD_CEILING 명명 상수 (REQ-D-002)

```gherkin
Given previewLimits.ts에 HARD_CEILING이 정의된다
When HARD_CEILING을 참조하면
Then 값은 100 * 1024 * 1024 (100MB)이다 (OD-1 확정값)
```

**자동화**: UT-D1-002 (단위)

#### AC-2-D3: LINE_FOLD_THRESHOLD 명명 상수 (REQ-D-003)

```gherkin
Given previewLimits.ts에 LINE_FOLD_THRESHOLD가 정의된다
When LINE_FOLD_THRESHOLD를 참조하면
Then 값은 1 * 1024 * 1024 (1MB)이다 (OD-1 확정값)
And REQ-A-003/D-006의 fold 트리거가 이 값을 사용한다
```

**자동화**: UT-D1-003 (단위)

#### AC-2-D4: SOFT 초과 — 점진적 로딩 + 폴딩 (REQ-D-004)

```gherkin
Given 20MB 마크다운 파일이 있다 (SOFT 30MB 이하, HARD 100MB 이하)
When 사용자가 파일을 연다
Then 에디터 잠금 placeholder가 표시되지 않는다
And 편집이 허용된다
And 라인 폴딩이 활성화된다 (거대 base64 라인 fold)
And 점진적 로딩이 활성화된다 (Axis B 머지 후)
And previewStatus는 'too-large'가 아닌 편집 가능 상태이다
```

**자동화**: UT-D1-004 (단위 — 20MB 파일 라우팅 분기 단언) + PT-D1-004 (Playwright — placeholder 미표시 + 편집 가능)

#### AC-2-D5: HARD 초과 — 로드 거부 (REQ-D-005)

```gherkin
Given 150MB 마크다운 파일이 있다 (HARD 100MB 초과)
When 사용자가 파일을 연다
Then UnsupportedFileViewer가 렌더링된다
And content가 ''로 세팅된다
And previewStatus가 'too-large'로 라우팅된다
And 에디터가 잠긴다 (001 Group B 동작과 정합)
```

**자동화**: UT-D1-005 (단위 — 150MB 파일 라우팅 단언, 001 Group B 정합)

#### AC-2-D6: per-line 임계값 초과 자동 폴딩 (REQ-D-006)

```gherkin
Given 문서에 1.5MB 단일 라인이 있다 (LINE_FOLD_THRESHOLD 1MB 초과)
When 문서가 로드되거나 편집될 때
Then 해당 라인이 자동 fold된다 (REQ-A-003과 결합)
And LINE_FOLD_THRESHOLD 상수가 fold 트리거 기준으로 사용된다
```

**자동화**: UT-D1-006 (단위 — 임계값 상수와 fold 트리거의 결합 단언, A-003과 정책 일치)

#### AC-2-D7: 래스터/SVG 크기 가드 제외 (REQ-D-007)

```gherkin
Given SOFT_THRESHOLD=30MB, HARD_CEILING=100MB로 설정되었다
When 50MB PNG 파일을 연다 (SOFT 초과)
Then PNG은 본 SPEC의 SOFT/HARD 임계값 변경에 영향받지 않는다
And SPEC-PREVIEW-008 현행 래스터 라우팅이 유지된다
And 마찬가지로 50MB SVG 파일도 현행 SVG 라우팅이 유지된다
```

**자동화**: UT-D1-007 (단위 — PREVIEW-008 회귀 가드. `.png`/`.jpg`/`.svg` 확장자가 SOFT/HARD 분기를 거치지 않음 단언)

### WIDGET-001 회귀 가드

#### AC-2-REG: WIDGET-001 REQ-1..7 보존

```gherkin
Given SPEC-IMG-WIDGET-001이 Completed 상태이다
When Axis A(뷰포트 한정 + 폴딩) 구현 후
Then WIDGET-001의 모든 REQ가 여전히 충족된다:
  - REQ-1: data URI 이미지 위젯 렌더링 유지
  - REQ-2: 위젯 시각 정보(썸네일/alt/MIME/size) 무변경
  - REQ-3: 기저 마크다운 소스 텍스트 보존 (Decoration.replace는 시각만)
  - REQ-4: data URI에만 적용 (file path/HTTP URL 미매칭 유지)
  - REQ-5: 위젯 클릭 시 커서가 소스 위치로 이동
  - REQ-6: 문서 변경 시 동적 갱신 (docChanged)
  - REQ-7: 다크/라이트 테마 적응
```

**자동화**: UT-REG-W1..W7 (단위 — WIDGET-001 인수 테스트를 `image-widget.regression.test.ts`에 복제/참조하여 Axis A 변경 후에도 green 유지. 뷰포트 한정이 visible 범위만 스캔하더라도, visible 범위 내 data URI는 여전히 매칭되어야 함)

## Edge Cases

| Edge Case | Expected Behavior | Test |
|---|---|---|
| 빈 문서에서 뷰포트 한정 | `buildDecorations`가 visible 범위 0개 → 데코레이션 0개 (회귀 없음) | UT-A1-001 확장 |
| 모든 data URI가 visible 범위 밖 | 데코레이션 0개 → 스크롤 시 갱신 | UT-A1-001 + UT-A1-002 |
| `LINE_FOLD_THRESHOLD` 경계값 (정확히 1MB) | fold 안 함 (`>` 비교) 또는 fold (`>=`) — OD-1에서 확정 | UT-A1-003 확장 |
| 사용자가 폴드된 라인을 수동으로 펼친 후 다시 자동 fold | 사용자 의사 존중 — 수동 펼침은 유지, 자동 fold는 새 라인에만 | UT-A1-003 확장 (설계 의사결정 — run phase) |
| 4바이트 UTF-8 이모지가 청크 경계에 걸침 | 이모지 이전까지 반환, 나머지 2바이트 이월 | CT-B1-002 |
| chunk가 모두 ASCII | 경계 처리 오버헤드 없음 — 전체 반환 | CT-B1-002 확장 |
| 빈 파일 `readFileChunk` | 첫 호출부터 빈 문자열 반환 (EOF) | CT-B1-001 확장 |
| offset이 파일 크기 초과 | 빈 문자열 반환 (에러 아님) | CT-B1-001 확장 |
| 비-UTF-8 파일의 청크 | U+FFFD 대체 또는 에러 (OD-1에서 확정) | CT-B1-006 |
| Worker 생성 실패(브라우저 정책) | 동기 렌더 폴백 (REQ-C-003과 동일 경로) | UT-C1-003 확장 |
| Worker 파싱 중 파일이 삭제됨 | in-flight 취소 (REQ-C-004), 에러 처리 | UT-C1-004 확장 |
| 사용자가 빠르게 파일 A→B→C 전환 | generation 증가로 A/B 결과 모두 폐기, C만 반영 | UT-C1-002 + UT-C1-004 |
| 동일 content에 대한 중복 Worker 요청 | 파싱 1회만 (REQ-C-006) | UT-C1-006 |
| SOFT 경계값 (정확히 30MB) | SOFT로 취급(`<=`) 또는 HARD 미만(`<`) — OD-1에서 확정 | UT-D1-004 확장 |
| HARD 경계값 (정확히 100MB) | HARD로 취급(`>=`) 또는 SOFT 이하(`<`) — OD-1에서 확정 | UT-D1-005 확장 |
| 4.99MB 파일 (SOFT 이하) | 기존 단일 `readFile` 경로 유지 (회귀 없음) | UT-D1-004 + 001 Group B 테스트 |
| 래스터 이미지 50MB (SOFT 초과) | 본 SPEC 임계값 미적용 — PREVIEW-008 라우팅 유지 | UT-D1-007 |
| base64 data URI가 아닌 거대 라인 (예: minified JS in code fence) | `LINE_FOLD_THRESHOLD` 초과 시 fold (data URI 여부 무관) | UT-A1-003 확장 |
| 폴딩과 atomicRanges 충돌 (위젯 라인 fold 시) | OD-A — RED 테스트로 고정. 위젯 라인은 fold 대상 제외 또는 특수 처리 | UT-A1-003 + UT-REG-W1..W7 |

## Quality Gate Criteria

- **단위 테스트**: `npx vitest run` — UT-A1-001/003/005, UT-D1-001~005/007, UT-B1-001/005, UT-C1-001~004/006/007, UT-REG-W1..W7 신규 통과 + 기존 전체 green 유지
- **Rust 테스트**: `cargo test` — CT-B1-001~003/006(D4 포함) 신규 통과 + 기존 `file_ops`/`image_ops`/`directory_ops` green 유지
- **Playwright**: `npx playwright test` — PT-A1-002/004/006, PT-B1-005, PT-C1-001/003, PT-D1-004 must-pass. 포인터(폴드 토글)·동결·점진적 렌더는 jsdom에 잡히지 않으므로 Playwright를 게이트로 ([feedback-jsdom-pointer-blindspot])
- **TypeScript**: `npx tsc --noEmit` — 0 에러
- **ESLint**: `npx eslint` 수정 파일 전부 — 0 에러, 0 경고
- **커버리지**: 수정된 프런트엔드 파일 85%+ 유지 (`quality.yaml test_coverage_target: 85`). Rust 파일 커버리지는 기존 기준 유지
- **회귀**: 
  - `SPEC-IMG-LOAD-001`(Group A+B) 테스트 green 유지 (호출부 모드 분기·라우팅·원자 쓰기·접힌 폴더 보호)
  - `SPEC-IMG-WIDGET-001`(REQ-1..7) — UT-REG-W1..W7 회귀 가드
  - `SPEC-PREVIEW-007`(too-large 라우팅) — `FILE_SIZE_THRESHOLD` deprecated alias 유지 (OD-2)
  - `SPEC-PREVIEW-008`(래스터/SVG 확장자 분기) — UT-D1-007 회귀 가드
  - `SPEC-FS-001`(`read_file`/`write_file`/`validate_path`) — 소형 파일 경로·경로 검증 유지
  - `SPEC-FS-003`(와쳐 충돌 모달·dirty-state guard) — 스트리밍 로드도 dirty 가드 존중
  - `SPEC-PREVIEW-001/003/005/012`(마크다운 렌더·KaTeX·Shiki·표) — Worker 이관 후 렌더 품질 무변경
  - Shiki 싱글턴 소비자(usePreview/exportHtml/CodeFileViewer, fan_in >= 4) — Worker 자체 인스턴스 도입 후에도 기존 동작 유지
- **수동 스모크**: 
  - AC-2-A6 (4MB 파일 오픈 후 편집 응답) 실기기 확인
  - AC-2-C3 (Worker 크래시 폴백) 실기기 확인 — 150MB fixture로 Worker 강제 크래시 유도
  - AC-2-B5 (점진적 렌더) 실기기 확인 — 20MB 파일 오픈 시 첫 paint→점진적 채움 관찰

## Test Strategy Layer (정직한 범위 표시)

> [feedback-spec-verifiable-requirements] 패턴 3 반영 — 자동 검증 범위와 리뷰 범위를 분리하여 명시.

| 검증 항목 | 자동화된 단위/통합 테스트 | Playwright (E2E) | 코드 리뷰 (diff) | 수동 스모크 |
|---|---|---|---|---|
| REQ-A-001 (위젯 뷰포트 한정) | UT-A1-001 | — | `toString` 미호출 단언은 단위 가능 | — |
| REQ-A-002 (viewportChanged 갱신) | UT-A1-002 | PT-A1-002 | — | — |
| REQ-A-003 (거대 라인 자동 fold) | UT-A1-003 | — | — | — |
| REQ-A-004 (fold 토글 클릭) | — | PT-A1-004 (must-pass) | — | — |
| REQ-A-005 (삽입 시 fold 힌트) | UT-A1-005 | — | — | — |
| REQ-A-006 (대용량 편집 동결 없음) | — | PT-A1-006 (must-pass) | — | AC-2-A6 (실기기) |
| REQ-B-001 (chunked IPC) | UT-B1-001 + CT-B1-001 | — | — | — |
| REQ-B-002 (UTF-8 경계) | CT-B1-002 (cargo) | — | — | — |
| REQ-B-003 (무한 루프 금지, D4) | CT-B1-003 (cargo) | — | — | — |
| REQ-B-004 (pull 백프레셔) | — | — | O (pull 모델 단정) | — |
| REQ-B-005 (점진적 append dispatch) | UT-B1-005 | PT-B1-005 | — | AC-2-B5 (실기기) |
| REQ-B-006 (비-UTF-8 저하) | CT-B1-006 (cargo) | — | — | — |
| REQ-C-001 (Worker 렌더링) | UT-C1-001 | PT-C1-001 | — | — |
| REQ-C-002 (generation counter) | UT-C1-002 | — | — | — |
| REQ-C-003 (Worker 크래시 폴백) | UT-C1-003 | PT-C1-003 | — | AC-2-C3 (실기기, 150MB) |
| REQ-C-004 (파일 전환 취소) | UT-C1-004 | — | — | — |
| REQ-C-005 (Shiki Worker 소유) | Shiki 소비자 회귀 | — | O (highlight 콜백 위치) | — |
| REQ-C-006 (중복 파싱 직렬화) | UT-C1-006 | — | — | — |
| REQ-C-007 (lazy spawn + 정리) | UT-C1-007 | — | — | — |
| REQ-D-001~003 (임계값 상수) | UT-D1-001~003 | — | — | — |
| REQ-D-004 (SOFT 초과 편집 허용) | UT-D1-004 | PT-D1-004 | — | — |
| REQ-D-005 (HARD 초과 거부) | UT-D1-005 | — | — | — |
| REQ-D-006 (per-line fold 결합) | UT-D1-006 | — | — | — |
| REQ-D-007 (래스터/SVG 제외) | UT-D1-007 | — | — | — |
| WIDGET-001 REQ-1..7 회귀 | UT-REG-W1..W7 | — | — | — |
| `FILE_SIZE_THRESHOLD` alias 유지 (OD-2) | 기존 SPEC-PREVIEW-007 테스트 | — | O (consumer 전환) | — |
| `insertImageFromDialog` 시그니처 유지 | — | — | O (`imageHandler.ts` 무변경) | — |
| `inline-blob` 기본 모드 유지 (Non-Goal #2) | — | — | O (`uiStore.ts` 무변경) | — |
| 래스터/SVG `asset://` 스트리밍 무변경 (Non-Goal #7) | UT-D1-007 + 기존 PREVIEW-008 | — | — | — |

**참고**: "pull 백프레셔"(REQ-B-004), "Shiki Worker 소유"(REQ-C-005)는 단위 테스트로 강제 불가한 아키텍처 속성이다. 이들을 단위 테스트로 단언하면 baseline hash가 없는 vitest/cargo에서 아무것도 증명하지 못한다 ([feedback-spec-verifiable-requirements] 패턴 2). 행동 결과(메인 스레드 응답성·파싱 비용 이동)는 Playwright/성능 테스트로 관측하고, 아키텍처 자체는 리뷰 범위로 둔다.

## Definition of Done

- [ ] **OD 해소 (run phase 개시 전)**: OD-1(임계값·상수값), OD-2(`FILE_SIZE_THRESHOLD` alias), OD-3(chunked vs Channel), OD-A(폴딩 전략), OD-B(Shiki 소유권), OD-C(Worker spawn 시점)가 사용자에 의해 명시적으로 확정됨
- [ ] **RED (Axis A)**: UT-A1-001/003/005, PT-A1-006 신규 추가, 현재 구현에서 실패 확인
- [ ] **WIDGET-001 회귀 가드 baseline (Axis A 사전)**: UT-REG-W1..W7을 먼저 작성하여 green 확인 (Axis A 구현 전 WIDGET-001 동작 고정)
- [ ] **GREEN (Axis A)**: `image-widget.ts`(뷰포트 한정), `markdown-extensions.ts`(폴딩), `imageHandler.ts`(삽입 힌트), `previewLimits.ts`(`LINE_FOLD_THRESHOLD`) 구현, UT-A1-001/003/005 통과, UT-REG-W1..W7 green 유지
- [ ] **Playwright (Axis A)**: PT-A1-002/004/006 통과 (특히 PT-A1-006 — 4MB 파일 오픈 후 5초 이내 입력 응답)
- [ ] **RED (Axis D)**: UT-D1-001~005/007 신규 추가, 실패 확인
- [ ] **GREEN (Axis D)**: `previewLimits.ts`(SOFT/HARD/LINE_FOLD + alias), `useFileSystem.ts`(분기), `AppLayout.tsx`(HARD 전용 잠금) 구현, UT-D1-001~007 통과
- [ ] **A+D 릴리즈 게이트**: 이 시점에서 사용자가 대용량 파일(5~30MB)을 열고 편집할 수 있음을 PT-A1-006 + PT-D1-004로 확인
- [ ] **RED (Axis B)**: CT-B1-001~003/006, UT-B1-001/005, PT-B1-005 신규 추가, 실패 확인
- [ ] **GREEN (Axis B)**: `file_ops.rs`(`read_file_chunk` + `trim_to_utf8_boundary`), `ipc.ts`(`readFileChunk`), `MarkdownEditor.tsx`(append dispatch), `useFileSystem.ts`(스트리밍 라우팅) 구현, CT/UT/PT 통과
- [ ] **cargo (Axis B, D4)**: CT-B1-003(truncated/malformed tail 유한 종료) 반드시 통과 — 001 v1.1.0 D4 잔여 인수
- [ ] **RED (Axis C)**: UT-C1-001~004/006/007, PT-C1-001/003 신규 추가, 실패 확인
- [ ] **GREEN (Axis C)**: `renderWorker.ts`(신규), `renderer.ts`(폴백 동기 경로), `codeHighlight.ts`(Worker용 Shiki), `usePreview.ts`(generation + onerror) 구현, UT/PT 통과
- [ ] **REFACTOR**: 전체 `npx vitest run`, `cargo test`, `npx tsc --noEmit`, `npx eslint`, `npx playwright test` 통과
- [ ] **수동 스모크**: AC-2-A6(4MB 편집 응답), AC-2-B5(점진적 렌더), AC-2-C3(Worker 크래시 폴백, 150MB) 실기기 확인
- [ ] **회귀**: `SPEC-IMG-LOAD-001`(Group A+B), `SPEC-IMG-WIDGET-001`(REQ-1..7), `SPEC-PREVIEW-007/008`, `SPEC-FS-001/003`, `SPEC-PREVIEW-001/003/005/012`, Shiki 소비자(usePreview/exportHtml/CodeFileViewer) 기존 테스트 green 유지
- [ ] **@MX 갱신**: 수정된 파일 `image-widget.ts`, `markdown-extensions.ts`, `imageHandler.ts`, `previewLimits.ts`, `useFileSystem.ts`, `AppLayout.tsx`, `file_ops.rs`, `ipc.ts`, `MarkdownEditor.tsx`, `renderer.ts`, `codeHighlight.ts`, `usePreview.ts`, 신규 `renderWorker.ts`의 `@MX:SPEC` 주석에 `SPEC-IMG-LOAD-002` 추가
- [ ] **@MX 유지**: `imageHandler.ts`의 `insertImageFromDialog` 시그니처 영역, `image_ops.rs`(`MAX_IMAGE_SIZE`), `PreviewRenderer.tsx`(DOMPurify/mermaid)의 기존 `@MX:SPEC` 주석은 유지 (해당 파일은 본 SPEC에서 무변경 또는 최소 변경)

## Traceability

| AC | REQ | UT/CT | Playwright | Layer |
|----|-----|----|----|----|
| AC-2-A1 | REQ-A-001 | UT-A1-001 | — | Unit |
| AC-2-A2 | REQ-A-002 | UT-A1-002 | PT-A1-002 | Unit + Playwright |
| AC-2-A3 | REQ-A-003 | UT-A1-003 | — | Unit |
| AC-2-A4 | REQ-A-004 | — | PT-A1-004 | Playwright must-pass |
| AC-2-A5 | REQ-A-005 | UT-A1-005 | — | Unit |
| AC-2-A6 | REQ-A-006 | — | PT-A1-006 | Playwright must-pass + Smoke |
| AC-2-B1 | REQ-B-001 | UT-B1-001 + CT-B1-001 | — | Unit + cargo |
| AC-2-B2 | REQ-B-002 | CT-B1-002 | — | cargo |
| AC-2-B3 | REQ-B-003 | CT-B1-003 | — | cargo (D4) |
| AC-2-B4 | REQ-B-004 | — | — | Review (pull 모델) |
| AC-2-B5 | REQ-B-005 | UT-B1-005 | PT-B1-005 | Unit + Playwright + Smoke |
| AC-2-B6 | REQ-B-006 | CT-B1-006 | — | cargo |
| AC-2-C1 | REQ-C-001 | UT-C1-001 | PT-C1-001 | Unit + Playwright |
| AC-2-C2 | REQ-C-002 | UT-C1-002 | — | Unit |
| AC-2-C3 | REQ-C-003 | UT-C1-003 | PT-C1-003 | Unit + Playwright + Smoke |
| AC-2-C4 | REQ-C-004 | UT-C1-004 | — | Unit |
| AC-2-C5 | REQ-C-005 | 회귀 (Shiki 소비자) | — | Review + 회귀 |
| AC-2-C6 | REQ-C-006 | UT-C1-006 | — | Unit |
| AC-2-C7 | REQ-C-007 | UT-C1-007 | — | Unit |
| AC-2-D1 | REQ-D-001 | UT-D1-001 | — | Unit |
| AC-2-D2 | REQ-D-002 | UT-D1-002 | — | Unit |
| AC-2-D3 | REQ-D-003 | UT-D1-003 | — | Unit |
| AC-2-D4 | REQ-D-004 | UT-D1-004 | PT-D1-004 | Unit + Playwright |
| AC-2-D5 | REQ-D-005 | UT-D1-005 | — | Unit |
| AC-2-D6 | REQ-D-006 | UT-D1-006 | — | Unit |
| AC-2-D7 | REQ-D-007 | UT-D1-007 | — | Unit (PREVIEW-008 회귀 가드) |
| AC-2-REG | WIDGET-001 REQ-1..7 | UT-REG-W1..W7 | — | Unit (회귀 가드) |
