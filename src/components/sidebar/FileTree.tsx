import type { FileNode } from '@/types/file';
import { FileTreeNode } from './FileTreeNode';

// @MX:ANCHOR: [AUTO] FileTree - renders sorted file tree from FileExplorer and handles lazy node expansion
// @MX:REASON: [AUTO] Used by FileExplorer and receives refresh callback passed down to all FileTreeNode children (fan_in >= 3)
// @MX:NOTE: Recursive file tree renderer. Sorts directories before files, both alphabetically.
// @MX:SPEC: SPEC-UI-002

interface FileTreeProps {
  nodes: FileNode[];
  onRefresh: () => void;
}

/**
 * Sorts FileNode array: directories first, then files, both groups alphabetically (case-insensitive).
 */
function sortNodes(nodes: FileNode[]): FileNode[] {
  return [...nodes].sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

export function FileTree({ nodes, onRefresh }: FileTreeProps): JSX.Element | null {
  if (nodes.length === 0) return null;

  const sorted = sortNodes(nodes);

  return (
    <div role="tree" className="overflow-y-auto">
      {sorted.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          depth={0}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}
