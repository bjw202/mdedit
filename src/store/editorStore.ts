import { create } from 'zustand';

// @MX:ANCHOR: [AUTO] Central editor state store - shared by MarkdownEditor, EditorToolbar, Footer
// @MX:REASON: [AUTO] Public API boundary - used by MarkdownEditor, EditorToolbar, Footer cursor display (fan_in >= 3)
// @MX:SPEC: SPEC-EDITOR-001

export interface EditorState {
  /** Current document content in the editor */
  content: string;
  /** Current cursor line number (1-based) */
  cursorLine: number;
  /** Current cursor column number (1-based) */
  cursorCol: number;
  /** Whether the document has unsaved changes */
  dirty: boolean;
  /** Absolute path to the currently open file, or null if no file is open */
  currentFilePath: string | null;
  // Actions
  setContent: (content: string) => void;
  setCursor: (line: number, col: number) => void;
  setDirty: (dirty: boolean) => void;
  setCurrentFilePath: (path: string | null) => void;
  resetEditor: () => void;
}

const initialState = {
  content: '',
  cursorLine: 1,
  cursorCol: 1,
  dirty: false,
  currentFilePath: null,
};

export const useEditorStore = create<EditorState>()((set) => ({
  ...initialState,
  setContent: (content: string) => set({ content }),
  setCursor: (line: number, col: number) => set({ cursorLine: line, cursorCol: col }),
  setDirty: (dirty: boolean) => set({ dirty }),
  setCurrentFilePath: (path: string | null) => set({ currentFilePath: path }),
  resetEditor: () => set({ ...initialState }),
}));
