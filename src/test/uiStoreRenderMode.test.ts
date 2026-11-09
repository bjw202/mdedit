// uiStore htmlRenderMode 영속·정규화·마이그레이션 테스트 — SPEC-PREVIEW-019 (AC-001), SPEC-PREVIEW-020 (AC-002·003·004)
import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useUIStore } from '@/store/uiStore';

async function rehydrateWith(
  state: Record<string, unknown>,
  version = 2
): Promise<void> {
  localStorage.setItem('mdedit-ui-store', JSON.stringify({ state, version }));
  await useUIStore.persist.rehydrate();
}

describe('uiStore: htmlRenderMode (SPEC-PREVIEW-020)', () => {
  beforeEach(() => {
    localStorage.removeItem('mdedit-ui-store');
    useUIStore.setState({ htmlRenderMode: null, htmlZoom: 100 });
  });

  it('초기값은 null(고르지 않음)이다', () => {
    expect(useUIStore.getState().htmlRenderMode).toBeNull();
  });

  it('저장소를 비우고 새로 만든 상태의 기본값은 null이다 (AC-002)', async () => {
    useUIStore.setState({ htmlRenderMode: 'original' });
    localStorage.removeItem('mdedit-ui-store');
    useUIStore.persist.clearStorage();
    await useUIStore.persist.rehydrate();
    expect(useUIStore.getState().htmlRenderMode).toBeNull();
  });

  it('다른 필드를 바꿔 persist가 쓰게 해도 저장된 htmlRenderMode는 null이다 (REQ-006)', () => {
    act(() => useUIStore.getState().setFontSize(16));
    const raw = JSON.parse(localStorage.getItem('mdedit-ui-store') as string);
    expect(raw.state.htmlRenderMode).toBeNull();
  });

  it.each([
    ['original', 'original'],
    ['crisp', 'crisp'],
    [null, null],
    ['Crisp', null],
    ['srcdoc', null],
    [1, null],
    [true, null],
    [{}, null],
  ])('버전 2 저장값 %j 는 %j 로 재수화된다 (AC-003)', async (stored, expected) => {
    await rehydrateWith({ htmlRenderMode: stored, htmlZoom: 150, fontSize: 16 });
    const s = useUIStore.getState();
    expect(s.htmlRenderMode).toBe(expected);
    expect(s.htmlZoom).toBe(150);
    expect(s.fontSize).toBe(16);
  });

  it('버전 2에서 필드가 없으면 null이고 다른 값은 그대로다 (AC-003)', async () => {
    await rehydrateWith({ htmlZoom: 150, fontSize: 16 });
    const s = useUIStore.getState();
    expect(s.htmlRenderMode).toBeNull();
    expect(s.htmlZoom).toBe(150);
    expect(s.fontSize).toBe(16);
  });

  it('setHtmlRenderMode는 저장 JSON에 반영된다 (AC-002)', () => {
    act(() => useUIStore.getState().setHtmlRenderMode('original'));
    expect(useUIStore.getState().htmlRenderMode).toBe('original');
    expect(
      JSON.parse(localStorage.getItem('mdedit-ui-store') as string).state.htmlRenderMode
    ).toBe('original');

    act(() => useUIStore.getState().setHtmlRenderMode('crisp'));
    expect(useUIStore.getState().htmlRenderMode).toBe('crisp');
    expect(
      JSON.parse(localStorage.getItem('mdedit-ui-store') as string).state.htmlRenderMode
    ).toBe('crisp');
  });

  it.each([['Crisp'], ['srcdoc'], [1], [true], [{}], [null], [undefined]])(
    'setHtmlRenderMode(%j)는 null로 정규화한다 (AC-002)',
    (bad) => {
      act(() => useUIStore.getState().setHtmlRenderMode('original'));
      act(() => useUIStore.getState().setHtmlRenderMode(bad as never));
      expect(useUIStore.getState().htmlRenderMode).toBeNull();
    }
  );
});

describe('uiStore: 영속 버전 1 → 2 마이그레이션 (SPEC-PREVIEW-020 AC-004)', () => {
  beforeEach(() => {
    localStorage.removeItem('mdedit-ui-store');
    useUIStore.setState({ htmlRenderMode: null, htmlZoom: 100, fontSize: 14 });
  });

  it.each([
    [1, { htmlRenderMode: 'original' }, 'original'],
    [1, { htmlRenderMode: 'crisp' }, null],
    [1, {}, null],
    [1, { htmlRenderMode: 'garbage' }, null],
    [0, { saveStatus: 'unsaved', htmlRenderMode: 'original' }, 'original'],
    [0, { saveStatus: 'unsaved', htmlRenderMode: 'crisp' }, null],
    [0, { saveStatus: 'unsaved' }, null],
    [2, { htmlRenderMode: 'crisp' }, 'crisp'],
  ])('저장 버전 %i 상태 %j 는 %j 가 된다', async (version, stored, expected) => {
    await rehydrateWith({ ...stored, htmlZoom: 125, fontSize: 18 }, version);
    const s = useUIStore.getState();
    expect(s.htmlRenderMode).toBe(expected);
    expect(s.htmlZoom).toBe(125);
    expect(s.fontSize).toBe(18);
    expect(s).not.toHaveProperty('saveStatus', 'unsaved');
  });

  it('마이그레이션 뒤 다시 영속화하면 저장 버전이 2다', async () => {
    await rehydrateWith({ htmlRenderMode: 'crisp' }, 1);
    act(() => useUIStore.getState().setFontSize(20));
    expect(JSON.parse(localStorage.getItem('mdedit-ui-store') as string).version).toBe(2);
  });

  it.each([[null], ['문자열']])(
    '저장된 상태가 객체가 아니어도(%j) 예외 없이 시작하고 null이다',
    async (bad) => {
      localStorage.setItem('mdedit-ui-store', JSON.stringify({ state: bad, version: 1 }));
      await useUIStore.persist.rehydrate();
      expect(useUIStore.getState().htmlRenderMode).toBeNull();
    }
  );

  it('파싱할 수 없는 저장소에서도 예외 없이 시작하고 null이다', async () => {
    localStorage.setItem('mdedit-ui-store', '{not json');
    await useUIStore.persist.rehydrate();
    expect(useUIStore.getState().htmlRenderMode).toBeNull();
  });
});
