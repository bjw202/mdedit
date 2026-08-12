// @MX:SPEC: SPEC-IMG-LOAD-002
// Group D — UT-D1-001/002/003: 임계값 명명 상수 존재 + 제안값(OD-1) 단언.
//   - REQ-IMG-LOAD-2-D-001: SOFT_THRESHOLD = 30MB
//   - REQ-IMG-LOAD-2-D-002: HARD_CEILING = 100MB
//   - REQ-IMG-LOAD-2-D-003: LINE_FOLD_THRESHOLD = 1MB
//
// OD-2 (SPEC-PREVIEW-007 회귀 방지): FILE_SIZE_THRESHOLD (5MB) deprecated alias 는
// 본 SPEC 도입 후에도 제거되지 않고 현행 5MB 값을 유지한다 — SvgFileViewer 소스 뷰 가드가
// 이 값을 사용 중이며 REQ-D-007 (래스터/SVG 제외) 이 현행 라우팅 보존을 요구하기 때문.

import { describe, it, expect } from 'vitest';

describe('SPEC-IMG-LOAD-002 REQ-D-001 (UT-D1-001): SOFT_THRESHOLD 명명 상수', () => {
  it('SOFT_THRESHOLD 가 export 되어 있다', async () => {
    const m = await import('@/lib/preview/previewLimits');
    expect(m.SOFT_THRESHOLD).toBeDefined();
  });

  it('SOFT_THRESHOLD 값은 30 * 1024 * 1024 (30MB) 이다 (OD-1)', async () => {
    const { SOFT_THRESHOLD } = await import('@/lib/preview/previewLimits');
    expect(SOFT_THRESHOLD).toBe(30 * 1024 * 1024);
  });
});

describe('SPEC-IMG-LOAD-002 REQ-D-002 (UT-D1-002): HARD_CEILING 명명 상수', () => {
  it('HARD_CEILING 이 export 되어 있다', async () => {
    const m = await import('@/lib/preview/previewLimits');
    expect(m.HARD_CEILING).toBeDefined();
  });

  it('HARD_CEILING 값은 100 * 1024 * 1024 (100MB) 이다 (OD-1)', async () => {
    const { HARD_CEILING } = await import('@/lib/preview/previewLimits');
    expect(HARD_CEILING).toBe(100 * 1024 * 1024);
  });
});

describe('SPEC-IMG-LOAD-002 REQ-D-003 (UT-D1-003): LINE_FOLD_THRESHOLD 명명 상수', () => {
  it('LINE_FOLD_THRESHOLD 가 export 되어 있다', async () => {
    const m = await import('@/lib/preview/previewLimits');
    expect(m.LINE_FOLD_THRESHOLD).toBeDefined();
  });

  it('LINE_FOLD_THRESHOLD 값은 1 * 1024 * 1024 (1MB) 이다 (OD-1)', async () => {
    const { LINE_FOLD_THRESHOLD } = await import('@/lib/preview/previewLimits');
    expect(LINE_FOLD_THRESHOLD).toBe(1 * 1024 * 1024);
  });
});

describe('SPEC-IMG-LOAD-002 OD-1 부가 상수: STREAM_CHUNK_SIZE / INPUT_RESPONSIVENESS_BUDGET_MS', () => {
  it('STREAM_CHUNK_SIZE = 256 * 1024 (256KB, Phase 2 용 상수도 미리 정의)', async () => {
    const { STREAM_CHUNK_SIZE } = await import('@/lib/preview/previewLimits');
    expect(STREAM_CHUNK_SIZE).toBe(256 * 1024);
  });

  it('INPUT_RESPONSIVENESS_BUDGET_MS = 5000 (5s, PT-A1-006/006b 판정 한계)', async () => {
    const { INPUT_RESPONSIVENESS_BUDGET_MS } = await import('@/lib/preview/previewLimits');
    expect(INPUT_RESPONSIVENESS_BUDGET_MS).toBe(5000);
  });
});

describe('SPEC-IMG-LOAD-002 OD-2: FILE_SIZE_THRESHOLD deprecated alias 유지', () => {
  it('FILE_SIZE_THRESHOLD 가 여전히 export 된다 (삭제 금지)', async () => {
    const m = await import('@/lib/preview/previewLimits');
    expect(m.FILE_SIZE_THRESHOLD).toBeDefined();
  });

  it('FILE_SIZE_THRESHOLD 값은 현행 5MB 를 유지한다 (SvgFileViewer/PREVIEW-007 호환)', async () => {
    const { FILE_SIZE_THRESHOLD } = await import('@/lib/preview/previewLimits');
    expect(FILE_SIZE_THRESHOLD).toBe(5 * 1024 * 1024);
  });
});
