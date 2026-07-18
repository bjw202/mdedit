import React from 'react';
import { colors, font, fontSize, layout, radius, shadow, space } from '../tokens';

/** View mode matches the app's real segmented toggle labels (docs/USER_GUIDE.md §1.3). */
export type ViewMode = 'edit' | 'split' | 'preview';

export interface HeaderBarProps {
  filename?: string;
  isDirty?: boolean;
  viewMode?: ViewMode;
  /** Extra content rendered in place of the mode-toggle segment (e.g. a highlighted demo state). */
  modeToggleSlot?: React.ReactNode;
  imageModeOn?: boolean;
}

/**
 * Fixed per-button width for the mode-toggle segment. The real app's segment
 * widths auto-size to their (Korean) label text, which cannot be measured
 * from plain interpolation math without a live DOM — so this reproduction
 * fixes each segment to one deterministic width (comfortably fitting the
 * longest label, "미리보기") instead. This turns "click lands on the real
 * button" from a guessed-pixel problem into exact arithmetic — see
 * `modeToggleButtonCenters()` below, used by scenes for CursorPointer targets.
 */
export const MODE_TOGGLE_BTN_WIDTH = 78;
const MODE_TOGGLE_BTN_HEIGHT = 26;
const MODE_TOGGLE_BTN_GAP = 2;
const MODE_TOGGLE_PADDING = 2;

const MODE_TOGGLE_OPTIONS: Array<{ key: ViewMode; label: string }> = [
  { key: 'edit', label: '편집' },
  { key: 'split', label: '분할' },
  { key: 'preview', label: '미리보기' },
];

