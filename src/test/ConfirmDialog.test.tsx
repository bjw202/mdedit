// @MX:SPEC: SPEC-FS-003
// ConfirmDialog 컴포넌트 계약·a11y·키보드·불변식 테스트 (REQ-001~006, 036, INV-1/2/3)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ConfirmDialog,
  type ConfirmDialogProps,
  type DialogAction,
  type DialogActionVariant,
} from '@/components/common/ConfirmDialog';

const baseActions: DialogAction[] = [
  { id: 'cancel', label: '취소' },
  { id: 'discard', label: '저장 안 함' },
  { id: 'save', label: '저장', variant: 'primary' },
];

function renderDialog(overrides: Partial<ConfirmDialogProps> = {}): ReturnType<typeof render> {
  const props: ConfirmDialogProps = {
    open: true,
    title: '미저장 변경',
    message: '저장하지 않은 변경이 있습니다.',
    actions: baseActions,
    onAction: vi.fn(),
    ...overrides,
  };
  return render(<ConfirmDialog {...props} />);
}

describe('ConfirmDialog — 계약 export (REQ-001)', () => {
  it('DialogActionVariant / DialogAction / ConfirmDialogProps 타입을 export한다', () => {
    // 타입 레벨 계약 — 런타임에서는 값이 undefined여도 컴파일 통과로 검증
    const variant: DialogActionVariant = 'primary';
    const action: DialogAction = { id: 'x', label: 'L' };
    const props: ConfirmDialogProps = {
      open: true,
      title: 't',
      message: 'm',
      actions: [action],
      onAction: () => {},
    };
    expect(variant).toBe('primary');
    expect(action.id).toBe('x');
    expect(Array.isArray(props.actions)).toBe(true);
  });
});

