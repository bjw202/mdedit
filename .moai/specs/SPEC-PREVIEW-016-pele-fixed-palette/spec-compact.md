# SPEC-PREVIEW-016 compact — 자동 생성 요약 (plan/run 컨텍스트 주입용)

> 전문은 `spec.md` / `plan.md` / `acceptance.md`. REQ 9건·AC 9건 1:1. 앵커는 origin/main 39c39e9(v0.17.0, pele 1.10.0) 기준 — 로컬 트리는 v0.16.1(pre-pele)이므로 run은 origin/main 기반 브랜치에서.

## 요구 모듈 A — 토큰 선언

- REQ-PREVIEW016-001 (Ubiquitous): 모든 `--pele-*`는 `mdedit-tokens.css` `:root`에 리터럴로 정확히 한 번 선언(`var(--md-…)` 체이닝 금지); 다크 블록 내 pele 선언 삭제(현 162-185행, 186행 닫는 중괄호 보존).
- REQ-PREVIEW016-002 (Ubiquitous): 색 값은 잉크 앤 허니 표만 따른다 — bg `#FAF9F6`, fg `#222B33`, muted `#67727C`, line `#3A5673`, surface `#EEF3F7`, surface-alt `#F7F2E7`, border `#97A4B1`, accent `#3A5673`(=line), error/critical `#AC3E31`, series-1..8 `#3168A8` `#C95F3B` `#23997C` `#B78511` `#C76A95` `#7A8A28` `#6E5BC4` `#96562F`. 표 밖 색(`#C08A28` 포함) 금지.
- REQ-PREVIEW016-003 (Ubiquitous): 글꼴은 `DIAGRAM_FONT_FAMILY`/`DIAGRAM_FONT_FAMILY_MONO`와 바이트 동일(015 AC-004 유지), 반경 `3px`, 굵기 `600`(`--pele-title-weight`·`--pele-heading-weight`).

## 요구 모듈 B — 테마 독립 불변식

- REQ-PREVIEW016-004 (Ubiquitous): 렌더된 다이어그램 직렬화 색은 라이트/다크 동일.
- REQ-PREVIEW016-008 (Event-driven): When 테마 전환(토글·OS 스킴) 시 미리보기는 같은 SVG 노드, 추가 pele 렌더 호출 0(015 불변식 승계).

## 요구 모듈 C — 다크 종이 카드

- REQ-PREVIEW016-005 (State-driven): While 다크 활성 시 미리보기·내보낸 HTML은 다이어그램을 종이 카드로 표현(배경 `--pele-bg`, 테두리 `--pele-border`, 반경 `--pele-radius`); While 라이트 활성 시 다이어그램 카드 규칙(배경·테두리·반경)을 추가하지 않음(승인 기본값).

## 요구 모듈 D — 내보내기 이음매

- REQ-PREVIEW016-006 (Ubiquitous): `getPreviewCss` 다이어그램 컨테이너 배경은 두 테마 모두 `#FAF9F6` 상수(`exportUtils.ts:109` 3항 선택 제거); 다크 내보내기에 카드 테두리·반경.
- REQ-PREVIEW016-007 (Ubiquitous): 내보낸 SVG `var(--pele-` 잔여 0(015 AC-020 유지); 테마 인자는 색을 바꾸지 않음 — 사용자 `classDef`·`style` 색 보존.

## 요구 모듈 E — 선행 SPEC 개정

- REQ-PREVIEW016-009 (Ubiquitous): 015 폐기 절(REQ-PREVIEW015-008 1·2·3번 불릿, REQ-PREVIEW015-013 테마 추종 절, AC-011 e2e, AC-015, AC-020 기대값 표)과 유지 계약(AC-004, AC-020 zero-residue·사용자 색, AC-011 재렌더 금지)을 기록한다. 015 문서 편집은 폐기 포인터만.

## 수용 기준 (AC ↔ REQ 1:1)

| AC | REQ | 요지 (검증 기법) |
|----|-----|------------------|
| AC-001 | 001 | unit CSS 파싱 — pele 블록 1개, 다크 0개, `var(--md-` 0 |
| AC-002 | 002 | unit — 23값 전부 표 일치, accent==line==`#3A5673`, series 8개 정확 |
| AC-003 | 003 | unit — 글꼴 바이트 동일, 반경 `3px`, 굵기 `600` |
| AC-004 | 004 | unit+e2e — 테마 간 직렬화 색 동일 |
| AC-005 | 005 | unit+e2e+manual — 다크 종이 카드(bg `#FAF9F6`·테두리·반경), 라이트 무카드 |
| AC-006 | 006 | unit — 이음매 상수 `#FAF9F6` 양테마, 다크 카드 속성(`getPreviewCss` 문자열 검사) |
| AC-007 | 007 | unit — theme=light/dark 내보내기 색 동일, 사용자 classDef/style 보존 |
| AC-008 | 008 | unit — 기존 재렌더 금지 가드(`PreviewRenderer.test.tsx:240-297`) 유지 통과 |
| AC-009 | 009 | evidence+grep — 개정 기록 존재(spec.md "다른 SPEC 개정" 표), `#C08A28` 잔여 0(`.moai/specs` 제외) |

## 변경 파일

- M1: [MODIFY] `src/styles/mdedit-tokens.css`, [MODIFY] `src/test/diagramRenderer.test.ts`
- M2: [MODIFY] `src/lib/export/exportUtils.ts`, [MODIFY] `src/index.css`, [MODIFY] `src/components/preview/PreviewRenderer.tsx`(주석 전용), [MODIFY] `src/test/PreviewRenderer.test.tsx`
- M3: [MODIFY] `src/test/exportDiagram.test.ts`, [MODIFY] `e2e/diagram-preview-behavior.spec.ts`(:159-165 전환·헬퍼 프로브 :92-93 `--pele-*` 재조준·:181-217 전환, `isSameSvg` 가드 보존), [MODIFY] `e2e/diagram-export-colors.spec.ts`, [MODIFY-DOC] `.moai/specs/SPEC-PREVIEW-015-pele-renderer/{spec,acceptance}.md`
- [EXISTING] 무변경: `src/lib/diagram/diagramRenderer.ts`, `src/lib/export/exportHtml.ts`, `src/lib/export/exportDocx.ts`, `src/test/export.test.ts`, `e2e/mermaid-subgraph-label.spec.ts`, `e2e/markdown-render.spec.ts`

## Exclusions (What NOT to Build)

- pele 1.10.0 고정 유지(1.12.0 상승 범위 밖).
- Option B 액센트 `#C08A28` 잔여 0(grep 검증, AC-009).
- `--md-*` 토큰 무변경.
- pele 엔진·옵션·새니타이저 무변경, mermaid 복귀 없음, 팔레트 테마 노출면(토글·다이어그램별 팔레트) 없음.
- pele mock/`.mockup` accent·surface 소비 검증은 run 단계 사전 점검 항목(plan 막는 항목 아님).
- DOCX는 이미 라이트 고정 — 코드 변경 없음.
