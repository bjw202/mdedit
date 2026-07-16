// @MX:ANCHOR: [AUTO] createMarkdownExtensions - CodeMirror 6 extension bundle for Markdown editor
// @MX:REASON: [AUTO] Called by MarkdownEditor on initialization; provides the complete extension set (fan_in >= 3)
// @MX:NOTE: Markdown-specific CodeMirror 6 extension bundle
// Aggregates all Markdown-related extensions into a single composable array

import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { lineNumbers, highlightActiveLine, drawSelection, EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { searchKeymap } from '@codemirror/search';
import { indentWithTab } from '@codemirror/commands';
import { Compartment } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { markdownSyntaxHighlighting } from './syntax-highlighting';
import { markdownKeyboardShortcuts } from './keyboard-shortcuts';
import { imageWidgetExtension } from './image-widget';
import { createAiGhostText } from './ai-ghost-text';
import { createAiSelectionToolbar } from './ai-selection-toolbar';
import { createAiSuggestionCard, getAiLoggedIn, openOnboarding } from './ai-suggestion-card';
import { useUIStore } from '@/store/uiStore';

// @MX:ANCHOR: [AUTO] cursorCompartment - dynamic cursor theme swapped on dark/light mode change
// @MX:REASON: [AUTO] CSS variable cascade is unreliable with CodeMirror scoped themes; Compartment is the canonical CM6 approach (fan_in >= 2)
/** Compartment for dynamic cursor color — reconfigured by MarkdownEditor when theme changes */
export const cursorCompartment = new Compartment();

/** Compartment for dynamic font size — reconfigured by MarkdownEditor when user changes font size */
export const fontSizeCompartment = new Compartment();

/** Returns a CodeMirror theme extension with the given font size. */
export function createFontSizeTheme(fontSize: number): Extension {
  return EditorView.theme({
    '&': { fontSize: `${fontSize}px` },
  });
}

/**
 * Returns a CodeMirror theme extension with the correct cursor color for the given mode.
 * Using direct color values (not CSS variables) avoids scoped-theme cascade ambiguity.
 */
export function createCursorTheme(isDark: boolean): Extension {
  const color = isDark ? '#ffffff' : '#111827';
  return EditorView.theme({
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: color,
    },
  });
}

/**
 * Base editor theme providing word wrap and minimal styling.
 * The outer container height is managed by the parent component.
 */
export const editorBaseTheme: Extension = EditorView.theme({
  '&': {
    height: '100%',
    color: 'var(--cm-base-text)',  // Base text color: black in light mode, light gray in dark mode
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
  },
  '.cm-content': {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    caretColor: 'var(--cm-cursor-color)',  // Controls native browser caret color in WKWebView
  },
  '.cm-line': {
    padding: '0 8px',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--cm-active-line)',  // Subtle tint: works in both light and dark mode
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--cm-active-line)',  // Matches active line
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#858585',
  },
});

/**
 * Returns the complete set of CodeMirror 6 extensions for the Markdown editor.
 * Includes: Markdown language with nested code block support, line numbers,
 * active line highlight, word wrap, syntax highlighting, keyboard shortcuts,
 * history (undo/redo), default keymap, search keymap.
 */
export function createMarkdownExtensions(): Extension[] {
  return [
    // Markdown language with GFM support
    markdown({
      base: markdownLanguage,
    }),

    // Editor chrome
    lineNumbers(),
    highlightActiveLine(),
    drawSelection(),  // Required: draws custom .cm-cursor divs and hides native caret

    // Word wrap via EditorView.lineWrapping
    EditorView.lineWrapping,

    // Syntax highlighting (VS Code style)
    markdownSyntaxHighlighting(),

    // Custom Markdown keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+/)
    markdownKeyboardShortcuts(),

    // AI 섹션 채우기 고스트 (SPEC-AI-001): 내부적으로 Prec.high(keymap)을 써서 Mod-Enter/Esc가
    // 아래의 indentWithTab·defaultKeymap보다 앞서도록 한다. Tab은 바인딩하지 않아 들여쓰기가 유지되고
    // 고스트는 docChanged로 소멸한다(REQ-AI-031). 반드시 기본 keymap.of 앞에 위치시킨다.
    createAiGhostText(),

    // History extension for undo/redo
    history(),

    // Default keymap (includes standard editing keys)
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),

    // Image widget decoration (data URI images → thumbnail widgets)
    imageWidgetExtension(),

    // AI 선택 툴바 (SPEC-AI-001 T-012): 선택 시 선택 끝에 ✨ 버튼. 로그인/고급모델은 런타임 조회
    // (getAiLoggedIn 캐시 + uiStore.aiAdvancedModel), 미로그인 클릭은 온보딩(설정)으로 유도.
    createAiSelectionToolbar({
      getUiState: () => ({
        loggedIn: getAiLoggedIn(),
        advancedModel: useUIStore.getState().aiAdvancedModel === true,
      }),
      onConnectNeeded: () => openOnboarding(),
    }),

    // AI 제안 카드 (SPEC-AI-001 T-013/016): 활성 카드 컨트롤러(싱글턴)를 원문 아래 block widget 으로.
    createAiSuggestionCard(),

    // Base theme
    editorBaseTheme,

    // Cursor color (managed via Compartment; reconfigured on theme change by MarkdownEditor)
    cursorCompartment.of(createCursorTheme(document.documentElement.classList.contains('dark'))),

    // Font size (managed via Compartment; reconfigured on fontSize change by MarkdownEditor)
    fontSizeCompartment.of(createFontSizeTheme(14)),
  ];
}
