# SPEC-PREVIEW-018 progress.md

## Phase Notes (plan)

- 사용자 결정(2026-11-08 인터뷰, 오케스트레이터 경유): HTML 전용 퍼센트 배율 컨트롤(단계 67~200, 퍼센트 표시 클릭 시 100%), 입력 3종(버튼·Cmd/Ctrl+`=`/`+`/`-`/`0`·Cmd/Ctrl+휠·핀치), 전역 값 하나를 `mdedit-ui-store`에 영속화.
- plan 단계 확인(manager-spec, 2026-11-08, main HEAD 00c0edb): `HtmlFileViewer.tsx`·`uiStore.ts`·`Header.tsx:202-210`·`previewZoom.ts`·`PreviewContainer.tsx` 읽기, 단축키 충돌 grep(결과는 plan.md §A). 앱 코드 안 Cmd/Ctrl+`=`/`-`/`0`·`wheel` 바인딩 없음, `zoomHotkeysEnabled` 미설정.
- Tier S. 산출물: spec.md / plan.md / acceptance.md(오케스트레이터 요청으로 검증 층 분리) / progress.md.

## Plan-audit History

- review-1(2026-11-08): FAIL 0.76 — `.moai/reports/plan-audit/SPEC-PREVIEW-018-review-1.md`. blocking D1~D5, minor D6~D16.
- v0.2.0 개정(2026-11-09, manager-spec): D1~D5 해소, 경미 D6~D15 반영(D16은 감사 권고대로 유지).
  - 개정 중 재확인(HEAD 00c0edb): `grep -c 'sandbox="allow-scripts allow-same-origin"' src/components/preview/HtmlFileViewer.tsx` → `3`, `grep -cE '^[[:space:]]+sandbox="allow-scripts allow-same-origin"$' …` → `1`, `grep -rnE '\bsetZoom\b|set_zoom|zoomHotkeysEnabled|zoom_hotkeys_enabled' src src-tauri/src src-tauri/tauri.conf.json` → 출력 없음(exit 1), `src/test/SvgFileViewer.test.tsx`·`src/test/previewZoom.test.ts` 존재, 두 모달 `role="dialog"` + `aria-modal="true"` 보유.
- v0.3.0 개정(2026-11-09, manager-spec, run 중 사용자 결정 반영): 휠·핀치 범위 제외(REQ-005·AC-005 삭제 표지, §3 측정 관문·덮개 절 삭제, plan M0 삭제, 수동 M-0·M-3 삭제 표지). **이 개정에 대한 새 plan-audit은 실행하지 않았다.** plan-audit 2차의 경미 N1·N3(휠 단위 테스트 관련)은 휠 범위가 빠져 무효가 되었고, N2(plan L66 문구 정밀화)도 해당 M0 문구가 삭제되어 무효가 되었다. 개정으로 spec.md가 바뀌었으므로 기존 감사 PASS 캐시는 더 이상 유효하지 않다.

## Resolved Decisions

- [SUPERSEDED by 아래 2026-11-09 "휠·핀치 범위 제외" 결정] 휠·핀치(사용자, 2026-11-09, 오케스트레이터 경유): "먼저 측정하고 결정한다". 휠·핀치는 범위 안에 유지. run 단계 첫 작업 = macOS·Windows 실기기에서 iframe 위 Cmd/Ctrl+휠·핀치가 앱 셸에 도달하는지 측정(plan.md §F M0). 도달 → REQ-005 구현. 미도달 → run 정지 + 차단 보고, 오케스트레이터가 사용자에게 선택지(제한 수용 / 수정키 누른 동안의 조건부 덮개 / 휠 제외)를 제시. 어떤 덮개도 사용자 결정 없이 구현하지 않는다.
- 휠·핀치 범위 제외(사용자, 2026-11-09, 오케스트레이터 경유): v0.2.0 선택지 중 "휠 입력을 이 SPEC에서 뺀다"를 택했다. 실기기 도달 측정(M0)은 수행하지 않는다. Cmd/Ctrl+휠·트랙패드 핀치 배율은 후속 SPEC 후보로 넘긴다. 버튼·키보드 단축키·전역 영속화는 그대로 유지한다. SPEC v0.3.0에 반영. 수동 항목 M-1·M-2·M-4·M-5는 run 완료를 막지 않고 sync/PR 단계에서 사용자가 확인한다.

## §E.1 Plan-phase Audit-Ready Signal

- plan_status: audit-ready
- plan_complete_at: 2026-11-09
- plan 단계 미결 사용자 결정 없음. v0.2.0에 있던 조건부 차단 관문은 v0.3.0 개정(휠·핀치 범위 제외)으로 없어졌다. v0.3.0 개정에 대한 새 감사는 실행하지 않았다(Plan-audit History).

