# Implementation Plan: SPEC-INFRA-001

## Overview

Tauri v2 + React 18 프로젝트 초기 설정. 개발 환경 구축, 빌드 파이프라인 설정, 디렉토리 구조 생성을 포함한다.

## Task Decomposition

### Milestone 1: 프로젝트 스캐폴딩 (Primary Goal)

| Task | Description | Files |
|------|-------------|-------|
| T1-1 | Tauri v2 + React + TypeScript 프로젝트 생성 (`create-tauri-app`) | 프로젝트 루트 전체 |
| T1-2 | `package.json` 핵심 의존성 설치 (React 18, TypeScript 5.x, Vite 5.x) | `package.json` |
| T1-3 | `Cargo.toml` Rust 의존성 설정 (tauri, serde, tokio, anyhow) | `src-tauri/Cargo.toml` |
| T1-4 | `tauri.conf.json` 앱 메타데이터 및 윈도우 설정 | `src-tauri/tauri.conf.json` |

### Milestone 2: TypeScript 및 빌드 설정 (Primary Goal)

| Task | Description | Files |
|------|-------------|-------|
| T2-1 | `tsconfig.json` strict mode 설정 및 path alias (`@/`) 설정 | `tsconfig.json` |
| T2-2 | `vite.config.ts` Tauri 플러그인, React 플러그인, path alias 설정 | `vite.config.ts` |
| T2-3 | Tailwind CSS v3.x 설치 및 설정 (`tailwind.config.js`, `postcss.config.js`) | `tailwind.config.js`, `postcss.config.js` |
| T2-4 | 전역 CSS 파일에 Tailwind 디렉티브 추가 | `src/index.css` |

### Milestone 3: 디렉토리 구조 생성 (Primary Goal)

| Task | Description | Files |
|------|-------------|-------|
| T3-1 | 프론트엔드 디렉토리 구조 생성 (`components/`, `hooks/`, `store/`, `lib/`, `types/`) | `src/` 하위 디렉토리 |
| T3-2 | 백엔드 디렉토리 구조 생성 (`commands/`, `models/`, `state/`) | `src-tauri/src/` 하위 디렉토리 |
| T3-3 | 각 모듈의 `mod.rs` 및 `index.ts` 엔트리 파일 생성 | 각 디렉토리의 엔트리 파일 |
| T3-4 | Tauri capabilities 기본 설정 | `src-tauri/capabilities/main.json` |

### Milestone 4: 엔트리 포인트 및 기본 컴포넌트 (Primary Goal)

| Task | Description | Files |
|------|-------------|-------|
| T4-1 | React 엔트리 포인트 (`main.tsx`) 작성 | `src/main.tsx` |
| T4-2 | 루트 컴포넌트 (`App.tsx`) 기본 레이아웃 작성 | `src/App.tsx` |
| T4-3 | Rust 엔트리 포인트 (`main.rs`, `lib.rs`) 작성 | `src-tauri/src/main.rs`, `src-tauri/src/lib.rs` |
| T4-4 | `index.html` 엔트리 파일 작성 | `index.html` |

### Milestone 5: Rust 릴리스 프로파일 설정 (Secondary Goal)

| Task | Description | Files |
|------|-------------|-------|
| T5-1 | `Cargo.toml` release profile 최적화 (LTO, strip, opt-level) | `src-tauri/Cargo.toml` |
| T5-2 | `.gitignore` 설정 (node_modules, target, dist) | `.gitignore` |
| T5-3 | 개발 환경 검증 (`npm run dev` 정상 실행 확인) | - |

### Milestone 6: 테스트 인프라 설정 (Secondary Goal)

| Task | Description | Files |
|------|-------------|-------|
| T6-1 | Vitest 설정 및 기본 테스트 파일 생성 | `vitest.config.ts`, `src/__tests__/` |
| T6-2 | @testing-library/react 설치 및 설정 | `package.json` |
| T6-3 | Rust 테스트 디렉토리 구조 설정 | `src-tauri/tests/` |

### Milestone 7: 코드 품질 도구 (Optional Goal)

| Task | Description | Files |
|------|-------------|-------|
| T7-1 | ESLint + Prettier 설정 | `.eslintrc.cjs`, `.prettierrc` |
| T7-2 | Husky + lint-staged 설정 (선택) | `.husky/`, `package.json` |

## Technology Stack

### Frontend

