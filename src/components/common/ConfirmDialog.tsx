// @MX:ANCHOR: [AUTO] 재사용 확인 다이얼로그 — 미저장 변경 가드 + 워처 충돌 모달 + SPEC-EXPORT-002 소비
// @MX:REASON: [AUTO] 공개 계약(DialogActionVariant/DialogAction/ConfirmDialogProps)은 SPEC-EXPORT-002가
//   동일 컴포넌트를 소비하므로 동결. fan_in >= 2(본 SPEC 가드 + EXPORT-002). 계약 변경 금지.
// @MX:SPEC: SPEC-FS-003

import { useEffect, useRef } from 'react';

// @MX:NOTE: [AUTO] 계약 불변식 INV-1/2/3 — spec.md "ConfirmDialog Contract" 참조.
//   INV-1: 마지막 항목이 variant:'danger'여도 초기 포커스는 위치 규칙(마지막)이 따르되
//          시각 스타일은 variant가 이긴다(danger로 렌더).
//   INV-2: 'default'는 variant 생략과 동일(중립 스타일).
//   INV-3: 'cancel' id 항목 정확히 1개 필수 — Escape/백드롭이 'cancel'을 emit하므로
//          이 항목이 없으면 무음 실패. 개발 빌드에서 console.error로 강제(REQ-036).

/** 액션 시각 변형. 'primary'(기본 강조) | 'danger'(파괴적) | 'default'(중립, 생략과 동일). */
export type DialogActionVariant = 'primary' | 'danger' | 'default';

/** 다이얼로그 액션 정의. actions 배열 순서대로 좌→우 렌더, 마지막 항목이 primary/초기 포커스. */
export interface DialogAction {
  id: string;
  label: string;
  variant?: DialogActionVariant;
}

/** ConfirmDialog props 계약 (FROZEN — SPEC-EXPORT-002 공유). */
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  actions: DialogAction[];
  onAction: (id: string) => void;
}

/** variant → CSS 클래스 매핑 (스타일은 mdedit-components.css .md-dialog-action-*). */
function variantClass(variant: DialogActionVariant | undefined): string {
  // INV-2: undefined와 'default'는 동일 중립 스타일
  if (variant === 'primary') return 'md-dialog-action md-dialog-action-primary';
  if (variant === 'danger') return 'md-dialog-action md-dialog-action-danger';
  return 'md-dialog-action md-dialog-action-default';
}

/**
 * 재사용 확인 다이얼로그. SettingsModal 패턴을 일반화.
 * - 백드롭 + role="dialog" + aria-modal="true"
 * - actions 배열 순서대로 좌→우 버튼, 마지막 항목 = primary + 초기 포커스
 * - Escape / 백드롭 클릭 → onAction('cancel')
 * - Tab/Shift+Tab 포커스 트랩, 닫힘 시 트리거로 포커스 복귀
 */
export function ConfirmDialog({ open, title, message, actions, onAction }: ConfirmDialogProps): JSX.Element | null {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // INV-3 강제 (REQ-036) — 개발 빌드에서만. 프로덕션(import.meta.env.PROD)에서는 미수행.
  useEffect(() => {
    if (!open) return;
    if (import.meta.env.DEV) {
      const cancelCount = actions.filter((a) => a.id === 'cancel').length;
      if (cancelCount !== 1) {
        console.error(
          `[ConfirmDialog] 계약 위반(INV-3): actions에 id === 'cancel' 항목이 정확히 하나 필요합니다 (현재 ${cancelCount}개). ` +
            `Escape·백드롭이 'cancel'을 emit하므로 이 항목이 없으면 무음 실패합니다.`
        );
      }
    }
  }, [open, actions]);

  // 열림 → 트리거 저장 + 마지막 액션 포커스. 닫힘 → 트리거로 복귀.
  useEffect(() => {
    if (!open) {
      // 닫힘 전환 시 트리거 복귀 (단, 이전에 열렸었을 때만)
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
      return;
    }
    // 열림: 현재 포커스(트리거) 저장
    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body) {
      previousFocusRef.current = active;
    }
    // 마지막 액션 버튼에 포커스 (REQ-003, INV-1 — 위치 규칙)
    const panel = panelRef.current;
    if (panel) {
      const buttons = panel.querySelectorAll<HTMLButtonElement>('[data-testid^="dialog-action-"]');
      const last = buttons[buttons.length - 1];
      if (last) last.focus();
    }
  }, [open]);

  // Escape는 document 레벨 리스너로 처리 (SettingsModal 선례와 동일).
  // 패널 onKeyDown은 Tab 트랩 전용 — Escape는 포커스 위치와 무관하게 동작해야 한다.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onAction('cancel');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onAction]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const buttons = Array.from(panel.querySelectorAll<HTMLButtonElement>('[data-testid^="dialog-action-"]'));
    if (buttons.length === 0) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (e.shiftKey) {
      // Shift+Tab: 첫 버튼에서 마지막으로 순환
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab: 마지막 버튼에서 첫 버튼으로 순환
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div
      className="md-dialog-backdrop"
      data-testid="confirm-dialog-backdrop"
      onClick={() => onAction('cancel')}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="md-dialog"
        data-testid="confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h2 className="md-dialog-title">{title}</h2>
        <div className="md-dialog-message">{message}</div>
        <div className="md-dialog-actions">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className={variantClass(action.variant)}
              data-testid={`dialog-action-${action.id}`}
              onClick={() => onAction(action.id)}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
