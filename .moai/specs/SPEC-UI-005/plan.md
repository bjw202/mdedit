# SPEC-UI-005 — 구현 계획 (plan.md)

> **Annotation Outcome (v1.0.1, 2026-06-25)** — annotation cycle 4개 결정 확정됨:
> 1. Footer status message 언어: **English** (기존 `Copied: ...`, `Failed to copy path` 유지, 변경 없음).
> 2. Footer 통합: **Footer가 `useUIStore((s) => s.statusMessage)` 직접 구독** (AppLayout prop drilling 기각). AppLayout 변경 없음.
> 3. 키보드 단축키: **본 SPEC에서 제외** (별도 SPEC에서 다룸, 이미 Out of Scope).
> 4. SPEC 전체: **APPROVED** → `/moai run` 진행.
>
> Brownfield(FileTreeNode / uiStore / Footer / setup.ts 수정). development_mode = tdd → RED-GREEN-REFACTOR.
> 모든 기술 결정은 `.moai/specs/SPEC-UI-005/research.md`의 file:line 증거에 근거한다.
> 메뉴 배치는 research §4 제안이 아닌 **사용자 인터뷰 확정값**(copy group을 Rename/Delete 위, divider로 분리)을 따른다.

## 1. 설계 결정 (Design Decisions)

### (a) 핸들러 위치 — `FileTreeNode.tsx` 인라인 (채택)

`handleCopyPath` / `handleCopyName`을 `FileTreeNode.tsx`에 inline `useCallback`으로 정의한다(기존 `handleRenameConfirm`/`handleCreateConfirm`/`handleDelete` 패턴, `src/components/sidebar/FileTreeNode.tsx:158-183`).

근거(research §1 Recommendations):
1. 기존 컨텍스트 메뉴 액션이 모두 동일 파일의 inline callback으로 구현되어 일관성 유지.
2. 클립보드 작업은 부작용이 없어 `useFileSystem` hook이나 Tauri IPC 불필요.
3. `node.path` / `node.name`이 이미 prop으로 사용 가능.
4. `useFileSystem` hook은 파일 시스템 IPC 전용이므로 clipboard를 넣으면 관심사 혼합(research §1 Option A 기각 근거).
5. 단일 API 호출(`navigator.clipboard.writeText`)을 위한 별도 모듈은 과잉 추상화(research §1 Option B 기각 근거).

```ts
const handleCopyPath = useCallback(async (): Promise<void> => {
  try {
    await navigator.clipboard.writeText(node.path);
    setStatusMessage(`Copied: ${node.path}`);
  } catch (err) {
    console.error('[FileTreeNode] Failed to copy path:', err);
    setStatusMessage('Failed to copy path');
  }
}, [node.path, setStatusMessage]);

// handleCopyName 동일 패턴 (node.name 사용)
```

### (b) uiStore statusMessage — module-level timer ref + single-flight (채택)

`src/store/uiStore.ts`에 `statusMessage: string | null` 필드와 `setStatusMessage` 액션 추가. 타이머 ID는 **module-level 변수**로 보관하여 컴포넌트 unmount와 무관하게 동작(research §2 추천 패턴 확장).

```ts
// module scope (create 호출 외부)
let statusMessageTimer: ReturnType<typeof setTimeout> | null = null;

// UIState 확장
statusMessage: string | null;        // 초기값 null
setStatusMessage: (message: string | null) => void;

// 액션 구현
setStatusMessage: (message: string | null) => {
  // single-flight: 기존 타이머 취소
  if (statusMessageTimer !== null) {
    clearTimeout(statusMessageTimer);
    statusMessageTimer = null;
  }
  set({ statusMessage: message });
  // non-null인 경우에만 auto-clear 타이머 시작
  if (message !== null) {
    statusMessageTimer = setTimeout(() => {
      set({ statusMessage: null });
      statusMessageTimer = null;
    }, 2000);
  }
},
```

