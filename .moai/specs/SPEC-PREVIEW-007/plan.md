# SPEC-PREVIEW-007 — 구현 계획

> 파일 탐색기 allowlist 필터를 제거해 전체 파일을 노출하고, 비-렌더 파일을 graceful 처리한다. 기존 프리뷰 라우팅 단일 진입점(`PreviewContainer`/`getFileViewType`)을 확장하고, 마크다운(SPEC-PREVIEW-001/002/003)·`.html`(004)·코드 뷰어(005) 동작은 회귀 없이 유지한다. 신규 npm 의존성 0.

## 기술 접근

- **필터 제거(빼기)**: `FileExplorer.tsx`의 `visibleTree`에서 `filterMdOnly`(=`filterViewableFiles`)를 빼고 `filterTree`(검색)만 남긴다. allowlist 함수·관련 import·테스트를 정리한다. 핵심은 "추가"가 아니라 "제거"다.
- **라우팅 진입점 확장**: `getFileViewType`에 `'text'`·`'unsupported'`를 추가한다. 단, 바이너리·대용량은 **경로만으로 판정 불가** → 라우팅이 "열 때 판정한 프리뷰 상태"를 함께 봐야 한다(아래 결정 1).
- **열 때 분류**: `openFile`이 파일을 (a) html, (b) too-large(size 가드), (c) text(read 성공), (d) binary(read reject) 중 하나로 분류하고, 그 결과를 store에 set한다. 편집기 로드 여부와 프리뷰 라우팅이 모두 이 분류를 따른다.
- **재사용 우선**: 평문은 `CodeFileViewer lang='text'` 재사용, 플레이스홀더는 `AppLayout`의 editor-disable 패턴 시각 재사용. 신규 컴포넌트는 `UnsupportedFileViewer` 하나뿐.

## 설계 결정

### 결정 1 — 프리뷰 상태 배선 방식 (run에서 확정, 후보 제시)

`getFileViewType(path)`는 현재 **순수 함수**(경로만 입력)다. 그러나 바이너리·대용량은 파일을 읽어봐야 안다. 따라서 라우팅이 "열 때 판정한 상태"를 참조해야 한다. 두 후보:

- **후보 A (권장) — store에 `previewStatus` 추가**: `openFile`이 `'text' | 'binary' | 'too-large' | 'html' | null`을 판정해 `fileStore`(또는 신규 슬라이스)에 set. `PreviewContainer`가 `currentFile`과 `previewStatus`를 함께 구독해 라우팅. `getFileViewType`은 `(path, previewStatus)` 시그니처로 확장하거나, 컴포넌트에서 상태 우선 분기 후 경로 기반 `getFileViewType`를 폴백으로 호출.
  - 장점: 단일 진실 공급원, `AppLayout` editor-disable 판정도 같은 상태를 재사용. 테스트 시 상태 주입이 쉽다.
  - 단점: store 필드 1개 추가.
- **후보 B — 컴포넌트 로컬 상태/프롭 전달**: `previewStatus`를 store가 아닌 상위 컴포넌트 state로 두고 prop으로 내림.
  - 단점: `AppLayout`(편집기)과 `PreviewContainer`(프리뷰)가 동일 상태를 각자 봐야 해 prop drilling 또는 중복 판정 발생. 비권장.

→ **run에서 후보 A로 확정 권장.** `getFileViewType` 순수 함수성은 "경로 기반 기본 분류"로 유지하고, 상태 기반 override를 컴포넌트 레이어에서 적용하는 형태가 테스트·회귀 안전 측면에서 가장 단순.

### 결정 2 — 대용량 임계값 (run에서 확정)

- **제안값: 5MB(5 * 1024 * 1024 바이트)**. `FileNode.size`로 `openFile` 진입 시 비교 → 초과면 read 회피하고 too-large 처리.
- 근거: 마크다운/텍스트 편집 대상 파일은 통상 수십~수백 KB. 5MB는 CodeMirror·Shiki·마크다운 렌더가 메인스레드를 길게 잡는 영역의 보수적 하한. 실제 임계값은 run에서 대표 파일로 체감 확인 후 확정한다.
- 상수는 한 곳(예: `src/lib/preview/previewLimits.ts` 또는 분류 헬퍼)에 두어 테스트·조정이 쉽게 한다.

### 결정 3 — Rust 바이너리 판정 필요 여부 (run에서 확정, 최소 변경 우선)

- **기본안(권장) — 프론트엔드 reject 캐치만**: `read_file`은 이미 비-UTF-8을 reject한다(`read_to_string`). `openFile`이 `try/catch`로 이 reject를 잡아 binary로 분류하면 **Rust 무변경**으로 목표 달성. 최소 변경 원칙에 부합.
  - 한계: reject 사유가 "바이너리"인지 "권한/I/O 오류"인지 메시지로만 구분된다. 본 SPEC은 둘 다 "미리보기 불가"로 처리하므로(REQ-007-006) 사유 세분화가 불필요 → 기본안으로 충분.
