// @MX:SPEC: SPEC-AI-017 REQ-AI17-008 REQ-AI17-009 D15
// @MX:NOTE: 미리보기에서 ⌥+클릭한 대상에 대한 지시 입력창. 대상 요약 한 줄 + 입력칸, 또는 안내문(notice)만 보인다.
// 한글 조합 중 Enter(isComposing 또는 keyCode 229)는 보내기로 치지 않는다(SPEC-AI-015 와 같은 처리).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fitAxisStart } from '@/lib/ui/menuPlacement';

export interface PointInstructionPopoverProps {
  /** 클릭한 화면 좌표(뷰포트 기준) */
  anchor: { x: number; y: number };
  /** 대상 요약 한 줄(열: … / 칸: … / 노드: …) */
  summary?: string;
  /** 있으면 입력칸 대신 이 안내문만 보인다(가리킬 수 없음·낡음) */
  notice?: string;
  /** 있으면 길이 안내를 보이고 보내기를 막는다(12,000자 초과) */
  lengthReason?: string;
  onSend: (instruction: string) => void;
  onClose: () => void;
}

const GAP = 8;

export function PointInstructionPopover({
  anchor,
  summary,
  notice,
  lengthReason,
  onSend,
  onClose,
}: PointInstructionPopoverProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState('');
  const [pos, setPos] = useState({ left: anchor.x, top: anchor.y + GAP });

  // 기존 flip+clamp 헬퍼(menuPlacement)로 뷰포트 안에 배치한다.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const size = { w: r.width, h: r.height };
    const left = fitAxisStart(anchor.x, anchor.x - size.w, size.w, 0, window.innerWidth);
    const top = fitAxisStart(anchor.y + GAP, anchor.y - size.h - GAP, size.h, 0, window.innerHeight);
    setPos({ left, top });
  }, [anchor.x, anchor.y, notice, lengthReason]);

  useEffect(() => {
    if (!notice) inputRef.current?.focus();
  }, [notice]);

  // 바깥 클릭·Esc 로 닫기 — 입력칸에 포커스가 없어도 동작하도록 문서에 건다.
  useEffect(() => {
    const onMouseDown = (e: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const trimmed = value.trim();
  const canSend = trimmed !== '' && !lengthReason;

  const send = (): void => {
    if (canSend) onSend(trimmed);
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    // @MX:WARN: isComposing 만으로 거르지 말 것 — 확정 Enter 의 keydown 에서 isComposing 이 거짓일 수 있어 keyCode 229 도 본다.
    // @MX:REASON: 한글 조합 확정 Enter 가 보내기로 오인되면 마지막 글자가 빠진 지시가 나간다(SPEC-AI-015).
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    send();
  };

  return createPortal(
    <div
      ref={rootRef}
      className="md-point-popover"
      role="dialog"
      style={{ position: 'fixed', left: pos.left, top: pos.top }}
    >
      {notice ? (
        <p className="md-point-popover__notice">{notice}</p>
      ) : (
        <>
          <div className="md-point-popover__summary">{summary}</div>
          {lengthReason && <p className="md-point-popover__length">{lengthReason}</p>}
          <textarea
            ref={inputRef}
            className="md-point-popover__input"
            rows={2}
            value={value}
            placeholder="어떻게 고칠까요?"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onInputKeyDown}
          />
          <button
            type="button"
            className="md-point-popover__send"
            disabled={!canSend}
            onClick={send}
          >
            보내기
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