결정 세부:
- **module-level ref vs zustand 내부 필드**: module-level이 더 단순하며 타이머는 상태가 아니므로 store에 넣을 필요 없음.
- **`null` 호출 시 타이머 취소**: 중복 clear 방지.
- **persist 제외**: `statusMessage`는 트랜지언트 값. zustand `persist`가 store 전체를 직렬화하므로 `partialize`로 `statusMessage`를 제외한다(기존 `mdedit-ui-store` 키 동작 유지). 이렇게 하지 않으면 앱 재시작 시 오래된 메시지가 잔류할 수 있음.

```ts
persist(
  (set) => ({ /* ... */ }),
  {
    name: 'mdedit-ui-store',
    partialize: (state) => {
      // statusMessage는 영속화에서 제외
      const { statusMessage, ...rest } = state;
      return rest;
    },
  }
)
```

> 참고: `setStatusMessage` / 타이머 자체는 영속화 대상이 아니므로 `partialize`에서 함수를 별도 처리할 필요는 없다(zustand persist는 기본적으로 함수는 직렬화에서 제외).

### (c) Footer 렌더링 — useUIStore 직접 구독 + 조건부 + truncate (채택)

`src/components/layout/Footer.tsx`가 `useUIStore((s) => s.statusMessage)`를 직접 구독한다(annotation cycle 확정 — AppLayout prop drilling 기각). 기존 좌측 save status 영역(`src/components/layout/Footer.tsx:48-55`) 옆에 조건부 렌더링(research §2). `FooterProps.statusMessage` prop은 추가하지 않는다.

```tsx
// Footer.tsx
const statusMessage = useUIStore((s) => s.statusMessage);

// 렌더 영역
{statusMessage && (
  <span
    className="truncate max-w-xs text-blue-600 dark:text-blue-400"
    role="status"
    aria-live="polite"
  >
    {statusMessage}
  </span>
)}
```

- `truncate max-w-xs`: 긴 경로 말줄임(REQ-UI-005-015).
- `role="status"` + `aria-live="polite"`: 스크린 리더가 새 메시지를 알림.
- 파란색: 기존 save status 색상과 구분(research §2).

**AppLayout 통합 방식(확정)**: Footer가 store를 직접 구독한다. AppLayout은 변경하지 않는다(prop wiring 불필요).

### (d) Clipboard API — `navigator.clipboard.writeText` (채택, research §3)

`@tauri-apps/plugin-clipboard-manager` 대신 표준 Web API 사용.

근거(research §3):
1. `src-tauri/tauri.conf.json:21-27`의 `csp: null`이므로 WKWebView/WebView2에서 clipboard API 허용.
2. `src/lib/image/imageHandler.ts:36-69`가 이미 `event.clipboardData`로 clipboard read를 수행 중 → WebView 지원 입증.
3. Tauri 플러그인 설치·capability 설정 불필요(의존성 0 추가, REQ-UI-005-014).
4. 사용자 제스처(클릭)가 이미 충족되어 `writeText` 권한 요구사항 만족.

### (e) 메뉴 배치 — copy group을 Rename/Delete 위 (사용자 확정, research §4 제안 무시)

```
[Directory]                       [File]
  New File                          Copy Path
  New Folder                        Copy Name
  ────────                          ────────
  Copy Path                         Rename
  Copy Name                         Delete
  ────────
  Rename
  Delete
```

구현체(JSX 순서, `src/components/sidebar/FileTreeNode.tsx:287-319` 수정):
1. `node.isDirectory` 블록: New File / New Folder / `<hr/>` (기존 유지).
2. **신규** copy group: Copy Path button / Copy Name button.
3. **신규** `<hr/>` divider.
4. Rename button (기존).
5. Delete button (기존).

> research §4 "Rename 이후, Delete 이전" 제안은 기각. 사용자 인터뷰 확정값이 우선.

### (f) 접근성 — `role="menuitem"` 유지 (채택)