## §E.2 Run-phase Evidence

> 기준: worktree `.claude/worktrees/preview-018`, 브랜치 `WT-html-zoom`. 증거 로그: `.moai/state/verify/preview-018/`(로컬, 비추적). 모든 결과는 이 실행·이 트리에서 직접 관찰한 값이다.

### 경과

- 2026-11-09 사용자 결정으로 휠·핀치가 SPEC 범위에서 빠졌다(SPEC v0.3.0, REQ-005·AC-005 삭제됨). M0 실측은 수행하지 않았다. 구현된 휠 코드는 처음부터 없었다(`grep -rniE "wheel|pinch" src` 출력 없음).
- 임시 M0 프로브(`src/dev/m0Probe.ts` + `main.tsx` 한 줄)는 커밋 0dc3c34로 올라가 origin에 푸시됐다(결정 변경 메시지가 도착하기 전). 히스토리 재작성 없이 `git revert` 커밋 643d901로 제거했다. 최종 트리에 `src/dev/`는 없고 `main.tsx`는 base와 같다.

### 설계 결정

- persist 버전: **1 유지**. 필드 추가만으로는 범프가 필요 없고(persist가 초기 상태 위에 얕게 병합), 단계 밖/비숫자 값 정규화는 `merge` 옵션에서 `snapToStep`으로 처리. 기존 `migrate`(0→1)와 충돌 없음, 기존 "version이 1" 테스트 그대로 통과.
- 키 리스너 위치: `Header.tsx`의 `useEffect`(html 보기일 때만 등록). 헤더가 이미 보기 종류와 `htmlZoom`을 읽고, 컨트롤과 단축키가 같은 액션(`stepHtmlZoom`/`resetHtmlZoom`)을 쓰게 하려는 선택.
- `getFileViewType`을 `src/lib/preview/fileViewType.ts`로 분리(동작 무변경), `PreviewContainer`에서 재공개. 헤더가 `PreviewContainer`를 import하면 뷰어 전체(mermaid/pele 체인)가 헤더 테스트에 딸려 들어오기 때문. 기존 import 경로(AppLayout, ResizablePanels)는 그대로 동작.
- 휠 상수(`WHEEL_*`)는 작성하지 않았다.

### 커밋

| SHA | 내용 |
|-----|------|
| 83ad52c | 구현: 단계·저장소·뷰어 감싸개·헤더·단축키 |
| 034dd19 | progress 중간 기록, SPEC 상태 in-progress |
| 0dc3c34 | 임시 M0 프로브 (푸시됨) |
| 643d901 | 프로브 revert |
| (이 기록 커밋) | SPEC v0.3.0 개정(휠·핀치 제외) + progress §E.2 최종 |

### AC 상태

| AC | 상태 | 근거 |
|----|------|------|
| AC-PREVIEW018-001 | PASS | `Header.test.tsx` 25 passed (html/md/ts/txt 분기) |
| AC-PREVIEW018-002 | PASS | `htmlZoom.test.ts` 12 passed, `Header.test.tsx` 버튼·비활성·리셋, `uiStore.test.ts` 67 passed |
| AC-PREVIEW018-003 | PASS(단위) + pending-manual M-1 | `HtmlFileViewer.test.tsx` 8 passed(역보정 80%·scale(1.25)·overflow hidden·sandbox·src) |
| AC-PREVIEW018-004 | PASS(단위) + pending-manual M-2 | `Header.test.tsx` 키 이벤트(macOS/Windows 수정키, 조합 입력, 모달, 비html) |
| AC-PREVIEW018-005 | 삭제됨(사용자 결정) | SPEC v0.3.0 |
| AC-PREVIEW018-006 | PASS | `uiStore.test.ts` 재수화 정규화(없음→100, 113→110, 77.5→75, 999→200, 10→67, 비숫자→100) |
| AC-PREVIEW018-007 | PASS | 단위(fontSize 비간섭) + grep·git diff 4종, 아래 표 |
| AC-PREVIEW018-008 | pending-manual (M-4, M-5) | 실기기 필요 |

### 검증 명령과 결과

