import { useUIStore } from '@/store/uiStore';
import type { SaveStatus } from '@/store/uiStore';
import { CheckCircleIcon, CircleIcon } from '@/components/icons';

interface FooterProps {
  lineCount?: number;
  cursorLine?: number;
  cursorCol?: number;
  encoding?: string;
  saveStatus?: SaveStatus;
  wordCount?: number;
  charCount?: number;
  scrollSyncEnabled?: boolean;
  onScrollSyncToggle?: () => void;
}

function getSaveStatusLabel(status: SaveStatus): string {
  switch (status) {
    case 'new': return 'New';
    case 'saved': return 'Saved';
    case 'unsaved': return 'Unsaved';
    case 'saving': return 'Saving...';
  }
}

// @MX:NOTE: [AUTO] SPEC-UI-006 — .md-status-item 상태 modifier 클래스(.saved/.dirty) 매핑.
// 'saving'/'new' 상태는 modifier 없이 기본 --md-text-muted 색을 사용한다(토큰 매핑 표에 정의된
// 두 상태만 전용 색을 가짐). 판정 로직(saveStatus 값 자체)은 무변경.
function getSaveStatusClass(status: SaveStatus): string {
  switch (status) {
    case 'saved': return 'saved';
    case 'unsaved': return 'dirty';
    case 'new':
    case 'saving':
      return '';
  }
}

function getSaveStatusIcon(status: SaveStatus): JSX.Element {
  return status === 'saved' ? <CheckCircleIcon /> : <CircleIcon />;
}

// @MX:NOTE: Status bar footer - displays line count, cursor position, file encoding,
// save status, word/char counts, and scroll sync toggle
export function Footer({
  lineCount = 0,
  cursorLine = 1,
  cursorCol = 1,
  encoding = 'UTF-8',
  saveStatus = 'new',
  wordCount = 0,
  charCount = 0,
  scrollSyncEnabled = true,
  onScrollSyncToggle,
}: FooterProps): JSX.Element {
  // SPEC-UI-005: Footer 가 useUIStore.statusMessage 를 직접 구독 (prop drilling 없음).
  const statusMessage = useUIStore((s) => s.statusMessage);

  return (
    <footer className="md-statusbar">
      <span className={`md-status-item ${getSaveStatusClass(saveStatus)}`}>
        {getSaveStatusIcon(saveStatus)}
        {getSaveStatusLabel(saveStatus)}
      </span>
      <span className="md-status-sep" />
      <span>Lines: {lineCount}</span>
      <span className="md-status-sep" />
      <span>{wordCount} words</span>
      <span className="md-status-sep" />
      <span>{charCount} chars</span>
      {/* @MX:NOTE: [AUTO] 트랜지언트 피드백 메시지 채널 (SPEC-UI-005). clipboard 복사 성공/실패 등 짧은 알림. */}
      {/* @MX:SPEC: SPEC-UI-005 */}
      {statusMessage && (
        <span
          className="truncate max-w-xs"
          style={{ color: 'var(--md-accent)' }}
          role="status"
          aria-live="polite"
        >
          {statusMessage}
        </span>
      )}
      <span className="md-status-spacer" />
      {onScrollSyncToggle !== undefined && (
        <button
          type="button"
          role="button"
          aria-label="Scroll Sync"
          aria-pressed={scrollSyncEnabled}
          onClick={onScrollSyncToggle}
          className={`md-status-toggle ${scrollSyncEnabled ? 'is-active' : ''}`}
        >
          Sync
        </button>
      )}
      <span>Ln {cursorLine}, Col {cursorCol}</span>
      <span>{encoding}</span>
    </footer>
  );
}
