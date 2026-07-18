/**
 * mdedit video — design tokens
 *
 * Ported 1:1 (values, not references — Remotion renders outside a browser
 * that loads the app's own CSS) from the app's real design tokens so every
 * scene in this video reproduces the actual mdedit look.
 *
 * Source of truth in the app repo:
 *   - src/styles/mdedit-tokens.css   (color / typography / spacing / radius / shadow / motion)
 *   - src/styles/mdedit-fonts.css    (font-face declarations, vendored woff2 files)
 *   - src/styles/mdedit-components.css (component-level px values: header height, row heights, etc.)
 *   - src/store/uiStore.ts           (default sidebarWidth: 250)
 *
 * Theme choice: the app's `:root` selector (LIGHT) is the default theme —
 * `[data-theme="dark"]` is an opt-in override. This video uses LIGHT as the
 * default per STORYBOARD "전역 시각 언어" (app's actual default look).
 * Both palettes are kept below so later units can do a themed scene if needed.
 */

export const lightColors = {
  // src/styles/mdedit-tokens.css :root
  bg: '#f2f2f3', // app window ground
  surface: '#e9e9ea', // sidebar, status bar, toolbars
  surfaceRaised: '#fbfbfc', // editor field, menus, dialogs
  border: 'rgba(29, 31, 32, 0.16)',
  borderStrong: 'rgba(29, 31, 32, 0.28)',
  textPrimary: '#1d1f20',
  textMuted: '#5d5d60',
  textFaint: '#98989b',

  accent: '#5980a6', // steel-blue — the one accent
  accentHover: '#416180',
  accentActive: '#2c455d',
  accentSoft: '#eaf1f8',
  accentContrast: '#f2f2f3',

  danger: '#b0473c',
  dangerSoft: '#f7e7e5',
  success: '#4f7a54',
  dirty: '#c0863a',

  selection: 'rgba(89, 128, 166, 0.28)',
  codeBg: '#e9e9ea',
  dividerPane: 'rgba(29, 31, 32, 0.12)',

  // AI in-flight indicators (SPEC-AI-002)
  aiGlowFrom: '#8a63d2',
  aiGlowTo: '#5980a6',
  aiSkeletonBase: 'rgba(29, 31, 32, 0.08)',
  aiSkeletonShine: 'rgba(29, 31, 32, 0.16)',
} as const;

export const darkColors = {
  // src/styles/mdedit-tokens.css [data-theme="dark"]
  bg: '#191b1d',
  surface: '#212427',
  surfaceRaised: '#2b2f33',
  border: 'rgba(231, 231, 234, 0.14)',
  borderStrong: 'rgba(231, 231, 234, 0.26)',
  textPrimary: '#e7e7ea',
  textMuted: '#a4a6a9',
  textFaint: '#6f7275',

  accent: '#7ea6cd',
  accentHover: '#9ec0e2',
  accentActive: '#b5d2ef',
  accentSoft: 'rgba(126, 166, 205, 0.16)',
  accentContrast: '#14181c',

  danger: '#d97a6f',
  dangerSoft: 'rgba(217, 122, 111, 0.16)',
  success: '#7fae84',
  dirty: '#d9a75c',

  selection: 'rgba(126, 166, 205, 0.30)',
  codeBg: '#2b2f33',
  dividerPane: 'rgba(231, 231, 234, 0.12)',

  aiGlowFrom: '#a98ee0',
  aiGlowTo: '#7ea6cd',
  aiSkeletonBase: 'rgba(231, 231, 234, 0.08)',
  aiSkeletonShine: 'rgba(231, 231, 234, 0.18)',
} as const;

/** Default theme for this video — matches the app's `:root` (light). */
export const colors = lightColors;

export const shadow = {
  // light-mode values (src/styles/mdedit-tokens.css :root)
  sm: '0 1px 2px rgba(43, 43, 45, 0.14)',
  md: '0 4px 14px rgba(43, 43, 45, 0.16)',
  lg: '0 14px 40px rgba(43, 43, 45, 0.24)',
} as const;

export const font = {
  // src/styles/mdedit-fonts.css — vendored woff2, no CDN dependency in the app.
  // The video renders through Remotion/Chrome headless; system-ui fallbacks keep
  // it rendering correctly even without the woff2 files loaded, but we still
  // declare the same family stacks so a later unit can vendor the fonts here too.
  ui: '"Barlow", system-ui, sans-serif',
  display: '"Barlow Condensed", system-ui, sans-serif', // wordmark, headings
  mono: '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace',
} as const;

export const fontSize = {
  titlebar: 13,
  wordmark: 17,
  toolbar: 13,
  tree: 13,
  status: 11.5,
  editor: 15,
  preview: 16,
  previewH1: 30,
  previewH2: 24,
  previewH3: 19,
} as const;

export const lineHeight = {
  ui: 1.4,
  editor: 1.65,
  preview: 1.7,
} as const;

export const space = {
  // 4px base grid, Industry density 0.85x (src/styles/mdedit-tokens.css)
  1: 3,
  2: 7,
  3: 10,
  4: 14,
  5: 20,
  6: 28,
} as const;

export const radius = {
  sm: 3, // inputs, buttons, tree rows
  md: 5, // menus, cards
  lg: 8, // dialogs
} as const;

export const motion = {
  ease: 'cubic-bezier(0.2, 0, 0, 1)',
  durFast: 120,
  durBase: 180,
} as const;

/**
 * Concrete layout dimensions used for AppFrame reproduction.
 * Source: src/styles/mdedit-components.css (.md-titlebar height: 44px)
 *         src/store/uiStore.ts (sidebarWidth default: 250)
 * These are NOT CSS variables in the app (the panels are user-resizable),
 * but they are the app's real *default* values — used here so the video
 * reproduces the app's first-launch appearance.
 */
export const layout = {
  headerHeight: 44,
  sidebarWidth: 250,
  treeRowHeight: 26,
  /**
   * Sidebar folder-header row (real component: src/components/sidebar/FileExplorer.tsx
   * `.md-sidebar-head` — folder icon + name + Change Folder + Refresh buttons).
   * Not a literal CSS variable in the app (row auto-sizes to content), but a
   * reasonable fixed height for this video's reproduction.
   */
  sidebarHeadHeight: 32,
  toolbarHeight: 30,
  statusBarHeight: 26,
  windowRadius: 10, // video-only chrome polish, not an app token
} as const;

export type Colors = typeof colors;
