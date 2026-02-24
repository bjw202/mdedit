import { describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import { useEditorStore } from '@/store/editorStore';

/**
 * SPEC-EDITOR-001: editorStore specification tests
 *
 * Verifies the Zustand editor state management store
 * satisfies all requirements from SPEC-EDITOR-001.
 */

describe('editorStore: Initial State', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useEditorStore.setState({
      content: '',
      cursorLine: 1,
      cursorCol: 1,
      dirty: false,
      currentFilePath: null,
    });
  });

  it('should have empty content by default', () => {
    const state = useEditorStore.getState();
    expect(state.content).toBe('');
  });

  it('should have cursor at line 1, col 1 by default', () => {
    const state = useEditorStore.getState();
    expect(state.cursorLine).toBe(1);
    expect(state.cursorCol).toBe(1);
  });

  it('should not be dirty by default', () => {
    const state = useEditorStore.getState();
    expect(state.dirty).toBe(false);
  });

  it('should have null currentFilePath by default', () => {
    const state = useEditorStore.getState();
    expect(state.currentFilePath).toBeNull();
  });
});

describe('editorStore: setContent action', () => {
  beforeEach(() => {
    useEditorStore.setState({
      content: '',
      cursorLine: 1,
      cursorCol: 1,
      dirty: false,
      currentFilePath: null,
    });
  });

  it('should update content when setContent is called', () => {
    const { setContent } = useEditorStore.getState();
    act(() => setContent('# Hello World'));
    expect(useEditorStore.getState().content).toBe('# Hello World');
  });

  it('should accept empty string', () => {
    const { setContent } = useEditorStore.getState();
    act(() => setContent('some content'));
    act(() => setContent(''));
    expect(useEditorStore.getState().content).toBe('');
  });

  it('should accept multiline content', () => {
    const { setContent } = useEditorStore.getState();
    const multiline = '# Title\n\nParagraph one.\n\nParagraph two.';
    act(() => setContent(multiline));
    expect(useEditorStore.getState().content).toBe(multiline);
  });
});

describe('editorStore: setCursor action', () => {
  beforeEach(() => {
    useEditorStore.setState({
      content: '',
      cursorLine: 1,
      cursorCol: 1,
      dirty: false,
      currentFilePath: null,
    });
  });

  it('should update cursor line and column', () => {
    const { setCursor } = useEditorStore.getState();
    act(() => setCursor(5, 12));
    const state = useEditorStore.getState();
    expect(state.cursorLine).toBe(5);
    expect(state.cursorCol).toBe(12);
  });

  it('should update only the cursor position without affecting other state', () => {
    useEditorStore.setState({ content: '# Hello', dirty: true });
    const { setCursor } = useEditorStore.getState();
    act(() => setCursor(2, 3));
    const state = useEditorStore.getState();
    expect(state.content).toBe('# Hello');
    expect(state.dirty).toBe(true);
    expect(state.cursorLine).toBe(2);
    expect(state.cursorCol).toBe(3);
  });
});

describe('editorStore: setDirty action', () => {
  beforeEach(() => {
    useEditorStore.setState({
      content: '',
      cursorLine: 1,
      cursorCol: 1,
      dirty: false,
      currentFilePath: null,
    });
  });

  it('should set dirty to true', () => {
    const { setDirty } = useEditorStore.getState();
    act(() => setDirty(true));
    expect(useEditorStore.getState().dirty).toBe(true);
  });

  it('should set dirty to false', () => {
    useEditorStore.setState({ dirty: true });
    const { setDirty } = useEditorStore.getState();
    act(() => setDirty(false));
    expect(useEditorStore.getState().dirty).toBe(false);
  });
});

describe('editorStore: setCurrentFilePath action', () => {
  beforeEach(() => {
    useEditorStore.setState({
      content: '',
      cursorLine: 1,
      cursorCol: 1,
      dirty: false,
      currentFilePath: null,
    });
  });

  it('should set currentFilePath to a valid path string', () => {
    const { setCurrentFilePath } = useEditorStore.getState();
    act(() => setCurrentFilePath('/home/user/docs/notes.md'));
    expect(useEditorStore.getState().currentFilePath).toBe('/home/user/docs/notes.md');
  });

  it('should allow clearing currentFilePath to null', () => {
    useEditorStore.setState({ currentFilePath: '/some/file.md' });
    const { setCurrentFilePath } = useEditorStore.getState();
    act(() => setCurrentFilePath(null));
    expect(useEditorStore.getState().currentFilePath).toBeNull();
  });
});

describe('editorStore: resetEditor action', () => {
  it('should reset all state to initial values', () => {
    useEditorStore.setState({
      content: '# Some content',
      cursorLine: 10,
      cursorCol: 5,
      dirty: true,
      currentFilePath: '/path/to/file.md',
    });

    const { resetEditor } = useEditorStore.getState();
    act(() => resetEditor());

    const state = useEditorStore.getState();
    expect(state.content).toBe('');
    expect(state.cursorLine).toBe(1);
    expect(state.cursorCol).toBe(1);
    expect(state.dirty).toBe(false);
    expect(state.currentFilePath).toBeNull();
  });
});