| 명령 | 종료 코드 / 관찰 |
|------|------------------|
| `npm run lint` (= `eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0`) | exit 0, 출력 없음 |
| `npx tsc --noEmit` | exit 2, 20줄. 전부 `pele` 모듈 미설치(TS2307)와 그 파생 implicit-any. 작업 전 주 체크아웃도 동일 20줄, 변경 전후 출력 동일(`diff` 일치) |
| `npx vitest run` (전체) | exit 1, 41 files / 345 tests failed, 69 files / 1128 passed (110 files) |
| 실패 파일 비교(`comm -13` 기준선 대비) | 기준선에 없는 신규 실패 파일 0건 |
| 대상 7개 테스트 파일 | `htmlZoom` 12, `uiStore` 67, `HtmlFileViewer` 8, `Header` 25, `PreviewContainer` 52, `SPEC-PREVIEW-007-routing` 25, `specImgLoadBRouting` 19 — 전부 ✓ |

- 전체 vitest·tsc 실패의 공통 원인: `Failed to resolve import "pele" from src/lib/diagram/diagramRenderer.ts`. `package.json`은 `pele 1.10.0`을 요구하나 공유 `node_modules`에 없다(`npm ls pele` → empty). 이번 변경과 무관한 환경 결함이며 `npm install` 뒤 재측정이 필요하다.

### AC-007 보조 검사 (HEAD 기준)

| 검사 | 결과 |
|------|------|
| `git diff --quiet 00c0edb -- src/test/SvgFileViewer.test.tsx src/test/previewZoom.test.ts src/components/preview/SvgFileViewer.tsx src/lib/preview/previewZoom.ts` | exit 0 |
| `grep -rnE '\bsetZoom\b\|set_zoom\|zoomHotkeysEnabled\|zoom_hotkeys_enabled' src src-tauri/src src-tauri/tauri.conf.json` | 출력 없음, exit 1 |
| `grep -cE '^[[:space:]]+sandbox="allow-scripts allow-same-origin"$' src/components/preview/HtmlFileViewer.tsx` | `1` |
| `git diff -w 00c0edb -- src/components/preview/HtmlFileViewer.tsx \| grep -cE '^[-+][^-+].*sandbox'` | `0` (처음에는 `1`이었다 — 내가 추가한 @MX:NOTE 주석에 "sandbox" 단어가 있었기 때문. 주석을 "iframe 권한 확대"로 바꿔 `0` 확인. sandbox 속성·주석 자체는 무변경) |

→ AC-PREVIEW018-007: 단위 + grep + git diff 전부 PASS.

### Gaps / Residual risk

- 수동 항목 M-1·M-2·M-4·M-5(macOS·Windows) 전부 미수행. sync/PR 단계에서 사용자가 확인한다. 특히 Windows WebView2에서 Ctrl+`=`가 웹뷰 전체를 확대하는지는 코드로 막지 못했고(키 이벤트 `preventDefault`만 적용) 실기기 확인이 필요하다.
- Playwright(`e2e/html-file-viewer.spec.ts`) 미실행: `pele` 미설치로 앱을 띄울 수 없음.
- `pele` 설치 후 전체 vitest/tsc 재측정 미수행.
- CodeMirror 기본 키맵의 `Mod-=`/`Mod--`/`Mod-0` 충돌 확인(plan §A 남은 확인) 미수행. `Header`의 문서 단위 리스너는 `keydown` 버블 단계라, 편집기가 먼저 `preventDefault`하면 달라질 수 있다.
  - [sync 단계 보강, 2026-11-09] 위 항목은 sync에서 해소됨: §E.4 "키맵 충돌 점검" 참조(바인딩 없음, HTML 보기 중 편집기 미마운트). 위 원문은 run 시점 기록으로 보존한다.
- plan-audit: 이번 개정(v0.3.0)은 새 감사를 거치지 않았다. spec.md가 바뀌어 기존 PASS 캐시는 무효.
- 원격 브랜치에 프로브 커밋 0dc3c34와 revert 643d901이 모두 남는다(재작성 금지 지시).

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

```yaml
sync_complete_at: 2026-11-09
sync_status: audit-ready
sync_commit_sha: <이 기록을 담은 커밋 — 커밋 후 git log -1로 확인>
changelog_entry_position: "CHANGELOG.md ## [Unreleased] > ### Added, 첫 항목"
frontmatter_status_transitions:
  spec_md: "in-progress -> implemented (status, updated만 변경)"
  plan_md_acceptance_md_progress_md: "미변경 (아래 사유)"
```

### 동기화한 것