describe('ConfirmDialog — 구조 + a11y (REQ-002, 005)', () => {
  it('open=false면 아무것도 렌더하지 않는다', () => {
    renderDialog({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('open=true면 role=dialog + aria-modal=true + 백드롭을 렌더한다', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByTestId('confirm-dialog-backdrop')).toBeInTheDocument();
  });

  it('루트와 각 액션 버튼에 data-testid가 있다 (REQ-005)', () => {
    renderDialog();
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-action-cancel')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-action-discard')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-action-save')).toBeInTheDocument();
  });

  it('title과 message를 렌더한다', () => {
    renderDialog({ title: '타이틀', message: '메시지 본문' });
    expect(screen.getByText('타이틀')).toBeInTheDocument();
    expect(screen.getByText('메시지 본문')).toBeInTheDocument();
  });

  it('message는 React.ReactNode를 허용한다', () => {
    renderDialog({ message: <span data-testid="msg-node">노드 메시지</span> });
    expect(screen.getByTestId('msg-node')).toBeInTheDocument();
  });
});

describe('ConfirmDialog — 액션 순서 + primary/포커스 (REQ-003, INV-1/2)', () => {
  it('actions를 배열 순서대로 좌→우 렌더한다', () => {
    renderDialog({ actions: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C', variant: 'primary' }] });
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['A', 'B', 'C']);
  });

  it('마지막 항목이 primary 스타일을 갖고 초기 포커스를 받는다 (REQ-003)', () => {
    renderDialog({ actions: [{ id: 'cancel', label: '취소' }, { id: 'save', label: '저장', variant: 'primary' }] });
    const saveBtn = screen.getByTestId('dialog-action-save');
    expect(saveBtn.className).toContain('md-dialog-action-primary');
    expect(document.activeElement).toBe(saveBtn);
  });

  it('INV-1: 마지막 항목이 danger여도 초기 포커스는 마지막이 받되 danger 스타일로 렌더된다', () => {
    renderDialog({ actions: [{ id: 'cancel', label: '내 버전 유지', variant: 'primary' }, { id: 'reload', label: '디스크에서 다시 읽기', variant: 'danger' }] });
    const reloadBtn = screen.getByTestId('dialog-action-reload');
    expect(reloadBtn.className).toContain('md-dialog-action-danger');
    expect(reloadBtn.className).not.toContain('md-dialog-action-primary');
    expect(document.activeElement).toBe(reloadBtn);
  });

  it('INV-2: variant 생략과 "default"는 동일한 중립 스타일이다', () => {
    renderDialog({ actions: [{ id: 'cancel', label: 'A' }, { id: 'save', label: 'B', variant: 'primary' }] });
    const cancelBtn = screen.getByTestId('dialog-action-cancel');
    expect(cancelBtn.className).toContain('md-dialog-action-default');
  });

  it('variant: "default" 명시도 생략과 동일하게 중립 스타일이다', () => {
    renderDialog({ actions: [{ id: 'cancel', label: 'A', variant: 'default' }, { id: 'save', label: 'B', variant: 'primary' }] });
    const cancelBtn = screen.getByTestId('dialog-action-cancel');
    expect(cancelBtn.className).toContain('md-dialog-action-default');
  });
});

describe('ConfirmDialog — 키보드/백드롭 → cancel (REQ-002, 016)', () => {
  it('onAction 콜백이 액션 id로 호출된다', () => {
    const onAction = vi.fn();
    renderDialog({ onAction });
    fireEvent.click(screen.getByTestId('dialog-action-save'));
    expect(onAction).toHaveBeenCalledWith('save');
  });

  it('Escape 키는 onAction("cancel")을 emit한다', () => {
    const onAction = vi.fn();
    renderDialog({ onAction });
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onAction).toHaveBeenCalledWith('cancel');
  });

  it('백드롭 클릭은 onAction("cancel")을 emit한다', () => {
    const onAction = vi.fn();
    renderDialog({ onAction });
    fireEvent.click(screen.getByTestId('confirm-dialog-backdrop'));
    expect(onAction).toHaveBeenCalledWith('cancel');
  });

  it('패널 클릭은 onAction을 트리거하지 않는다 (이벤트 버블링 차단)', () => {
    const onAction = vi.fn();
    renderDialog({ onAction });
    fireEvent.click(screen.getByRole('dialog'));
    expect(onAction).not.toHaveBeenCalled();
  });
});

describe('ConfirmDialog — 포커스 트랩 + 복귀 (REQ-004)', () => {
  it('열릴 때 마지막 액션 버튼이 초기 포커스를 갖는다', () => {
    renderDialog();
    const saveBtn = screen.getByTestId('dialog-action-save');
    expect(document.activeElement).toBe(saveBtn);
  });

  it('Tab 순환: 마지막에서 Tab을 누르면 첫 버튼으로 돌아간다', () => {
    renderDialog();
    const cancel = screen.getByTestId('dialog-action-cancel');
    const save = screen.getByTestId('dialog-action-save');
    save.focus();
    expect(document.activeElement).toBe(save);
    fireEvent.keyDown(save, { key: 'Tab' });
    expect(document.activeElement).toBe(cancel);
  });

  it('Shift+Tab 순환: 첫 버튼에서 Shift+Tab을 누르면 마지막으로 간다', () => {
    renderDialog();
    const cancel = screen.getByTestId('dialog-action-cancel');
    const save = screen.getByTestId('dialog-action-save');
    cancel.focus();
    fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(save);
  });

  it('닫힐 때 다이얼로그를 연 트리거로 포커스가 복귀한다', () => {
    const trigger = document.createElement('button');
    trigger.textContent = '트리거';
    trigger.dataset.testid = 'trigger';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { rerender } = renderDialog({ open: true });
    // 열림 → 포커스가 마지막 버튼으로 이동
    expect(document.activeElement).toBe(screen.getByTestId('dialog-action-save'));

    rerender(
      <ConfirmDialog
        open={false}
        title="미저장 변경"
        message="x"
        actions={baseActions}
        onAction={vi.fn()}
      />
    );
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });
});

describe('ConfirmDialog — INV-3 cancel 강제 (REQ-036)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('개발 빌드에서 cancel id가 없으면 콘솔 오류를 출력한다', () => {
    vi.stubGlobal('DEV_ENV_FLAG', true);
    // import.meta.env.DEV는 vitest에서 기본 true
    renderDialog({ actions: [{ id: 'ok', label: '확인', variant: 'primary' }] });
    expect(console.error).toHaveBeenCalled();
  });

  it('cancel id가 정확히 하나 있으면 콘솔 오류가 없다', () => {
    renderDialog({ actions: [{ id: 'cancel', label: '취소' }, { id: 'save', label: '저장', variant: 'primary' }] });
    expect(console.error).not.toHaveBeenCalled();
  });
});
