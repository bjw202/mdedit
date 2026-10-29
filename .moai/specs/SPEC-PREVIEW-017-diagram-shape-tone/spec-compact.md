# SPEC-PREVIEW-017 compact — 자동 생성 요약 (plan/run 컨텍스트 주입용)

> 전문은 `spec.md` / `plan.md` / `acceptance.md` / `research.md`. v0.1.1(plan-audit review-1 반영). REQ 8건·AC 8건 1:1. 앵커는 워크트리 HEAD 4bef707(v0.18.0 + .gitattributes) 기준. 워크트리에 node_modules 없음 — run은 `npm ci`부터.

## 요구

- REQ-PREVIEW017-001 (Ubiquitous): `pele-shape-diam` 채움 `--pele-surface-alt` `#F7F2E7`, 테두리 `--pele-decision-border`.
- REQ-PREVIEW017-002 (Ubiquitous): `pele-shape-stadium` 채움 그대로(`#EEF3F7`), 테두리 `--pele-accent` `#3A5673`, 두께 `1.5px`. rect·cyl·circle·클러스터 무변경. 이 SPEC이 더하는 톤은 2종(기본 포함 3종) — 작성자 색·계열 색은 세지 않음.
- REQ-PREVIEW017-003 (Unwanted): 작성자 `classDef`·`class`·`style` 속성 덮어쓰기 금지, 지정 안 한 속성만 톤, 미리보기 CSS·내보내기 주입 모두 `!important` 금지.
- REQ-PREVIEW017-004 (Unwanted): 라벨 문구·노드 순서 기반 착색 금지 — 입력은 모양 클래스뿐.
- REQ-PREVIEW017-005 (Ubiquitous): 새 토큰 `--pele-decision-border`를 016 `:root` 블록에 리터럴 1회(다크 재선언 없음). `#F7F2E7` 대비 ≥3:1, HSL hue 41.9°±5°(36.9°~46.9°), 값 ≠ `#B78511`·`#96562F`·`#C08A28`(후보 `#8A6410` 4.81:1·41.3°). 글꼴 계약 유지.
- REQ-PREVIEW017-006 (Ubiquitous): HTML·PDF·DOCX에 같은 톤 리터럴, `var(--pele-` 0건, 작성자 색 보존, 탐침 목록 ⊇ `:root` 모든 `--pele-*` 이름, 주입 대체 리터럴 = 토큰 값.
- REQ-PREVIEW017-007 (Ubiquitous): 라이트·다크 같은 톤, 테마는 입력 아님.
- REQ-PREVIEW017-008 (Ubiquitous + State + Event): 라벨 바탕 = 놓인 표면(두 테마). While 라이트: 미리보기 컨테이너 바탕 `--pele-bg`(`#FAF9F6`), 테두리·반경 없음(해법 (a), 사용자 결정 2026-10-29). When run 시작: 수정 전 측정·기록. 내보내기 바탕 상수 `#FAF9F6` 유지.

## 수용 기준

| AC | REQ | 요지 (검증 기법) |
|----|-----|------------------|
| AC-001 | 001 | e2e 계산 스타일 — 판단 fill `rgb(247, 242, 231)`, stroke 리터럴 rgb(후보 `rgb(138, 100, 16)`) |
| AC-002 | 002 | e2e — stadium stroke `rgb(58, 86, 115)`·`1.5px`, rect·cyl·circle 기본값, 클러스터 기준값 동일 |
| AC-003 | 003 | e2e + unit + grep — 작성자 값 우선, 채움만 지정 시 테두리만 톤, 내보내기 인라인 보존, `shape-tone BEGIN/END` 블록·`exportUtils.ts` `!important` 0 |
| AC-004 | 004 | e2e + grep — 라벨·위치 달라도 같은 톤, 톤 블록에 `nth-`/`data-id`/`:has(` 0 |
| AC-005 | 005 | unit — pele 선언 24개(다크 0), 새 토큰 1회 리터럴, 대비 ≥3.0, hue 36.9°~46.9°, 금지 3색 아님, `:root` 이름 집합 = `PELE_THEME_VARS` |
| AC-006 | 006 | unit — HTML·PDF·DOCX 톤 리터럴, `var(--pele-` 0, 작성자 색 보존, 빈 표 경로 대체 리터럴 = CSS 토큰 값, `VAR_NAMES` 24개 |
| AC-007 | 007 | e2e + unit — 라이트·다크 계산값·내보내기 문자열 동일, 재렌더 금지 가드 통과 |
| AC-008 | 008 | evidence + unit + e2e — 수정 전 측정 기록, 라이트 컨테이너 `rgb(250, 249, 246)`·테두리/반경 `0px`, 두 테마 라벨 fill = 컨테이너 바탕, 다크 카드·내보내기 단정 유지 |

## 핵심 결정

- 미리보기 기제: 노드 `g`에서 사적 변수 `--_s`/`--_b` 재선언(작성자 인라인 style이 자연히 이김). 규칙은 `/* SPEC-PREVIEW-017 shape-tone BEGIN/END */` 표지 안.
- 내보내기: `renderExportDiagram`에서 `resolveDiagramColors` 전에 노드 `g`에 인라인 사용자 정의 속성 주입 → 기존 치환이 리터럴화.
- `circle`은 시작/끝에서 제외(pele 별칭: `stadium` = `terminal`, 시작·끝 별칭은 상태도용 `sm-circ`·`fr-circ`).
- 라벨 이음매: 해법 (a) 확정 — 016 REQ-005 배경 부분 개정.

## 변경 파일

- M1: `src/styles/mdedit-tokens.css`, `src/index.css`, [NEW] `e2e/diagram-shape-tone.spec.ts`
- M2: `src/lib/diagram/diagramRenderer.ts`(`PELE_THEME_VARS` 23→24), `src/lib/export/exportUtils.ts`, `src/test/exportDiagram.test.ts`(`VAR_NAMES` 23→24, :288 가드)
- M3: `src/index.css`(라이트 컨테이너 바탕), `e2e/diagram-shape-tone.spec.ts`
- M4: `src/test/diagramRenderer.test.ts`(23→24, hue·대비·동기화 가드), [MODIFY-DOC] 016 `spec.md`·`acceptance.md`·`spec-compact.md`
- 무변경 예상(회귀 감시): `src/test/export.test.ts`, `e2e/diagram-preview-behavior.spec.ts`, `e2e/diagram-export-colors.spec.ts`, `src/lib/export/exportHtml.ts`, `src/lib/export/exportDocx.ts`

## Exclusions

- rect·cyl·circle·클러스터 톤, 데이터·클러스터 착색 없음.
- 문구·순서 기반 착색 없음.
- pele 버전·옵션·새니타이저, `--md-*` 토큰, 톤 설정 화면 무변경.
- 라이트 컨테이너 테두리·반경 없음.
