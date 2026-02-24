import { describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import { useFileStore } from '@/store/fileStore';
import type { FileNode } from '@/types/file';

const mockFileTree: FileNode[] = [
  {
    name: 'docs',
    path: '/project/docs',
    isDirectory: true,
    children: [
      { name: 'readme.md', path: '/project/docs/readme.md', isDirectory: false },
    ],
  },
  { name: 'main.ts', path: '/project/main.ts', isDirectory: false },
];

describe('fileStore', () => {
  beforeEach(() => {
    useFileStore.setState({
      fileTree: [],
      currentFile: null,
      expandedDirs: new Set<string>(),
      watchedPath: null,
      isLoading: false,
    });
  });

  it('should have correct default state', () => {
    const state = useFileStore.getState();
    expect(state.fileTree).toEqual([]);
    expect(state.currentFile).toBeNull();
    expect(state.expandedDirs).toBeInstanceOf(Set);
    expect(state.expandedDirs.size).toBe(0);
    expect(state.watchedPath).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it('should set file tree', () => {
    const { setFileTree } = useFileStore.getState();
    act(() => setFileTree(mockFileTree));
    expect(useFileStore.getState().fileTree).toEqual(mockFileTree);
  });

  it('should set current file', () => {
    const { setCurrentFile } = useFileStore.getState();
    act(() => setCurrentFile('/project/main.ts'));
    expect(useFileStore.getState().currentFile).toBe('/project/main.ts');
  });

  it('should clear current file with null', () => {
    const { setCurrentFile } = useFileStore.getState();
    act(() => setCurrentFile('/project/main.ts'));
    act(() => setCurrentFile(null));
    expect(useFileStore.getState().currentFile).toBeNull();
  });

  it('should toggle directory expansion - expand', () => {
    const { toggleDir } = useFileStore.getState();
    act(() => toggleDir('/project/docs'));
    const { expandedDirs } = useFileStore.getState();
    expect(expandedDirs.has('/project/docs')).toBe(true);
  });

  it('should toggle directory expansion - collapse', () => {
    const { toggleDir } = useFileStore.getState();
    act(() => toggleDir('/project/docs'));
    act(() => toggleDir('/project/docs'));
    const { expandedDirs } = useFileStore.getState();
    expect(expandedDirs.has('/project/docs')).toBe(false);
  });

  it('should expand multiple directories independently', () => {
    const { toggleDir } = useFileStore.getState();
    act(() => toggleDir('/project/docs'));
    act(() => toggleDir('/project/src'));
    const { expandedDirs } = useFileStore.getState();
    expect(expandedDirs.has('/project/docs')).toBe(true);
    expect(expandedDirs.has('/project/src')).toBe(true);
  });

  it('should set watched path', () => {
    const { setWatchedPath } = useFileStore.getState();
    act(() => setWatchedPath('/project'));
    expect(useFileStore.getState().watchedPath).toBe('/project');
  });

  it('should clear watched path with null', () => {
    const { setWatchedPath } = useFileStore.getState();
    act(() => setWatchedPath('/project'));
    act(() => setWatchedPath(null));
    expect(useFileStore.getState().watchedPath).toBeNull();
  });

  it('should set loading state', () => {
    const { setLoading } = useFileStore.getState();
    act(() => setLoading(true));
    expect(useFileStore.getState().isLoading).toBe(true);
    act(() => setLoading(false));
    expect(useFileStore.getState().isLoading).toBe(false);
  });

  it('should update children of a matching node via updateNodeChildren', () => {
    const treeWithNullChildren: FileNode[] = [
      { name: 'docs', path: '/project/docs', isDirectory: true, children: undefined },
      { name: 'main.ts', path: '/project/main.ts', isDirectory: false },
    ];
    const newChildren: FileNode[] = [
      { name: 'guide.md', path: '/project/docs/guide.md', isDirectory: false },
    ];

    const { setFileTree, updateNodeChildren } = useFileStore.getState();
    act(() => setFileTree(treeWithNullChildren));
    act(() => updateNodeChildren('/project/docs', newChildren));

    const updatedTree = useFileStore.getState().fileTree;
    const docsNode = updatedTree.find((n) => n.path === '/project/docs');
    expect(docsNode?.children).toEqual(newChildren);
    // Other nodes unchanged
    const mainTs = updatedTree.find((n) => n.path === '/project/main.ts');
    expect(mainTs?.children).toBeUndefined();
  });

  it('should update children of a nested node via updateNodeChildren', () => {
    const deepTree: FileNode[] = [
      {
        name: 'src',
        path: '/project/src',
        isDirectory: true,
        children: [
          { name: 'components', path: '/project/src/components', isDirectory: true, children: undefined },
        ],
      },
    ];
    const newChildren: FileNode[] = [
      { name: 'Button.tsx', path: '/project/src/components/Button.tsx', isDirectory: false },
    ];

    const { setFileTree, updateNodeChildren } = useFileStore.getState();
    act(() => setFileTree(deepTree));
    act(() => updateNodeChildren('/project/src/components', newChildren));

    const srcNode = useFileStore.getState().fileTree.find((n) => n.path === '/project/src');
    const compNode = srcNode?.children?.find((n) => n.path === '/project/src/components');
    expect(compNode?.children).toEqual(newChildren);
  });
});