기존 메뉴 항목이 이미 `role="menuitem"`을 사용 중(`src/components/sidebar/FileTreeNode.tsx:290, 297, 307, 314`). 신규 Copy Path / Copy Name 버튼에 동일 적용. `<button>` 요소이므로 Tab/Arrow 도달 + Enter/Space 활성화가 자동 지원(REQ-UI-005-003). 추가 ARIA 불필요.

## 2. 영향/신규 파일

| 파일 | 변경 유형 | 핵심 작업 |
|------|-----------|-----------|
| `src/store/uiStore.ts` | [MODIFY] | `statusMessage: string \| null` 필드, `setStatusMessage` 액션, module-level timer ref, persist `partialize` 제외. 기존 ANCHOR 업데이트(SPEC-UI-005 참조 추가) |
| `src/components/sidebar/FileTreeNode.tsx` | [MODIFY] | `handleCopyPath` / `handleCopyName` inline callback 추가. 컨텍스트 메뉴에 copy group + divider 추가. `useUIStore`에서 `setStatusMessage` 구독 |
| `src/components/layout/Footer.tsx` | [MODIFY] | `useUIStore((s) => s.statusMessage)` 직접 구독 추가. 좌측 영역 조건부 렌더(`truncate`, `role="status"`). FooterProps 변경 없음(prop 미사용) |
| `src/test/setup.ts` | [MODIFY] | `navigator.clipboard.writeText` mock 추가(jsdom 미구현) |
| `src/test/FileTreeNode.test.tsx` | [MODIFY] | Copy Path / Copy Name 렌더·클릭·메뉴 닫힘·키보드·에러패스 테스트 추가 |
| `src/test/uiStore.test.ts` | [MODIFY] | `setStatusMessage` 설정·auto-clear·single-flight·명시적 null 테스트 추가 |
| `src/test/Footer.test.tsx` | [MODIFY] | `statusMessage` 렌더·null 시 미렌더 테스트 추가(store 주입 또는 store setState로 검증) |

신규 파일: 없음. Rust 백엔드 변경: 없음.

> **`src/components/layout/AppLayout.tsx`**: 변경 없음. Footer가 `useUIStore`를 직접 구독하므로 prop wiring이 불필요하다(annotation cycle 확정).

## 3. @MX 태그 대상 (code_comments = ko)

| 위치 | 태그 | 사유 |
|------|------|------|
| `FileTreeNode.tsx` `handleCopyPath` / `handleCopyName` | `@MX:NOTE` | Claude Code 경로 공유 유스케이스 기록. 외부 에이전트로 path를 넘기는 사용 패턴 설명. `@MX:SPEC: SPEC-UI-005` |
| `uiStore.ts` module-level `statusMessageTimer` + `setStatusMessage` | `@MX:NOTE` | single-flight 타이머 패턴이 비자명. 타이머를 store 외부 module-level로 둔 이유(unmount 무관) 명시. `@MX:SPEC: SPEC-UI-005` |
| `Footer.tsx` statusMessage 조건부 렌더 영역 | `@MX:NOTE` | 트랜지언트 피드백 채널 역할. `role="status"` 의미. `@MX:SPEC: SPEC-UI-005` |
| `uiStore.ts` 기존 ANCHOR(line 4-5) | `@MX:ANCHOR` 업데이트 | `statusMessage` 추가로 store API 표면 확장. SPEC-UI-005 참조 추가 |

기존 ANCHOR 업데이트 위주(파일당 3개 한도 준수). WARN 불필요(부작용 적고 복잡도 낮음).

## 4. Run-phase 분해 순서 (TDD)

의존 그래프상 store → Footer 렌더 → setup mock → FileTreeNode 핸들러/메뉴 순으로 진행(하류가 상류 상태에 의존).