- **대안 — Rust에서 타입 결과 반환**: `read_file`이 `enum { Text(String), Binary }` 또는 null-byte 스니프로 바이너리를 명시 판정. 사유를 정확히 구분하고 싶을 때만 채택.
  - run 판단 기준: 플레이스홀더에 "바이너리"와 "읽기 오류"를 다르게 보여줘야 하면 대안, 아니면 기본안. **현재 수용 기준은 기본안으로 모두 충족된다.**

### 결정 4 — `'text'` 뷰 구현 (CodeFileViewer 재사용)

- `CodeFileViewer`는 SPEC-PREVIEW-005에서 임의 `lang`을 수용하고 미로드 언어는 plaintext 폴백한다. `lang='text'`를 넘기면 구문 강조 없이 평문 표시가 된다. **신규 텍스트 뷰어 컴포넌트를 만들지 않는다.**
- 편집기는 평소처럼 `readFile`→`setContent`로 내용을 싣는다(REQ-007-003: 편집 가능).

## 위험 분석

| 위험 | 심각도 | 대비책 | 검증 |
|------|--------|--------|------|
| `getFileViewType` 순수 함수에 상태 의존 도입 시 라우팅 회귀 | 높음 | 결정 1 후보 A — 경로 기반 기본 분류 유지 + 컴포넌트 레이어 상태 override. 순수 함수 시그니처 변경 최소화 | 시나리오 A·G (라우팅/회귀) |
| `read_file` reject 미처리로 클릭 깨짐(현 버그) | 높음 | `openFile`에 try/catch 추가, 모든 reject를 unsupported로 흡수 | 시나리오 D·F (바이너리/읽기 실패) |
| 대용량 파일 read로 메인스레드 블로킹 | 중간 | `FileNode.size` 가드로 read 자체 회피(결정 2) | 시나리오 E (건너뜀) |
| 전체 파일 노출로 트리 노드 급증 → 렌더 성능 | 중간 | 본 SPEC 비범위(Exclusions). `filterTree`는 유지되어 검색 시 축소 가능. 가상화는 후속 | 리스크 기록만 |
| allowlist 제거 시 `getLangForExtension` import·테스트 잔존으로 빌드/lint 실패 | 낮음 | 필터 제거와 동시에 미사용 import·테스트 정리 | 타입체크 + lint 통과 |
| editor-disable 판정 확장 시 `.html` 동작 회귀 | 중간 | `isHtmlFile` → `isViewOnly`로 확장하되 `.html` 분기 결과는 보존 | 시나리오 G (`.html` 무변경) |

## 작업 분해 (Run 단계 순서)

> development_mode = tdd. 각 단계는 RED(실패 테스트) → GREEN(최소 구현) → REFACTOR. 순서: 분류 헬퍼·상태 → openFile 분류 → 라우팅/뷰어 → 필터 제거 → editor-disable 확장.

### Phase 1 — 프리뷰 상태 + 분류 헬퍼 (선행)

- **Task 1.1** 대용량 임계값 상수 + 분류 헬퍼 모듈(예: `src/lib/preview/previewLimits.ts` 또는 `classifyFile`). 순수 로직(size 비교, 사유 분류)을 분리.
- **Task 1.2** `fileStore`에 `previewStatus` 필드 + setter 추가(결정 1 후보 A).
- **Task 1.3** (RED) 분류 헬퍼 단위 테스트 — size 경계값, 사유 매핑.

### Phase 2 — openFile 파일 분류 로직

- **Task 2.1** `useFileSystem.openFile` 확장: `.html` 기존 경로 유지 → `FileNode.size > 임계값`이면 too-large(read 회피) → `readFile` try → 성공 text(편집기 로드) / reject binary(편집기 미로드). 각 분기에서 `previewStatus` set.
- **Task 2.2** (RED→GREEN) `useFileSystem` 테스트 — text/binary/too-large/html 4분류, reject 캐치, 편집기 로드 여부.

### Phase 3 — 라우팅 + UnsupportedFileViewer

- **Task 3.1** `getFileViewType` 반환 타입에 `'text'`·`'unsupported'` 추가 + 상태 기반 분기(결정 1). `PreviewContainer`에 `'text'`(`CodeFileViewer lang='text'`)·`'unsupported'`(`UnsupportedFileViewer`) 렌더 분기 추가.
- **Task 3.2** `UnsupportedFileViewer.tsx` 신규 — props(사유, 파일명) → 안내 문구. editor-disable 패턴 시각 재사용.
- **Task 3.3** (RED→GREEN) `PreviewContainer` 테스트 보강 — text/unsupported 라우팅, `.md`/`.html`/code 회귀.

### Phase 4 — 파일 탐색기 필터 제거

