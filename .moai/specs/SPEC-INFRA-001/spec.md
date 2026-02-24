---
id: SPEC-INFRA-001
version: "1.0.0"
status: approved
created: "2026-02-24"
updated: "2026-02-24"
author: "jw"
priority: P1
tags: [infrastructure, setup, tauri, react, vite]
dependencies: []
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-24 | jw | 최초 SPEC 작성 |

## Overview

MdEdit 데스크톱 애플리케이션의 초기 프로젝트 설정을 정의한다. Tauri v2 (Rust 백엔드) + React 18 (TypeScript 프론트엔드) 기반의 개발 환경을 구축하고, 빌드 파이프라인, 디렉토리 구조, 핵심 의존성을 설정하여 후속 SPEC 구현을 위한 기반을 마련한다.

## EARS Requirements

### Ubiquitous Requirements

- **REQ-INFRA-U01**: 시스템은 항상 TypeScript strict mode가 활성화된 상태에서 프론트엔드 코드를 컴파일해야 한다. `any` 타입 사용을 금지한다.
- **REQ-INFRA-U02**: 시스템은 항상 Rust 2021 edition을 사용하여 백엔드 코드를 컴파일해야 한다.
- **REQ-INFRA-U03**: 시스템은 항상 ESM (ES Modules) 형식으로 프론트엔드 번들을 생성해야 한다.
- **REQ-INFRA-U04**: 시스템은 항상 UTF-8 인코딩을 기본 문자 인코딩으로 사용해야 한다.
- **REQ-INFRA-U05**: 시스템은 항상 `src/` 디렉토리 내 path alias (`@/`)를 지원하여 절대 경로 import가 가능해야 한다.

### Event-Driven Requirements

- **REQ-INFRA-E01**: WHEN `npm run dev` 명령이 실행되면, THEN Vite 개발 서버와 Tauri 개발 서버가 함께 시작되어 Hot Module Replacement (HMR)가 활성화되어야 한다.
- **REQ-INFRA-E02**: WHEN `npm run build` 명령이 실행되면, THEN 프론트엔드 번들 빌드와 Rust release 바이너리 빌드가 순차적으로 수행되어야 한다.
- **REQ-INFRA-E03**: WHEN TypeScript 소스 파일이 변경되면, THEN Vite HMR이 500ms 이내에 변경 사항을 브라우저에 반영해야 한다.
- **REQ-INFRA-E04**: WHEN `npm test` 명령이 실행되면, THEN Vitest 테스트 러너가 프론트엔드 단위 테스트를 수행해야 한다.
- **REQ-INFRA-E05**: WHEN `cargo test` 명령이 실행되면, THEN Rust 백엔드의 단위 테스트와 통합 테스트가 수행되어야 한다.

### State-Driven Requirements

- **REQ-INFRA-S01**: IF 개발 모드(development mode)에서 실행 중이면, THEN Rust 백엔드는 debug 심볼을 포함하고, 프론트엔드는 소스맵을 생성해야 한다.
- **REQ-INFRA-S02**: IF 릴리스 모드(release mode)에서 빌드 중이면, THEN Rust 바이너리는 LTO, strip, opt-level="s" 최적화가 적용되어야 한다.
- **REQ-INFRA-S03**: IF Tailwind CSS가 프로덕션 빌드에서 사용되면, THEN 사용되지 않는 CSS 클래스는 purge되어 최소 번들 크기를 유지해야 한다.

### Unwanted Behavior Requirements

- **REQ-INFRA-N01**: 시스템은 `any` 타입이 포함된 TypeScript 코드를 컴파일하지 않아야 한다. `noImplicitAny: true` 설정을 강제한다.
- **REQ-INFRA-N02**: 시스템은 Rust 코드에서 `unsafe` 블록을 허용하지 않아야 한다 (Tauri 내부 코드 제외).
- **REQ-INFRA-N03**: 시스템은 beta 또는 alpha 버전의 라이브러리를 production 의존성에 포함하지 않아야 한다.
- **REQ-INFRA-N04**: 시스템은 Node.js runtime을 번들에 포함하지 않아야 한다 (Tauri의 WebView를 사용).

### Optional Requirements

- **REQ-INFRA-O01**: 가능하면 ESLint + Prettier 설정을 포함하여 코드 포매팅 일관성을 제공한다.
- **REQ-INFRA-O02**: 가능하면 Husky + lint-staged를 설정하여 커밋 전 자동 린팅을 제공한다.
- **REQ-INFRA-O03**: 가능하면 GitHub Actions CI/CD 기본 워크플로우 파일을 포함한다.

## Technical Constraints

### 프레임워크 및 라이브러리 버전

| Component | Version | Constraint |
|-----------|---------|------------|
| Tauri | v2.x (latest stable) | Tauri v1 사용 금지 |
| React | v18.x | React 19는 아직 안정화되지 않음 |
| TypeScript | v5.x strict mode | `strict: true` 필수 |
| Vite | v5.x | Webpack 사용 금지 |
| Tailwind CSS | v3.x | CSS-in-JS 사용 금지 |
| Zustand | v5.x | Redux 사용 금지 |
| Vitest | latest stable | Jest 대신 Vitest 사용 |
| Rust edition | 2021 | 최소 Rust 1.70+ |
| Tokio | v1.x | async runtime |

### 성능 목표

- 콜드 스타트 시간: < 500ms
- 유휴 메모리 사용량: < 80MB
- macOS ARM64 바이너리 크기: < 15MB
- 프론트엔드 번들 크기 (gzipped): < 800KB

### 디렉토리 구조

```
markdown-editor-rust/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── commands/
│   │   │   └── mod.rs
│   │   ├── models/
│   │   │   └── mod.rs
│   │   └── state/
│   │       └── mod.rs
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── capabilities/
│       └── main.json
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   ├── hooks/
│   ├── store/
│   ├── lib/
│   │   └── tauri/
│   └── types/
├── public/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── .gitignore
```

### 보안 요구사항

- Tauri capabilities에서 최소 권한 원칙을 적용한다.
- CSP (Content Security Policy)를 설정하여 XSS를 방지한다.
- 외부 URL 로딩을 차단한다.

## Dependencies

- 없음 (최초 SPEC)
