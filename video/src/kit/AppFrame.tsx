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

function SegmentedModeToggle({ viewMode = 'split' }: { viewMode?: ViewMode }): JSX.Element {
  const options: Array<{ key: ViewMode; label: string }> = [
    { key: 'edit', label: '편집' },
    { key: 'split', label: '분할' },
    { key: 'preview', label: '미리보기' },
  ];
  return (
    <div
      style={{
        display: 'flex',
        background: colors.surface,
        borderRadius: radius.sm,
        padding: 2,
        gap: 2,
      }}
    >
      {options.map((o) => {
        const active = o.key === viewMode;
        return (
          <div
            key={o.key}
            style={{
              height: 26,
              padding: `0 ${space[3]}px`,
              display: 'flex',
              alignItems: 'center',
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

export interface ExplorerNode {
  name: string;
  type: 'folder' | 'file';
  children?: ExplorerNode[];
  open?: boolean;
}

/** A reasonable default sample tree, matching artifacts referenced across the storyboard. */
export const defaultExplorerTree: ExplorerNode[] = [
  {
    name: 'docs',
    type: 'folder',
    open: true,
    children: [
      { name: '회의록.md', type: 'file' },
      { name: '블로그-초안.md', type: 'file' },
      { name: '스크린샷.png', type: 'file' },
    ],
  },
  { name: 'README.md', type: 'file' },
];

function ExplorerRows({
  nodes,
  depth,
  selected,
}: {
  nodes: ExplorerNode[];
  depth: number;
  selected?: string;
}): JSX.Element {
  return (
    <>
      {nodes.map((node) => {
        const isSelected = selected === node.name;
        return (
          <React.Fragment key={node.name}>
            <div
              style={{
                height: layout.treeRowHeight,
                display: 'flex',
                alignItems: 'center',
                gap: space[2],
                paddingLeft: space[3] + depth * 16,
                paddingRight: space[2],
                borderRadius: radius.sm,
                fontSize: fontSize.tree,
                color: colors.textPrimary,
                background: isSelected ? colors.accentSoft : 'transparent',
              }}
            >
              {node.type === 'folder' ? (
                <>
                  <svg
                    width={13}
                    height={13}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.textFaint}
                    strokeWidth={2}
                    style={{ transform: node.open ? 'rotate(90deg)' : 'none', flex: 'none' }}
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth={1.5} style={{ flex: 'none' }}>
                    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                  </svg>
                </>
              ) : (
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth={1.5} style={{ marginLeft: 13, flex: 'none' }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
              )}
              <span>{node.name}</span>
            </div>
            {node.type === 'folder' && node.open && node.children && (
              <ExplorerRows nodes={node.children} depth={depth + 1} selected={selected} />
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}

export interface FileExplorerProps {
  tree?: ExplorerNode[];
  selected?: string;
}

/** File tree reproduction (real component: src/components/sidebar/FileExplorer.tsx, .md-sidebar). */
export function FileExplorer({ tree = defaultExplorerTree, selected }: FileExplorerProps): JSX.Element {
  return (
    <div
      style={{
        width: layout.sidebarWidth,
        flex: 'none',
        minHeight: 0,
        overflow: 'auto',
        background: colors.surface,
        borderRight: `1px solid ${colors.border}`,
        padding: space[2],
        fontFamily: font.ui,
      }}
    >
      <ExplorerRows nodes={tree} depth={0} selected={selected} />
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
