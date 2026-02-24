# Implementation Plan: SPEC-UI-001 3-Pane Application Layout

## Task Decomposition

### Milestone 1: Zustand uiStore 및 useTheme Hook (Priority High - Primary Goal)

uiStore와 테마 관련 Hook을 먼저 구현하여 레이아웃 컴포넌트의 상태 관리 기반을 확립한다.

**Task 1.1: uiStore 구현**
- 파일: `src/store/uiStore.ts`
- Zustand store 생성 (create + persist middleware)
- 상태 필드: `sidebarWidth`, `previewWidth`, `theme`, `fontSize`, `sidebarCollapsed`
- Action 함수: `setSidebarWidth`, `setPreviewWidth`, `setTheme`, `setFontSize`, `toggleSidebar`, `resetLayout`
- localStorage 영속성: `zustand/middleware`의 `persist` 사용, key: `mdedit-ui-settings`
- 기본값: sidebarWidth=250, previewWidth=50(%), theme='system', fontSize=14, sidebarCollapsed=false

**Task 1.2: useTheme Hook 구현**
- 파일: `src/hooks/useTheme.ts`
- `window.matchMedia('(prefers-color-scheme: dark)')` 리스너 등록
- 시스템 테마 변경 시 자동 감지 및 uiStore 업데이트
- `document.documentElement`에 `data-theme` 또는 Tailwind `dark` 클래스 토글
- CSS 변수 주입: `--color-bg`, `--color-text`, `--color-border` 등
- 컴포넌트 unmount 시 리스너 정리(cleanup)

### Milestone 2: 레이아웃 컴포넌트 구현 (Priority High - Primary Goal)

3-Pane 레이아웃의 핵심 컴포넌트를 구현한다.

**Task 2.1: ResizablePanels 컴포넌트 구현**
- 파일: `src/components/layout/ResizablePanels.tsx`
- 마우스 이벤트 기반 드래그 리사이즈 구현 (mousedown/mousemove/mouseup)
- 패널 최소 너비 제약: 사이드바 180px, 에디터 200px, 프리뷰 200px
- `requestAnimationFrame` 사용으로 60fps 보장
- 리사이즈 핸들 시각적 피드백 (hover, active 상태)
- 리사이즈 완료 시 uiStore에 최종 너비 저장
- 창 리사이즈 시 패널 비율 유지 로직

**Task 2.2: Header 컴포넌트 구현**
- 파일: `src/components/layout/Header.tsx`
- editorStore에서 현재 파일명, dirty 상태 구독
- 파일명 표시 (없으면 "Untitled")
- 미저장 표시: dirty 상태일 때 파일명 옆 dot indicator
- 사이드바 토글 버튼 배치

**Task 2.3: Footer 컴포넌트 구현**
- 파일: `src/components/layout/Footer.tsx`
- editorStore에서 라인 수, 커서 위치(행:열) 구독
- 인코딩 표시 (기본: UTF-8)
- 테마에 맞는 스타일 적용

**Task 2.4: AppLayout 컴포넌트 구현**
- 파일: `src/components/layout/AppLayout.tsx`
- Header + ResizablePanels + Footer 조합
- 전체 화면 높이(`h-screen`) 레이아웃
- 사이드바 collapsed 상태에 따른 레이아웃 조정
- Tailwind CSS `flex`, `overflow-hidden` 기반 레이아웃
- useTheme Hook 초기화

### Milestone 3: Tailwind CSS 기반 스타일링 (Priority Medium - Secondary Goal)

다크/라이트 테마 및 전체 스타일 시스템을 완성한다.

**Task 3.1: Tailwind 테마 설정**
- `tailwind.config.js`에 커스텀 색상 팔레트 정의
- `darkMode: 'class'` 설정으로 프로그래밍 방식 다크 모드 제어
- 커스텀 색상 변수: `bg-surface`, `text-primary`, `border-divider` 등

