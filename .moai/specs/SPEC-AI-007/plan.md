# SPEC-AI-007 Implementation Plan

## 확정 사실 (코드 확인)

> `spec.md`의 research.md 대체 — 착수 전 코드 확인 결과만 기록.

- **가드 계약** (`src/components/editor/extensions/ai-length-guard.ts`): `evaluateSelectionGuard(selectionLength: number, presetKind: AiPresetKind): { allowed, insertOnly, reason? }`. 상수 `EDIT_LIMIT=2000`, `TRANSFORM_LIMIT=4000`, `EDIT_PRESETS=['polish','custom']`, `TOO_LONG_REASON='선택이 너무 길어요. 문단 단위로 나눠 선택해주세요.'`(비-export). 분기: ≤2000 → allowed·not-insert / 편집 프리셋 >2000 → 비활성+reason / 변환 2001–4000 → allowed+insertOnly / 변환 >4000 → 비활성+reason.
- **현재 사유 노출**(`ai-selection-toolbar.ts:319-322`): `renderPresets`에서 비활성 버튼에 `btn.title = item.reason` + `btn.setAttribute('aria-disabled','true')`가 전부. **항상 보이는 안내 표면 없음** → hover 시에만 사유 확인 가능(P7 침묵에 근접).
- **메뉴 조립 지점**: `createPresetMenu`(L291) → `renderPresets`(L301). `dom`(`.mdedit-ai-preset-menu`) 안에 `list`(`.mdedit-ai-preset-list`)를 append. 안내 줄은 `list` append 전에 `dom`에 prepend하면 목록 위에 항상 표시.
- **per-item 상태**: `buildPresetMenuItems(selectionLength)`(L193)가 `PresetMenuItem{disabled,insertOnly,reason}`를 반환. 재사용 가능하나, 구간 판정은 편집/변환 대표 프리셋 2회 호출이 더 명확.
- **CSS 선례**(`src/styles/mdedit-components.css:370`): `.mdedit-ai-connect-hint`가 `position:absolute; font-size:11.5px; color/background: var(...)` 정적 배지. 안내 줄은 이 톤을 따르되 메뉴 내부 흐름(정적, absolute 아님) 한 줄로.
- **테스트**: `src/test/aiSelectionToolbar.test.ts` — `buildPresetMenuItems` 구간 단언(L183~), `createPresetMenu` jsdom DOM 단언(L258~, 비활성 버튼 `title` 검증 L289-290 존재). `src/test/aiLengthGuard.test.ts` — 가드 순수 단언. 신규 테스트는 전자에 추가.
- **게이트 기준선**: **vitest 985**(main @ f120230, SPEC-AI-006 완료). `tsc --noEmit` 클린. **Rust 무변경** → cargo 무관. `npm run lint` 게이트 아님(eslint config 부재, 회귀 오판 금지).

## Decision Log

- **D1 — 구간 판정 파생**: `evaluateMenuNotice(len)`가 `evaluateSelectionGuard(len,'polish')`(편집 대표)·`evaluateSelectionGuard(len,'outline')`(변환 대표)를 조합. `!edit.allowed && !transform.allowed` → block(text=transform.reason). `!edit.allowed && transform.allowed && transform.insertOnly` → partial. else → null. 임계 상수 툴바 미복제(REQ-AI7-004).
- **D2 — 안내 줄 소유권**: block 문구 = 가드 `reason` 재사용(드리프트 0). partial 문구 = 툴바 신규 상수(가드는 allowed 구간에 reason 없음). 두 문구 모두 module-level `const`로 노출(테스트 정확 일치용).
- **D3 — 마운트 위치**: `renderPresets` 시작부에서 `evaluateMenuNotice` 호출 → 비-null이면 `.mdedit-ai-preset-notice` div를 `dom`에 append(list보다 먼저) → list append. custom-input 모드(`renderCustomInput`)에는 안내 줄 없음(프리셋 목록 화면 한정).
- **D4 — 접근성**: 안내 줄은 `role` 불필요(정적 안내). per-item `title`/`aria-disabled`는 무변경 유지(REQ-AI7-005) — 안내 줄과 중복이 아니라 보강.

## Milestones (TDD RED-first, priority order)

### Priority High — T-001: 순수 헬퍼 + 안내 줄
- **RED**: `aiSelectionToolbar.test.ts`에 (a) `evaluateMenuNotice` 경계 단언(2000→null, 2001→partial, 4000→partial, 4001→block+정확 문구), (b) `createPresetMenu`/`renderPresets` DOM 단언 — len=4001 시 `.mdedit-ai-preset-notice` 존재+block 문구, len=3000 시 partial 문구, len=100 시 부재. 기존 비활성 버튼 `title`/`disabled` 단언이 유지되는지 재확인.
- **GREEN**: `evaluateMenuNotice` + `PresetMenuNotice` 타입 export, `MENU_NOTICE_PARTIAL` 상수 추가; `renderPresets`에 안내 줄 마운트. `.mdedit-ai-preset-notice` CSS 추가.
- **REFACTOR**: 문구 상수·헬퍼를 pure helpers 섹션에 배치. per-item 로직 diff 최소화 확인.

### Priority Low — T-002: 회귀·게이트
- `vitest run` 985+신규 무개정 통과, `tsc --noEmit` 클린. `git diff --stat`으로 Rust/Cargo.toml/package.json 무변경 확인.

## Quality Gates

- `tsc --noEmit` 클린.
- `vitest run` — 기준선 **985 무개정** + 신규(`evaluateMenuNotice` 구간·안내 줄 DOM) 통과.
- **Rust 없음** → `cargo test`/`clippy` 대상 아님(diff 0으로 검증).
- **e2e 선택 — 미채택**: 안내 줄은 순수 함수 + jsdom DOM 단언으로 완전 커버 가능하고, webkit 특화 위험(레이아웃/이벤트) 없음. Playwright 추가는 비용 대비 이득 없어 제외. 기존 `e2e/ai-*.spec.ts` 무변경.
- `npm run lint` 게이트 제외(config 부재).

## mx_plan

code_comments = ko. `@MX:SPEC: SPEC-AI-007` 부착.

| 위치 | 태그 | 사유 |
|------|------|------|
| `evaluateMenuNotice` | `@MX:NOTE` | 안내 구간을 가드에서 파생하는 단일 소스 계약·문구 소유권 경계 기록(REQ-AI7-004) |

## Risks

- **문구 문자열 드리프트**: block 문구가 가드 `TOO_LONG_REASON`과 어긋날 위험 → 재사용(하드코딩 금지)으로 차단, 테스트가 정확 일치 단언.
- **기존 title 단언 회귀**: `aiSelectionToolbar.test.ts:289-290`이 비활성 버튼 `title`을 검증 → 안내 줄 추가가 per-item 로직을 건드리지 않으므로 무영향, RED에서 동시 확인.
- **custom-input 모드 오노출**: 안내 줄이 직접 입력 화면에 새면 안 됨 → `renderPresets` 한정 마운트로 차단.
