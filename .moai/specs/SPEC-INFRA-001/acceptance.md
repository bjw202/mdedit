# Acceptance Criteria: SPEC-INFRA-001

## Test Scenarios

### Scenario 1: 개발 서버 정상 실행

- **Given**: 프로젝트 의존성이 모두 설치된 상태
- **When**: `npm run dev` 명령을 실행하면
- **Then**: Vite 개발 서버가 시작되고, Tauri 윈도우가 열리며, React 애플리케이션이 렌더링된다

### Scenario 2: TypeScript strict mode 검증

- **Given**: TypeScript strict mode가 활성화된 `tsconfig.json`이 존재하는 상태
- **When**: `any` 타입이 포함된 TypeScript 파일을 컴파일하면
- **Then**: TypeScript 컴파일러가 에러를 발생시킨다

### Scenario 3: 프로덕션 빌드 실행

- **Given**: 모든 소스 코드가 작성된 상태
- **When**: `npm run build` 명령을 실행하면
- **Then**: 프론트엔드 번들이 생성되고, Rust release 바이너리가 컴파일된다

### Scenario 4: Rust 백엔드 컴파일

- **Given**: `Cargo.toml`에 필수 의존성이 정의된 상태
- **When**: `cargo build` 명령을 실행하면
- **Then**: Rust 바이너리가 에러 없이 컴파일된다

### Scenario 5: Tailwind CSS 동작 확인

- **Given**: Tailwind CSS가 설정된 상태
- **When**: React 컴포넌트에서 Tailwind 유틸리티 클래스를 사용하면
- **Then**: 해당 스타일이 브라우저에 정상 적용된다

### Scenario 6: Path Alias 동작 확인

- **Given**: `tsconfig.json`에 `@/` path alias가 설정된 상태
- **When**: `import { something } from '@/lib/utils'` 형태로 import하면
- **Then**: Vite와 TypeScript 모두에서 경로가 정상 해석된다

### Scenario 7: HMR 동작 확인

- **Given**: 개발 서버가 실행 중인 상태
- **When**: React 컴포넌트 파일을 수정하면
- **Then**: 브라우저가 자동으로 변경 사항을 반영하되, 전체 페이지 새로고침 없이 상태가 유지된다

### Scenario 8: Vitest 테스트 실행

- **Given**: Vitest가 설정되고 기본 테스트 파일이 존재하는 상태
- **When**: `npm test` 명령을 실행하면
- **Then**: 테스트 러너가 실행되고 테스트 결과를 출력한다

### Scenario 9: Tauri 윈도우 설정 검증

- **Given**: `tauri.conf.json`에 윈도우 설정이 정의된 상태
- **When**: Tauri 앱을 실행하면
- **Then**: 설정된 크기(width, height)와 제목으로 윈도우가 생성된다

## Edge Cases

### EC-1: Node.js 버전 불일치

- **Given**: Node.js 16 이하가 설치된 환경
- **When**: `npm install`을 실행하면
- **Then**: `engines` 필드에 의해 최소 버전 경고가 표시되어야 한다

### EC-2: Rust 미설치 환경

- **Given**: Rust 툴체인이 설치되지 않은 환경
- **When**: `npm run dev` (Tauri 포함)를 실행하면
- **Then**: Rust 미설치에 대한 명확한 에러 메시지가 표시되어야 한다

### EC-3: 포트 충돌

- **Given**: Vite 기본 포트(1420)가 이미 사용 중인 상태
- **When**: 개발 서버를 시작하면
- **Then**: 다음 사용 가능한 포트로 자동 전환되어야 한다

### EC-4: 빈 프로젝트 빌드

- **Given**: 소스 코드가 최소한의 스켈레톤만 존재하는 상태
- **When**: `npm run build`를 실행하면
- **Then**: 빌드가 성공하고, 실행 가능한 바이너리가 생성된다

## Performance Criteria

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| `npm install` 완료 시간 | < 60s (캐시 없음) | `time npm install` |
| `npm run dev` 시작 시간 | < 5s | Vite 서버 ready 로그까지의 시간 |
| `cargo build` (debug) | < 120s (첫 빌드) | `time cargo build` |
| `cargo build --release` | < 300s (첫 빌드) | `time cargo build --release` |
| TypeScript 타입 체크 | < 10s | `time npx tsc --noEmit` |
| Release 바이너리 크기 (macOS) | < 15MB | `ls -la` 파일 크기 확인 |
| 유휴 메모리 사용량 | < 80MB | Activity Monitor / Task Manager |

## Quality Gates

### QG-1: TypeScript Compilation

- [ ] `npx tsc --noEmit` 에러 0건
- [ ] `strict: true` 활성화 확인
- [ ] `noImplicitAny: true` 확인

### QG-2: Rust Compilation

- [ ] `cargo build` 경고 0건 (`#![deny(warnings)]` 또는 clippy clean)
- [ ] `cargo clippy` 경고 0건
- [ ] Rust 2021 edition 확인

### QG-3: 빌드 성공

- [ ] `npm run dev` 정상 실행 (Vite + Tauri)
- [ ] `npm run build` 정상 완료
- [ ] Release 바이너리 생성 확인

### QG-4: 디렉토리 구조

- [ ] `src/components/`, `src/hooks/`, `src/store/`, `src/lib/`, `src/types/` 존재
- [ ] `src-tauri/src/commands/`, `src-tauri/src/models/`, `src-tauri/src/state/` 존재
- [ ] 각 Rust 모듈에 `mod.rs` 파일 존재

### QG-5: 테스트 인프라

- [ ] `npm test` 명령 실행 가능
- [ ] `cargo test` 명령 실행 가능
- [ ] 최소 1개의 스모크 테스트 통과

### QG-6: 보안

- [ ] Tauri capabilities가 최소 권한으로 설정됨
- [ ] CSP (Content Security Policy) 설정 확인
- [ ] 외부 URL 로딩 차단 확인

## Definition of Done

- [ ] 모든 Test Scenario가 통과한다
- [ ] 모든 Quality Gate를 만족한다
- [ ] `npm run dev` 명령으로 개발 환경이 정상 실행된다
- [ ] `npm run build` 명령으로 릴리스 빌드가 정상 완료된다
- [ ] TypeScript strict mode와 Rust clippy에서 에러/경고 0건이다
- [ ] 디렉토리 구조가 spec.md에 정의된 구조와 일치한다
- [ ] 후속 SPEC (SPEC-FS-001, SPEC-EDITOR-001 등) 구현을 위한 기반이 준비되었다