**Task 3.2: 공통 스타일 적용**
- 패널 경계선 스타일 (hover 시 색상 변경)
- Header/Footer 배경색, 높이, padding
- 리사이즈 핸들 커서 변경 (`cursor-col-resize`)
- 트랜지션 효과 (테마 전환 시 smooth transition)

### Milestone 4: 통합 및 최적화 (Priority Medium - Secondary Goal)

전체 레이아웃 통합 테스트 및 성능 최적화를 수행한다.

**Task 4.1: 성능 최적화**
- `React.memo` 적용으로 불필요한 리렌더링 방지
- Zustand selector 사용으로 세분화된 구독 (`useStore(state => state.sidebarWidth)`)
- 리사이즈 이벤트 `requestAnimationFrame` throttling

**Task 4.2: 반응형 레이아웃**
- 창 리사이즈 이벤트 핸들링
- 최소 창 크기에서 레이아웃 유지 검증
- 패널 비율 보존 로직

---

## Technology Stack

| 기술 | 버전 | 역할 |
|------|------|------|
| React | 18.x | UI 프레임워크 |
| TypeScript | 5.x+ | 타입 안전성 |
| Zustand | 5.x | 상태 관리 + persist middleware |
| Tailwind CSS | 3.x | 유틸리티 CSS 스타일링 |
| Vite | 5.x | 빌드 도구 |

---

## Risk Analysis

### Risk 1: 리사이즈 성능 이슈

- **확률**: Medium
- **영향**: High (60fps 미달 시 UX 저하)
- **완화 전략**: `requestAnimationFrame` 기반 throttling, CSS `will-change` 속성 활용, JavaScript layout thrashing 방지
- **대안**: CSS `resize` 속성 기반 네이티브 리사이즈 시도

### Risk 2: 테마 전환 시 FOUC

- **확률**: Medium
- **영향**: Medium (시각적 불쾌감)
- **완화 전략**: 애플리케이션 초기 로드 시 localStorage에서 테마를 동기적으로 읽어 `<html>` 태그에 클래스 적용, CSS transition 사용
- **대안**: 초기 렌더링 전 테마 스크립트를 `<head>`에 인라인 삽입

### Risk 3: Zustand persist 동기화 문제

- **확률**: Low
- **영향**: Low (레이아웃 설정 초기화)
- **완화 전략**: persist middleware의 `onRehydrateStorage` 콜백으로 복원 확인, 기본값 fallback 보장
- **대안**: 커스텀 localStorage wrapper 구현

### Risk 4: 크로스 플랫폼 렌더링 차이

- **확률**: Medium
- **영향**: Medium (OS별 레이아웃 차이)
- **완화 전략**: Tailwind CSS의 크로스 브라우저 호환성 활용, Tauri WebView별 테스트 수행
- **대안**: 플랫폼별 CSS override 파일 분리

---

## File Manifest

| 파일 경로 | 유형 | 설명 |
|-----------|------|------|
| `src/components/layout/AppLayout.tsx` | Component | 최상위 레이아웃 컨테이너 |
| `src/components/layout/ResizablePanels.tsx` | Component | 리사이즈 가능한 패널 시스템 |
| `src/components/layout/Header.tsx` | Component | 파일명, 저장 상태 헤더 |
| `src/components/layout/Footer.tsx` | Component | 라인 수, 인코딩 푸터 |
| `src/store/uiStore.ts` | Store | UI 레이아웃 상태 관리 |
| `src/hooks/useTheme.ts` | Hook | 시스템 테마 감지 및 적용 |
| `tailwind.config.js` | Config | Tailwind 커스텀 테마 설정 (수정) |

---

## Traceability

- SPEC Reference: SPEC-UI-001
- Product Reference: product.md - Performance Targets, UX Goals
- Structure Reference: structure.md - `src/components/layout/`, `src/store/`, `src/hooks/`