| Library | Version | Purpose |
|---------|---------|---------|
| react | ^18.3.x | UI 프레임워크 |
| react-dom | ^18.3.x | React DOM 렌더링 |
| typescript | ^5.6.x | 타입 안전성 |
| vite | ^5.4.x | 빌드 도구 및 개발 서버 |
| @vitejs/plugin-react | ^4.x | Vite React 플러그인 |
| tailwindcss | ^3.4.x | 유틸리티 기반 CSS |
| postcss | ^8.x | CSS 후처리 |
| autoprefixer | ^10.x | CSS 벤더 프리픽스 |
| zustand | ^5.x | 상태 관리 |
| vitest | ^2.x | 테스트 프레임워크 |
| @testing-library/react | ^16.x | React 컴포넌트 테스트 |
| @tauri-apps/api | ^2.x | Tauri 프론트엔드 API |
| @tauri-apps/cli | ^2.x | Tauri CLI (dev dependency) |

### Backend (Rust)

| Crate | Version | Purpose |
|-------|---------|---------|
| tauri | 2.x | 애플리케이션 프레임워크 |
| tauri-build | 2.x | 빌드 스크립트 |
| serde | 1.x | 직렬화/역직렬화 |
| serde_json | 1.x | JSON 처리 |
| tokio | 1.x | 비동기 런타임 |
| anyhow | 1.x | 에러 처리 |
| tracing | 0.1.x | 구조화된 로깅 |

## Risk Analysis

### Risk 1: Tauri v2 Breaking Changes

- **가능성**: 중간
- **영향**: 높음
- **대응**: Tauri v2 stable 릴리스 사용. 공식 마이그레이션 가이드 참조. Tauri 커뮤니티 Discord에서 호환성 문제 모니터링.

### Risk 2: 플랫폼별 빌드 호환성

- **가능성**: 중간
- **영향**: 중간
- **대응**: macOS 우선 개발. CI/CD에서 크로스 플랫폼 빌드 테스트 추가. 플랫폼별 조건부 코드 최소화.

### Risk 3: Vite + Tauri 통합 이슈

- **가능성**: 낮음
- **영향**: 중간
- **대응**: `@tauri-apps/cli` 공식 Vite 템플릿 사용. 개발 서버 포트 충돌 방지 설정.

### Risk 4: 바이너리 크기 초과 (15MB 목표)

- **가능성**: 낮음
- **영향**: 낮음
- **대응**: Cargo.toml release profile에 `opt-level = "s"`, `lto = true`, `strip = true` 설정. 불필요한 Tauri 플러그인 비활성화.

## File Manifest

### 생성할 파일

| File Path | Description |
|-----------|-------------|
| `package.json` | Node.js 의존성 및 스크립트 정의 |
| `tsconfig.json` | TypeScript strict mode 설정 |
| `vite.config.ts` | Vite 빌드 설정 |
| `tailwind.config.js` | Tailwind CSS 설정 |
| `postcss.config.js` | PostCSS 설정 |
| `index.html` | HTML 엔트리 포인트 |
| `.gitignore` | Git 무시 패턴 |
| `src/main.tsx` | React 엔트리 포인트 |
| `src/App.tsx` | 루트 React 컴포넌트 |
| `src/index.css` | 전역 CSS (Tailwind 디렉티브) |
| `src/components/.gitkeep` | 컴포넌트 디렉토리 플레이스홀더 |
| `src/hooks/.gitkeep` | 훅 디렉토리 플레이스홀더 |
| `src/store/.gitkeep` | 스토어 디렉토리 플레이스홀더 |
| `src/lib/tauri/ipc.ts` | Tauri IPC 래퍼 (스켈레톤) |
| `src/types/file.ts` | 파일 관련 타입 정의 (스켈레톤) |
| `src-tauri/Cargo.toml` | Rust 의존성 매니페스트 |
| `src-tauri/tauri.conf.json` | Tauri 앱 설정 |
| `src-tauri/build.rs` | Tauri 빌드 스크립트 |
| `src-tauri/src/main.rs` | Rust 엔트리 포인트 |
| `src-tauri/src/lib.rs` | 라이브러리 엔트리 |
| `src-tauri/src/commands/mod.rs` | 커맨드 모듈 엔트리 |
| `src-tauri/src/models/mod.rs` | 모델 모듈 엔트리 |
| `src-tauri/src/state/mod.rs` | 상태 모듈 엔트리 |
| `src-tauri/capabilities/main.json` | Tauri 보안 capabilities |

### 수정할 파일

- 없음 (그린필드 프로젝트)

## Expert Consultation Recommendations

### Frontend Expert (expert-frontend)

- React 18 + Vite 5 최적 설정 검증
- TypeScript strict mode 설정 검토
- Tailwind CSS 설정 최적화

### Backend Expert (expert-backend)

- Tauri v2 Cargo.toml 의존성 설정 검증
- Rust release profile 최적화 검토
- Tauri capabilities 보안 설정 검토

### DevOps Expert (expert-devops)

- CI/CD 파이프라인 기본 설정 (선택)
- 크로스 플랫폼 빌드 전략 검토