- **Task 4.1** `FileExplorer.tsx` `visibleTree`에서 `filterMdOnly` 제거 → `filterTree(fileTree, searchQuery)`. `filterViewableFiles`/`filterMdOnly`/미사용 `getLangForExtension` import 정리.
- **Task 4.2** (RED→GREEN) 기존 allowlist 테스트를 "전체 노출(dotfile·확장자 없음 포함)" 검증으로 전환. 검색 필터 회귀 테스트 유지.

### Phase 5 — editor-disable 확장

- **Task 5.1** `AppLayout.tsx`의 `isHtmlFile` → `isViewOnly`(html OR binary OR too-large). 해당 시 편집기 대신 보기 전용 플레이스홀더 유지. `.html` 결과 보존.
- **Task 5.2** (RED→GREEN) `AppLayout` 테스트 — binary/too-large 선택 시 편집기 미표시, `.html` 무회귀.

### Phase 6 — (선택) Rust 바이너리 판정 + MX 태그

- **Task 6.1** (조건부, 결정 3) 기본안 채택 시 Rust 무변경. 대안 채택 시에만 `read_file` 타입 결과/스니프 추가.
- **Task 6.2** MX 태그(아래 계획).

### MX 태그 계획

- `getFileViewType` (`PreviewContainer.tsx`): 기존 `@MX:ANCHOR` 갱신 — 반환 타입에 `'text'`·`'unsupported'` 추가, `@MX:SPEC: SPEC-PREVIEW-007 REQ-PREVIEW007-007` 추가. fan_in 유지 → ANCHOR 유지. `@MX:REASON` 갱신(상태 의존 라우팅 주의).
- `openFile` (`useFileSystem.ts`): 기존 `@MX:NOTE` 갱신 — html/text/binary/too-large 4분류 + reject 캐치 의도. `@MX:SPEC: SPEC-PREVIEW-007 REQ-PREVIEW007-003/004/005/006`.
- `UnsupportedFileViewer` (신규): `@MX:NOTE` — 보기 전용 플레이스홀더, 사유(binary/too-large) 분기. `@MX:SPEC: SPEC-PREVIEW-007 REQ-PREVIEW007-004/005`.
- `previewStatus` 슬라이스(`fileStore.ts`): `@MX:NOTE` — openFile이 set, 라우팅·editor-disable가 read하는 단일 진실 공급원.
- `read_file` (`file_ops.rs`): 기본안 채택 시 무변경(기존 `@MX:NOTE` 유지). 대안 채택 시 `@MX:SPEC` 갱신.
- 코드 주석 언어: `language.yaml`의 `code_comments: ko` 준수.

## 마일스톤 (우선순위 기반, 시간 추정 없음)

- **M1 (Priority High)**: Phase 1 — 상태·분류 헬퍼 + 단위 테스트.
- **M2 (Priority High)**: Phase 2 — `openFile` 4분류 + reject 캐치(클릭 깨짐 버그 차단).
- **M3 (Priority High)**: Phase 3 — 라우팅 확장 + `UnsupportedFileViewer`.
- **M4 (Priority Medium)**: Phase 4 — 탐색기 필터 제거 + 테스트 전환.
- **M5 (Priority Medium)**: Phase 5 — editor-disable 확장.
- **M6 (Priority Low)**: Phase 6 — (선택) Rust 판정 + MX 태그.

순서 제약: M1(상태) → M2(openFile) → M3(라우팅). M4(필터 제거)는 M3 완료 후 활성화 권장(필터 제거 즉시 모든 파일이 클릭 가능해지므로 graceful 처리가 먼저 준비돼야 함).

## Definition of Done

- spec.md의 7개 EARS 요구 모듈이 모두 구현·검증됨.
- acceptance.md의 모든 Given/When/Then 시나리오 통과 — 특히 클릭 안정성(D·F)과 회귀(G)가 must-pass.
- 프런트엔드 타입체크 및 vitest 테스트 통과(development_mode = tdd, RED 우선).
- 신규 npm 의존성 0 확인 (`package.json` diff 없음).
- (Rust 변경 시) `cargo clippy` + `cargo test` 통과.
- MX 태그 계획에 따라 `@MX:ANCHOR`/`@MX:NOTE` 갱신 + `@MX:REASON`/`@MX:SPEC` 포함.

## 미해결 사항 (run 단계 확정 필요)

- **(a) previewStatus 상태 배선 방식** — 결정 1: store 필드(후보 A, 권장) vs 컴포넌트 prop(후보 B). `getFileViewType` 순수 함수성 유지 방식 포함하여 run에서 확정.
- **(b) 대용량 임계값** — 결정 2: 제안 5MB. 대표 파일 체감 확인 후 run에서 최종 확정.
- **(c) Rust 바이너리 판정 필요 여부** — 결정 3: 기본안(프론트엔드 reject 캐치, Rust 무변경, 권장) vs 대안(Rust 타입 결과/null-byte 스니프). 사유 세분화 필요 여부로 run에서 판단.
