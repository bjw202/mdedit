// uiStore htmlRenderMode 영속·정규화 테스트 — SPEC-PREVIEW-019 (AC-001)
import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useUIStore } from '@/store/uiStore';

async function rehydrateWith(state: Record<string, unknown>): Promise<void> {
  localStorage.setItem('mdedit-ui-store', JSON.stringify({ state, version: 1 }));
  await useUIStore.persist.rehydrate();
}

describe('uiStore: htmlRenderMode (SPEC-PREVIEW-019)', () => {
  beforeEach(() => {
    localStorage.removeItem('mdedit-ui-store');
    useUIStore.setState({ htmlRenderMode: 'crisp', htmlZoom: 100 });
  });

  it('기본값은 crisp이다', () => {
    expect(useUIStore.getState().htmlRenderMode).toBe('crisp');
  });

  it('필드가 없는 기존 형식 상태를 재수화하면 crisp이고 다른 값은 그대로다', async () => {
    await rehydrateWith({ htmlZoom: 150, fontSize: 16 });
    const s = useUIStore.getState();
    expect(s.htmlRenderMode).toBe('crisp');
    expect(s.htmlZoom).toBe(150);
    expect(s.fontSize).toBe(16);
  });

  it.each([
    ['original', 'original'],
    ['crisp', 'crisp'],
    ['Crisp', 'crisp'],
    ['srcdoc', 'crisp'],
    [1, 'crisp'],
    [null, 'crisp'],
    [true, 'crisp'],
    [{}, 'crisp'],
  ])('저장값 %j 는 %s 로 재수화된다', async (stored, expected) => {
    await rehydrateWith({ htmlRenderMode: stored });
    expect(useUIStore.getState().htmlRenderMode).toBe(expected);
  });

  it('setHtmlRenderMode는 저장 JSON에 반영되고 허용 밖 값은 crisp으로 정규화한다', () => {
    act(() => useUIStore.getState().setHtmlRenderMode('original'));
    expect(useUIStore.getState().htmlRenderMode).toBe('original');
    const raw = JSON.parse(localStorage.getItem('mdedit-ui-store') as string);
    expect(raw.state.htmlRenderMode).toBe('original');

    act(() => useUIStore.getState().setHtmlRenderMode('bogus' as never));
    expect(useUIStore.getState().htmlRenderMode).toBe('crisp');
  });
});