function SegmentedModeToggle({ viewMode = 'split' }: { viewMode?: ViewMode }): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        background: colors.surface,
        borderRadius: radius.sm,
        padding: MODE_TOGGLE_PADDING,
        gap: MODE_TOGGLE_BTN_GAP,
      }}
    >
      {MODE_TOGGLE_OPTIONS.map((o) => {
        const active = o.key === viewMode;
        return (
          <div
            key={o.key}
            style={{
              width: MODE_TOGGLE_BTN_WIDTH,
              height: MODE_TOGGLE_BTN_HEIGHT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.sm,
              fontSize: fontSize.toolbar,
              color: active ? colors.accentContrast : colors.textMuted,
              background: active ? colors.accent : 'transparent',
            }}
          >
            {o.label}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Screen-space centers of the header's three mode-toggle buttons, computed
 * from the header's real layout constants (padding, gaps, icon sizes) rather
 * than guessed from rendered text width. `frameWidth` is the AppFrame's own
 * width (default 1600, matching every scene's AppFrame usage) — the toggle
 * group is right-aligned via the header's `justify-content: space-between`.
 */
export function modeToggleButtonCenters(
  frameWidth: number = 1600,
): Record<ViewMode, { x: number; y: number }> {
  const headerPaddingX = space[4]; // HeaderBar `padding: 0 ${space[4]}px`
  const groupGap = space[3]; // HeaderBar right-group `gap: space[3]`
  const dividerWidth = 1;
  const iconWidth = 16; // ImageModeIcon / GearIcon are 16x16
  const toggleWidth = MODE_TOGGLE_OPTIONS.length * MODE_TOGGLE_BTN_WIDTH +
    (MODE_TOGGLE_OPTIONS.length - 1) * MODE_TOGGLE_BTN_GAP +
    2 * MODE_TOGGLE_PADDING;
  // Right group: [toggle, divider, imageIcon, gearIcon] — 3 gaps between 4 items.
  const rightGroupWidth = toggleWidth + dividerWidth + iconWidth + iconWidth + 3 * groupGap;
  const groupLeft = frameWidth - headerPaddingX - rightGroupWidth;
  const toggleLeft = groupLeft + MODE_TOGGLE_PADDING;
  const y = layout.headerHeight / 2;

  const centers = {} as Record<ViewMode, { x: number; y: number }>;
  let cursor = toggleLeft;
  for (const o of MODE_TOGGLE_OPTIONS) {
    centers[o.key] = { x: cursor + MODE_TOGGLE_BTN_WIDTH / 2, y };
    cursor += MODE_TOGGLE_BTN_WIDTH + MODE_TOGGLE_BTN_GAP;
  }
  return centers;
}

function GearIcon(): JSX.Element {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ImageModeIcon(): JSX.Element {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M21 16l-5.5-5.5L9 17" />
    </svg>
  );
}

/** Header reproduction (real component: src/components/layout/Header.tsx, .md-titlebar). */
export function HeaderBar({
  filename = 'Untitled.md',
  isDirty = false,
  viewMode = 'split',
  modeToggleSlot,
  imageModeOn = false,
}: HeaderBarProps): JSX.Element {
  return (
    <header
      style={{
        height: layout.headerHeight,
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${space[4]}px`,
        background: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        fontFamily: font.ui,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
        <span
          style={{
            fontFamily: font.display,
            fontSize: fontSize.wordmark,
            fontWeight: 600,
            color: colors.textPrimary,
          }}
        >
          mdedit
        </span>
        <span style={{ width: 1, height: 20, background: colors.border }} />
        <span style={{ fontSize: fontSize.titlebar, color: colors.textMuted }}>
          {filename}
          {isDirty && (
            <span
              style={{
                display: 'inline-block',
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: colors.dirty,
                marginLeft: space[2],
              }}
            />
          )}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
        {modeToggleSlot ?? <SegmentedModeToggle viewMode={viewMode} />}
        <span style={{ width: 1, height: 20, background: colors.border }} />
        <span style={{ color: imageModeOn ? colors.accent : colors.textMuted }}>
          <ImageModeIcon />
        </span>
        <span style={{ color: colors.textMuted }}>
          <GearIcon />
        </span>
      </div>
    </header>
  );
}

/**
 * A single listing entry (one directory level). NOTE on the real navigation
 * model (verified against src/components/sidebar/FileExplorer.tsx +
 * FileTreeNode.tsx and docs/USER_GUIDE.md §2.5): clicking a folder row does
 * NOT expand it inline — it calls `openFolderPath()`, which replaces the
 * *entire* listing with that folder's contents (like a native file-open
 * dialog / Explorer/Finder single-pane view). There is no nesting/depth or
 * expand chevron in the rendered tree; each listing is always one flat level.
 */
export interface FileExplorerRow {
  name: string;
  type: 'folder' | 'file';
}

/** Default listing shown when no scene explicitly wires up a navigation flow (S2b owns that). */
export const defaultFolderName = '프로젝트';
export const defaultExplorerRows: FileExplorerRow[] = [
  { name: '회의록.md', type: 'file' },
  { name: '블로그-초안.md', type: 'file' },
  { name: '아이디어.md', type: 'file' },
  { name: 'images', type: 'folder' },
];

function FolderIcon({ color }: { color: string }): JSX.Element {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} style={{ flex: 'none' }}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}

function FileIcon(): JSX.Element {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth={1.5} style={{ flex: 'none' }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

/** Small icon-button pair reproduction (Change Folder / Refresh, real: `.md-icon-btn` in FileExplorer.tsx head). */
function ChangeFolderIcon(): JSX.Element {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth={2}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      <path d="M12 11v4m0 0l-2-2m2 2l2-2" />
    </svg>
  );
}

function RefreshIcon(): JSX.Element {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth={2}>
      <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15" />
    </svg>
  );
}

export interface FileExplorerProps {
  /** Current directory's display name, shown in the sidebar head (real: `.md-sidebar-head` folder name). */
  folderName?: string;
  /** Flat listing of the current directory's contents (one level — see FileExplorerRow doc). */
  rows?: FileExplorerRow[];
  /** Shows the ".." parent-directory row at the top of the listing (real: canGoUp / handleGoUp). */
  canGoUp?: boolean;
  /** Currently-open file's name, highlighted in the listing. */
  selected?: string;
}

/**
 * File explorer reproduction — navigation model (real component:
 * src/components/sidebar/FileExplorer.tsx, .md-sidebar / .md-sidebar-head / .md-tree).
 * Folder rows navigate (the whole listing swaps to that folder's contents);
 * a ".." row at the top navigates back up. See FileExplorerRow doc above.
 */
export function FileExplorer({
  folderName = defaultFolderName,
  rows = defaultExplorerRows,
  canGoUp = true,
  selected,
}: FileExplorerProps): JSX.Element {
  return (
    <div
      style={{
        width: layout.sidebarWidth,
        flex: 'none',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: colors.surface,
        borderRight: `1px solid ${colors.border}`,
        fontFamily: font.ui,
      }}
    >
      {/* Folder head: name + Change Folder + Refresh (real: .md-sidebar-head) */}
      <div
        style={{
          flex: 'none',
          height: layout.sidebarHeadHeight,
          display: 'flex',
          alignItems: 'center',
          gap: space[2],
          padding: `0 ${space[2]}px`,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <FolderIcon color={colors.accent} />
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: fontSize.tree,
            color: colors.textPrimary,
          }}
        >
          {folderName}
        </span>
        <span style={{ flex: 'none', display: 'flex' }}>
          <ChangeFolderIcon />
        </span>
        <span style={{ flex: 'none', display: 'flex' }}>
          <RefreshIcon />
        </span>
      </div>
      {/* Listing: optional ".." parent row, then this directory's rows (real: .md-tree) */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: space[2] }}>
        {canGoUp && (
          <div
            style={{
              height: layout.treeRowHeight,
              display: 'flex',
              alignItems: 'center',
              gap: space[2],
              paddingLeft: space[3],
              paddingRight: space[2],
              borderRadius: radius.sm,
              fontSize: fontSize.tree,
              color: colors.textPrimary,
            }}
          >
            <FolderIcon color={colors.accent} />
            <span>..</span>
          </div>
        )}
        {rows.map((row) => {
          const isSelected = selected === row.name;
          return (
            <div
              key={row.name}
              style={{
                height: layout.treeRowHeight,
                display: 'flex',
                alignItems: 'center',
                gap: space[2],
                paddingLeft: space[3],
                paddingRight: space[2],
                borderRadius: radius.sm,
                fontSize: fontSize.tree,
                color: colors.textPrimary,
                background: isSelected ? colors.accentSoft : 'transparent',
              }}
            >
              {row.type === 'folder' ? <FolderIcon color={colors.textMuted} /> : <FileIcon />}
              <span>{row.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface AppFrameProps {
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
  width?: number;
  height?: number;
}

/**
 * Full app window reproduction: rounded window chrome + macOS traffic lights,
 * HeaderBar, FileExplorer sidebar, and a main content area for editor/preview panes.
 */
export function AppFrame({
  header,
  sidebar,
  children,
  width = 1600,
  height = 900,
}: AppFrameProps): JSX.Element {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: layout.windowRadius,
        overflow: 'hidden',
        boxShadow: shadow.lg,
        border: `1px solid ${colors.borderStrong}`,
        display: 'flex',
        flexDirection: 'column',
        background: colors.bg,
      }}
    >
      {/* macOS traffic lights */}
      <div
        style={{
          position: 'absolute',
          marginTop: 14,
          marginLeft: 14,
          display: 'flex',
          gap: 8,
          zIndex: 2,
        }}
      >
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ed6a5e' }} />
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#f4bf4f' }} />
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#61c454' }} />
      </div>
      {header ?? <HeaderBar />}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        {sidebar ?? <FileExplorer />}
        <div style={{ flex: 1, display: 'flex', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