1. **Test setup: clipboard mock** — `src/test/setup.ts`에 `navigator.clipboard.writeText = vi.fn().mockResolvedValue(undefined)` 추가. 이후 모든 테스트의 전제.
2. **uiStore `statusMessage`** — RED: `setStatusMessage` 설정 / 2000ms 후 auto-clear / single-flight / 명시적 null 테스트(`vi.useFakeTimers`) → GREEN: 필드·액션·module-level timer 추가, persist `partialize` → REFACTOR: ANCHOR/NOTE 주석.
3. **Footer 렌더링 + useUIStore 구독** — RED: `statusMessage` 제공 시 표시 / null 시 미렌더 테스트(`useUIStore.setState({ statusMessage })`로 store 상태 주입) → GREEN: Footer에 `useUIStore((s) => s.statusMessage)` 구독 추가, 조건부 `<span role="status">` → REFACTOR: truncate 스타일. 기존 AppLayout/Footer 테스트 회귀 없는지 확인.
4. **FileTreeNode 핸들러 + 메뉴** — RED: Copy Path / Copy Name 렌더(file/folder) / 클릭 시 `writeText` 호출 / 메뉴 닫힘 / 키보드 활성화 / 에러 패스(reject) / byte-identical 경로 / `onRefresh` 미호출 테스트 → GREEN: `handleCopyPath`/`handleCopyName` 추가, copy group + divider JSX 추가, `useUIStore.setStatusMessage` 구독 → REFACTOR: 핸들러 중복 정리, NOTE 주석.

각 단계 종료 시 전체 vitest 스위트 실행하여 기존 컨텍스트 메뉴/레이아웃 회귀 없는지 확인.

## 5. 리스크

| 리스크 | 영향 | 완화 |
|--------|------|------|
| 비-secure 컨텍스트 / 구형 WebView에서 `writeText` reject | 복사 실패, 사용자 혼란 | try/catch로 에러 `statusMessage` 표시. research §3: 현재 Tauri 환경(CSP null)에서 동작 확인됨 |
| 빠른 반복 복사로 타이머 race | 깜빡임, 잘못된 clear 순서 | single-flight: 매 호출마다 `clearTimeout` 후 재시작 |
| module-level timer가 테스트 간 누적 | 테스트 flakiness | `vi.useFakeTimers()` + `afterEach`에서 `setStatusMessage(null)`로 타이머 정리 |
| persist가 `statusMessage`를 영속화 | 앱 재시작 시 오래된 메시지 잔류 | `partialize`에서 `statusMessage` 제외 |
| ~~Footer 통합 방식(AppLayout prop vs Footer 직접 구독) 미확정~~ | ~~구현 분기~~ | **RESOLVED (annotation v1.0.1)**: Footer 직접 구독 채택. AppLayout 변경 없음 |
| 긴 경로 Footer 레이아웃 깨짐 | UI 깨짐 | `truncate max-w-xs` 클래스 |
| 폴더 trailing separator 불일치 | 복사값이 사용자 예상과 상이 | research §6: Rust가 반환한 그대로 복사(정규화 금지, REQ-UI-005-012). native 경로 기대 |
| 기존 컨텍스트 메뉴 회귀 | Rename/Delete 동작 파손 | 새 항목 추가만, 기존 항목 변경 없음. 기존 FileTreeNode 테스트가 방어 |
| `writeText` mock이 다른 테스트에 영향 | 예상치 못한 호출 기록 | `beforeEach`에서 `vi.clearAllMocks()` (research §5 권장) |

## 6. 검증 게이트 (Definition of Done)

- [ ] 모든 AC 시나리오 acceptance.md 작성됨.
- [ ] `npm run test` 통과(신규 + 기존 회귀 없음).
- [ ] 커버리지 85% 이상(quality.yaml `test_first_required`).
- [ ] `package.json` 의존성 변경 없음(REQ-UI-005-014).
- [ ] `src/lib/tauri/ipc.ts` 및 Rust 코드 변경 없음.
- [ ] @MX 태그 3개 파일에 추가(code_comments = ko).
- [ ] 메뉴 배치가 사용자 확정값(copy group 위, divider)을 따름.
