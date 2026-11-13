// @MX:SPEC: SPEC-AI-017 REQ-AI17-008 REQ-AI17-009 AC-AI17-008
// 가리키기 입력창 단위 테스트 — 키 처리(Enter/Shift+Enter/Esc/조합 중), 길이 안내, 안내문 모드.
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { PointInstructionPopover } from '@/components/preview/PointInstructionPopover';
import { evaluateSelectionGuard } from '@/components/editor/extensions/ai-length-guard';

function setup(over: Partial<React.ComponentProps<typeof PointInstructionPopover>> = {}) {
  const onSend = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <PointInstructionPopover
      anchor={{ x: 100, y: 100 }}
      summary="열: 월 요금"
      onSend={onSend}
      onClose={onClose}
      {...over}
    />,
  );
  const input = document.querySelector('.md-point-popover__input') as HTMLTextAreaElement | null;
  return { onSend, onClose, input, ...utils };
}

describe('PointInstructionPopover', () => {
  it('대상 요약 한 줄과 입력칸을 보여 준다', () => {
    const { input } = setup();
    expect(document.querySelector('.md-point-popover__summary')?.textContent).toBe('열: 월 요금');
    expect(input).not.toBeNull();
  });

  it('Enter 로 보낸다', () => {
    const { input, onSend } = setup();
    fireEvent.change(input!, { target: { value: '연 요금으로, ×10' } });
    fireEvent.keyDown(input!, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith('연 요금으로, ×10');
  });

  it('Shift+Enter 는 보내지 않는다(줄바꿈)', () => {
    const { input, onSend } = setup();
    fireEvent.change(input!, { target: { value: 'a' } });
    const notPrevented = fireEvent.keyDown(input!, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    expect(notPrevented).toBe(true); // 기본 동작(줄바꿈)을 막지 않는다
  });

  it('조합 중 Enter(isComposing 또는 keyCode 229)는 보내지 않는다', () => {
    const { input, onSend } = setup();
    fireEvent.change(input!, { target: { value: '한글' } });
    fireEvent.keyDown(input!, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(input!, { key: 'Enter', keyCode: 229 });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('공백뿐인 지시는 보낼 수 없다(Enter·버튼 모두)', () => {
    const { input, onSend } = setup();
    fireEvent.change(input!, { target: { value: '   \n ' } });
    fireEvent.keyDown(input!, { key: 'Enter' });
    const btn = document.querySelector('.md-point-popover__send') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('보내기 버튼은 지시가 있으면 보낸다(앞뒤 공백 제거)', () => {
    const { input, onSend } = setup();
    fireEvent.change(input!, { target: { value: ' x ' } });
    fireEvent.click(document.querySelector('.md-point-popover__send') as HTMLButtonElement);
    expect(onSend).toHaveBeenCalledWith('x');
  });

  it('Esc 로 닫힌다', () => {
    const { input, onClose } = setup();
    fireEvent.keyDown(input!, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('바깥 클릭(mousedown)으로 닫히고 안쪽 클릭으로는 닫히지 않는다', () => {
    const { onClose } = setup();
    fireEvent.mouseDown(document.querySelector('.md-point-popover') as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('길이 초과(lengthReason)면 안내를 보이고 보내기가 꺼진다', () => {
    const reason = evaluateSelectionGuard(12001, 'point-table').reason!;
    const { input, onSend } = setup({ lengthReason: reason });
    const notice = document.querySelector('.md-point-popover__length');
    expect(notice?.textContent).toContain('개요·표·다이어그램·짧게는');
    fireEvent.change(input!, { target: { value: 'x' } });
    fireEvent.keyDown(input!, { key: 'Enter' });
    expect((document.querySelector('.md-point-popover__send') as HTMLButtonElement).disabled).toBe(true);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('notice 모드는 입력칸 없이 안내문만 보인다', () => {
    setup({ notice: '이 블록은 가리킬 수 없어요' });
    expect(document.querySelector('.md-point-popover__notice')?.textContent).toBe('이 블록은 가리킬 수 없어요');
    expect(document.querySelector('.md-point-popover__input')).toBeNull();
  });

  it('notice 모드도 Esc·바깥 클릭으로 닫힌다', () => {
    const { onClose } = setup({ notice: 'x' });
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
