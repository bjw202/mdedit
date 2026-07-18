---
id: SPEC-AI-007
version: "0.1.0"
status: completed
created: "2026-07-18"
updated: "2026-07-18"
author: "jw"
priority: medium
issue_number: 23
dependencies:
  - SPEC-AI-001
tags:
  - ai
  - toolbar
  - length-guard
  - ux
lifecycle: spec-anchored
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-07-18 | jw | 최초 SPEC 작성 — ✨ 선택 툴바 프리셋 메뉴에 **길이 가드 상시 안내 줄** 추가. 현재는 가드가 프리셋을 비활성화해도 사유가 `btn.title`(hover 툴팁)로만 노출돼 침묵에 가깝다(P7 위반). 선택 길이가 가드에 걸리는 구간에서 메뉴 상단에 항상 보이는 안내 줄을 표시한다. 프론트 전용, Rust 무변경, 가드 임계·메뉴 구조 무변경. TDD RED-first. |

## Summary

✨ 선택 툴바의 프리셋 메뉴는 선택이 길면 길이 가드(`ai-length-guard.ts`)로 프리셋을 비활성화하지만, **사유가 비활성 버튼의 `title`(hover 시에만) + `aria-disabled`로만 노출**된다. 마우스를 올리지 않으면 "왜 회색인지" 알 수 없어 침묵에 가깝다(설계 P7 "침묵 금지" 위반).

본 SPEC은 가드가 현재 선택에 영향을 주는 구간에서 **프리셋 메뉴 상단에 항상 보이는 안내 줄**을 추가한다. 두 구간으로 나눈다.

1. **선택 > 4,000자** (변환 상한 초과, 전 프리셋 비활성) — 가드의 기존 사유 문구(`TOO_LONG_REASON`)를 안내 줄로 그대로 노출.
2. **선택 2,001–4,000자** (편집 프리셋 비활성 + 변환 프리셋 삽입 전용) — 두 효과를 함께 설명하는 안내 줄.
3. **선택 ≤ 2,000자** — 안내 줄 없음(메뉴 무변경).

가드 임계·프리셋 목록·비활성 판정 로직·per-item `title`/`aria-disabled`는 전부 무변경. 안내 줄 표시 여부·문구만 얹는 국소 변경이다.

## Background & Rationale

- 가드 계약(`evaluateSelectionGuard`)은 이미 `allowed`/`insertOnly`/`reason` 3필드를 반환한다(`ai-length-guard.ts:10-17`). `buildPresetMenuItems`가 이를 per-item으로 펼치고, `createPresetMenu`의 `renderPresets`가 비활성 버튼에 `btn.title = item.reason`만 붙인다(`ai-selection-toolbar.ts:319-322`). **항상 보이는 표면이 없다.**
- 침묵 방지(P7)는 SPEC-AI-001의 명시 원칙이다(가드 주석 "초과 시 프리셋을 비활성화할 뿐"·`reason` 필드 doc "P7, 침묵 금지"). hover 전용 title은 이 원칙을 형식적으로만 만족한다.
- 안내 구간 판정은 가드를 **단일 소스**로 재사용해 도출한다 — 편집 프리셋 대표(`polish`)와 변환 프리셋 대표(`outline`)에 대한 `evaluateSelectionGuard` 결과 조합으로 구간을 분기하므로, 2,000/4,000 임계를 툴바 쪽에 중복 하드코딩하지 않는다.
- 표시 표면은 기존 `.mdedit-ai-connect-hint`(연결 필요 배지) 선례를 따르는 정적 텍스트 줄이며, 메뉴 상단(프리셋 목록 위)에 마운트한다.

## 사전 합의 설계 결정 (재검토 금지)

1. **구간 판정은 가드 파생**: `evaluateMenuNotice(selectionLength)` 순수 헬퍼가 `evaluateSelectionGuard(len,'polish')`(편집 대표)와 `evaluateSelectionGuard(len,'outline')`(변환 대표)를 호출해 구간을 분기한다. 임계 상수(2000/4000)를 툴바에 복제하지 않는다. **too-long 안내 문구는 가드 `reason`을 그대로 재사용**(문자열 드리프트 방지).
2. **안내 줄은 정적 텍스트**: `.mdedit-ai-preset-notice`(신규 클래스, `.mdedit-ai-connect-hint` 스타일 선례) 한 줄. 진행률·아이콘 애니메이션 없음.
3. **per-item title 무변경**: 비활성 버튼의 `btn.title`/`aria-disabled`는 그대로 유지(중복이 아니라 접근성 보강). 안내 줄은 추가 표면.
4. **삽입 전용 구간 문구는 신규**: 2,001–4,000 구간은 가드가 `reason`을 반환하지 않으므로(allowed=true) 툴바가 새 UX 문구를 소유한다.

