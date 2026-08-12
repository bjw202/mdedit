// @MX:NOTE: [AUTO] SPEC-IMG-LOAD-002 임계값 명명 상수 (OD-1).
//   SOFT/HARD/LINE_FOLD 3계층 + Phase 2 용 STREAM_CHUNK_SIZE + 테스트용 INPUT_RESPONSIVENESS_BUDGET_MS.
//   FILE_SIZE_THRESHOLD (5MB) 는 OD-2 deprecated alias 로 유지 — SvgFileViewer 소스 뷰 가드가
//   사용 중이며 REQ-D-007 (래스터/SVG 제외) 이 현행 라우팅 보존을 요구.
// @MX:SPEC: SPEC-PREVIEW-007 REQ-PREVIEW007-005, SPEC-IMG-LOAD-002 REQ-IMG-LOAD-2-D-001..007

/**
 * SOFT 임계값 (30MB) — 초과 시 점진적 로딩 + 라인 폴딩 활성화 (REQ-IMG-LOAD-2-D-001).
 * Phase 1에서는 폴딩만 활성화 (스트리밍은 Phase 2). SOFT 초과 ~ HARD 이하 구간은 편집 허용.
 */
export const SOFT_THRESHOLD = 30 * 1024 * 1024;

/**
 * HARD 상한 (100MB) — 초과 시 UnsupportedFileViewer + 에디터 잠금 (REQ-IMG-LOAD-2-D-002/005).
 * 001 Group B 의 too-large 라우팅과 정합 (메커니즘 동일, 임계값만 5MB → 100MB 로 이동).
 */
export const HARD_CEILING = 100 * 1024 * 1024;

/**
 * 라인 폴딩 임계값 (1MB) — 단일 라인 길이가 초과 시 자동 fold (REQ-IMG-LOAD-2-D-003).
 * REQ-IMG-LOAD-2-A-003 fold 트리거가 이 값을 사용한다. N1 (per-line tokenization) 직접 완화.
 */
export const LINE_FOLD_THRESHOLD = 1 * 1024 * 1024;

/**
 * 스트리밍 청크 크기 (256KB) — Phase 2 read_file_chunk 기본 청크 단위 (OD-3).
 * Phase 1 RUN scope 에서는 사용처 없음 (스트리밍 미구현). 정의만 미리 둔다.
 */
export const STREAM_CHUNK_SIZE = 256 * 1024;

/**
 * 입력 응답 예산 (5초) — PT-A1-006/006b 의 동결 판정 한계 (OD-1).
 * 로컬 Playwright must-pass 게이트값. CI에서는 warning-only.
 */
export const INPUT_RESPONSIVENESS_BUDGET_MS = 5000;

/**
 * 대용량 파일 임계값 (5MB) — deprecated alias (OD-2).
 *
 * SPEC-PREVIEW-007 회귀 방지를 위해 유지. SvgFileViewer 의 소스 뷰 가드가 이 값을 사용 중이며,
 * REQ-D-007 (래스터/SVG 제외) 이 현행 라우팅 보존을 요구하므로 5MB 값을 그대로 둔다.
 *
 * 신규 코드는 SOFT_THRESHOLD / HARD_CEILING / LINE_FOLD_THRESHOLD 중 적절한 것을 직접 사용할 것.
 * useFileSystem.ts 의 too-large 게이트는 HARD_CEILING 기반으로 마이그레이션되었다.
 */
export const FILE_SIZE_THRESHOLD = 5 * 1024 * 1024;