- CHANGELOG.md `[Unreleased]`에 SPEC-PREVIEW-018 항목 추가(`### Added`). 단계·버튼·단축키·영속화·적용 방식은 `src/lib/preview/htmlZoom.ts`, `src/store/uiStore.ts`, `src/components/layout/Header.tsx`, `src/components/preview/HtmlFileViewer.tsx` diff를 읽고 대조해 작성했다.
- spec.md frontmatter `status: in-progress -> implemented`, `updated: 2026-11-09`. 본문은 건드리지 않았다.
- README.md·docs/USER_GUIDE.md·docs/USER_MANUAL.md: HTML은 "샌드박스 iframe 보기 전용 렌더링"이라는 서술이 여전히 정확하고, 글자 크기 스테퍼 서술은 마크다운 편집 맥락이라 부정확해지지 않아 수정하지 않았다(USER_MANUAL 헤더 표만 HTML 보기에서 스테퍼가 배율로 바뀌는 점을 담지 않지만 오류는 아니라고 판단, 후속 문서 정리 후보).

### 상태 값 선택 사유

- `implemented`로 설정, `completed`는 아님. 수용 기준 AC-003/004/008이 실기기 수동 확인(M-1, M-2, M-4, M-5)을 요구하고 아직 수행되지 않았다. `spec-workflow.md`의 의존성 충족 정의는 `completed`만 충족으로 보므로, 수동 확인 통과 전에 `completed`로 올리면 미검증 상태를 충족으로 표시하게 된다.
- plan.md·acceptance.md·progress.md frontmatter는 같은 이유로 이번 커밋에서 전환하지 않았다(`completed` 전환 시 4개 문서를 함께 갱신).

### 키맵 충돌 점검 (sync 작업자가 직접 실행)

- 명령 1: `grep -rnE "(key|mac|win|linux): *\"[^\"]*(Mod|Ctrl|Cmd)-(=|\+|-|0|Minus|Equal)\"" node_modules/@codemirror/{commands,search,language,autocomplete}/dist/index.js` -> 출력 없음(exit 1).
- 명령 2: `grep -rnE "Mod-(=|\+|-|0)|(Ctrl|Cmd)-(=|\+|-|0)['\"]" src --include='*.ts' --include='*.tsx' | grep -v '/test/'` -> 출력 없음. 앱 자체 키맵(`MarkdownEditor.tsx` 포함)에도 해당 바인딩이 없다. (`src/lib/keyboard-shortcuts.ts`는 이 트리에 존재하지 않는다.)
- AppLayout은 HTML 파일을 보는 동안 편집기를 마운트하지 않고 보기 전용 자리표시를 보여 주므로 편집기 키맵과 겹칠 경로가 없다.

### 관찰한 검증 수치 (조정자가 이 worktree에서 `npm ci` 후 직접 실행, sync 작업자는 재실행하지 않음)

| 명령 | 결과 |
|------|------|
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0 |
| `npx vitest run` | exit 0, 110 files / 1833 tests passed |

위 수치는 §E.2의 이전 수치(`pele` 미설치 환경에서의 실패 345건)를 대체한다. 환경 결함이 `npm ci`로 해소된 뒤의 값이다.

### 남은 수동 확인

| 항목 | macOS | Windows |
|------|-------|---------|
| M-1 (배율 적용 모양) | 대기 | 대기 |
| M-2 (단축키 동작) | 대기 | 대기 |
| M-4 | 대기 | 대기 |
| M-5 | 대기 | 대기 |

Windows는 WebView2가 Ctrl+`=`에서 자체 페이지 확대를 함께 적용하는지가 핵심 확인 사항이다.

### Gaps (미검증)

- 수동 확인 M-1, M-2, M-4, M-5(macOS·Windows) 전부 미수행.
- Playwright e2e(`e2e/html-file-viewer.spec.ts`) 미실행.
- SPEC v0.3.0 개정(휠·핀치 제외)은 plan-auditor 재감사를 받지 않았다. sync-auditor가 지금 검토한다.
- 검증 수치는 조정자 실행의 보고값이며 sync 작업자가 재실행하지 않았다. 키맵 grep은 sync 작업자가 직접 실행했다.
- Ctrl/Cmd+휠·트랙패드 핀치 배율은 범위 제외(사용자 결정 2026-11-09), 후속 SPEC 후보.
- 키보드 초점이 iframe 문서 안에 있을 때 단축키가 앱에 전달되지 않는 제한은 코드·문서에 알려진 제한으로만 기록했고 실기기에서 확인하지 않았다.
- `mcp__moai__spec_audit` 등 SPEC 수명주기 감사 도구는 실행하지 않았다.

### Residual risk

- WebView2 자체 확대와의 이중 적용 가능성(Windows).
- 단위 테스트는 jsdom 기반이라 실제 iframe 크기 역보정·`transform` 렌더 결과(줄바꿈, 스크롤)를 검증하지 못한다(M-1이 담당).