## Environment & Assumptions

- SPEC-AI-001 main 머지 완료. `ai-length-guard.ts`·`ai-selection-toolbar.ts` 가용.
- 가드 계약: `evaluateSelectionGuard(selectionLength, presetKind) → { allowed, insertOnly, reason? }`. EDIT_LIMIT=2000, TRANSFORM_LIMIT=4000, EDIT_PRESETS=[polish, custom], `TOO_LONG_REASON='선택이 너무 길어요. 문단 단위로 나눠 선택해주세요.'`
- 메뉴 DOM 조립: `createPresetMenu` → `renderPresets`(`ai-selection-toolbar.ts:301-335`). 안내 줄은 `list` prepend 또는 `dom`에 list 앞 삽입.
- CSS: `src/styles/mdedit-components.css` — `.mdedit-ai-preset-menu`/`-list`/`-item`/`-sep`, 선례 `.mdedit-ai-connect-hint`(370).
- 게이트 기준선: **vitest 985**(main @ f120230, SPEC-AI-006 완료 시점) 무개정 통과 + 신규. `tsc --noEmit` 클린. **Rust 무변경**(cargo 무관). `npm run lint`는 게이트 아님(eslint config 부재).
- 신규 의존성 없음. 새 IPC·스토어 필드 없음.

## Requirements (EARS)

### 모듈 1 — 길이 가드 상시 안내 줄

#### State-Driven

- **REQ-AI7-001**: **WHILE** 현재 선택이 변환 상한을 넘겨 모든 프리셋이 가드로 비활성인 동안, **the system shall** 프리셋 메뉴 상단에 가드의 사유 문구(`TOO_LONG_REASON`)를 담은 항상 보이는 안내 줄을 표시한다. [MODIFY: `renderPresets`에 안내 줄 마운트]
- **REQ-AI7-002**: **WHILE** 현재 선택이 삽입 전용 구간(편집 프리셋 비활성 + 변환 프리셋 삽입 전용)인 동안, **the system shall** 두 효과(편집 프리셋 비활성 · 변환은 "아래에 삽입"만)를 함께 설명하는 안내 줄을 표시한다. [NEW: 툴바 소유 UX 문구]

#### Unwanted Behaviour

- **REQ-AI7-003**: **IF** 현재 선택이 편집 상한(2,000자) 이하여서 어떤 프리셋도 가드 영향을 받지 않으면, **then the system shall** 안내 줄을 렌더하지 않고 메뉴를 기존과 동일하게 유지한다. [NEW: null 구간 = 메뉴 무변경]

#### Ubiquitous

- **REQ-AI7-004**: The system **shall** 안내 구간 판정을 `evaluateSelectionGuard` 결과로 도출하고(단일 소스), 2,000/4,000 임계를 툴바 코드에 별도 하드코딩하지 않으며, too-long 안내 문구는 가드 `reason`을 재사용한다. [NEW: `evaluateMenuNotice` 순수 헬퍼]
- **REQ-AI7-005**: The system **shall** 안내 줄을 메뉴 내부의 항상 보이는 텍스트로 렌더하고(hover 전용 title 아님), 기존 per-item `btn.title`/`aria-disabled` 어포던스를 변경 없이 보존한다. [EXISTING: title 로직 무변경, 안내 줄은 추가 표면]

### 모듈 2 — 하위호환

#### Ubiquitous

- **REQ-AI7-006**: The system **shall** 기존 vitest 985 단언을 개정 없이 통과시키고 `tsc --noEmit` 클린을 유지하며, Rust·IPC·스토어를 수정하지 않고 신규 런타임 의존성을 추가하지 않는다. [EXISTING]

## Delta (Brownfield Changes)

| Delta | 파일 | 변경 내용 |
|-------|------|-----------|
| [NEW] | `src/components/editor/extensions/ai-selection-toolbar.ts` | `evaluateMenuNotice(selectionLength): PresetMenuNotice \| null` 순수 헬퍼 + `PresetMenuNotice = { tone: 'block' \| 'partial'; text: string }` export |
| [MODIFY] | `src/components/editor/extensions/ai-selection-toolbar.ts` | `renderPresets`가 `evaluateMenuNotice` 비-null 시 `.mdedit-ai-preset-notice` 줄을 list 앞에 마운트. per-item `title`/`aria-disabled` 무변경 |
| [MODIFY] | `src/styles/mdedit-components.css` | `.mdedit-ai-preset-notice` 스타일 추가(`.mdedit-ai-connect-hint` 톤 선례, `tone` 변형 optional) |
| [NEW] | `src/test/aiSelectionToolbar.test.ts` | `evaluateMenuNotice` 구간별 반환 + `renderPresets` 안내 줄 표시/미표시 DOM 단언 |

## Proposed Copy (exact strings)

| 구간 | 조건 | 문구 |
|------|------|------|
| block (>4,000) | 전 프리셋 비활성 | `선택이 너무 길어요. 문단 단위로 나눠 선택해주세요.` (가드 `TOO_LONG_REASON` 재사용) |
| partial (2,001–4,000) | 편집 비활성 + 변환 삽입 전용 | `선택이 길어요 — 다듬기·직접 입력은 비활성이고, 변환은 결과를 「아래에 삽입」만 할 수 있어요.` |
| none (≤2,000) | 영향 없음 | (안내 줄 없음) |

## Acceptance Criteria (Given-When-Then)

> REQ-AI7-001~006 전 요구사항이 최소 1개 시나리오에 매핑된다.

### AC-AI7-001 — 초과 선택: too-long 안내 줄 (REQ-AI7-001, 004, 005)
- **Given** 선택 길이 4,001자에서 ✨ 프리셋 메뉴가 열린 상태
- **When** `renderPresets`가 렌더되면
- **Then** 메뉴 상단에 `.mdedit-ai-preset-notice`가 항상 보이는 텍스트로 존재하고, 그 문구가 `선택이 너무 길어요. 문단 단위로 나눠 선택해주세요.`와 정확히 일치한다
- **And** 모든 프리셋 버튼은 여전히 `disabled` + `title`(가드 reason) + `aria-disabled='true'`를 그대로 가진다

### AC-AI7-002 — 삽입 전용 구간: 혼합 안내 줄 (REQ-AI7-002, 004)
- **Given** 선택 길이 3,000자에서 메뉴가 열린 상태
- **When** `renderPresets`가 렌더되면
- **Then** `.mdedit-ai-preset-notice`가 존재하고 문구가 편집 프리셋 비활성 + 변환 "아래에 삽입" 전용 두 효과를 모두 언급한다(제안 문구 정확 일치)
- **And** 편집 프리셋(polish/custom)은 `disabled`, 변환 프리셋(outline/table/diagram/shorten)은 활성 + `insertOnly` 상태를 유지한다

### AC-AI7-003 — 짧은 선택: 안내 줄 없음 (REQ-AI7-003)
- **Given** 선택 길이 1,999자(또는 100자)에서 메뉴가 열린 상태
- **When** `renderPresets`가 렌더되면
- **Then** `.mdedit-ai-preset-notice`가 DOM에 존재하지 않고, 프리셋 목록·구분선 구조가 기존과 동일하다

### AC-AI7-004 — 순수 헬퍼 구간 판정 (REQ-AI7-004)
- **Given** `evaluateMenuNotice`
- **When** 2000·2001·4000·4001 경계로 호출하면
- **Then** ≤2000 → `null`, 2001–4000 → `{tone:'partial', …}`, >4000 → `{tone:'block', text: TOO_LONG_REASON}`을 반환하고, 판정이 `evaluateSelectionGuard` 결과에서 파생됨(임계 중복 없음)

### AC-AI7-005 — 하위호환 게이트 (REQ-AI7-006)
- **Given** 변경 적용 후 워크스페이스
- **When** `vitest run` + `tsc --noEmit`을 실행하면
- **Then** 기존 985개 단언이 무개정 통과 + 신규 단언 통과, tsc 클린, `git diff` 상 Rust/`Cargo.toml`/`package.json` 변경 0

## Exclusions (What NOT to Build)

- **메뉴 재설계** — 레이아웃·프리셋 순서·팝오버 flip(BUG-9) 로직 무변경. 안내 줄 한 줄만 추가.
- **가드 임계 변경** — EDIT_LIMIT 2000 / TRANSFORM_LIMIT 4000 그대로. 판정 로직 수정 없음.
- **toast / modal / 별도 알림 표면** — 메뉴 내부 정적 텍스트 줄로 한정.
- **진행률 바·애니메이션** — 정적 안내 텍스트만.
- **per-item title 제거** — hover title은 접근성 보강으로 유지(안내 줄과 공존).
- **Rust / IPC / 스토어 변경** — 프론트 뷰 레이어 전용.
- **동적 카운트다운·남은 글자 수 표시** — 구간 문구만, 실시간 수치 없음.
