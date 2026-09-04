import type { Node } from '@xyflow/svelte';

type MirrorAccessor = {
  getNodes: () => Node[];
  setNodes: (nodes: Node[]) => void;
};

/** Bridges editor-only module mirrors into VFS history without giving VFS canvas ownership. */
export class VfsCanvasMirrors {
  private static accessor: MirrorAccessor | null = null;

  static register(accessor: MirrorAccessor): () => void {
    this.accessor = accessor;

    return () => {
      if (this.accessor === accessor) this.accessor = null;
    };
  }

  static snapshot(): Node[] {
    return this.accessor?.getNodes().filter((node) => node.type === 'js.module') ?? [];
  }

  static restore(snapshot: Node[]): void {
    const accessor = this.accessor;
    if (!accessor) return;

    const ordinaryNodes = accessor.getNodes().filter((node) => node.type !== 'js.module');
    accessor.setNodes([...ordinaryNodes, ...snapshot]);
  }

  static rename(paths: ReadonlyMap<string, string>): void {
    const accessor = this.accessor;
    if (!accessor) return;

    accessor.setNodes(
      accessor.getNodes().map((node) => {
        if (node.type !== 'js.module' || typeof node.data.vfsPath !== 'string') return node;

        const vfsPath = paths.get(node.data.vfsPath);
        return vfsPath ? { ...node, data: { ...node.data, vfsPath } } : node;
      })
    );
  }

  static remove(paths: ReadonlySet<string>): void {
    const accessor = this.accessor;
    if (!accessor) return;

    accessor.setNodes(
      accessor
        .getNodes()
        .filter((node) => node.type !== 'js.module' || !paths.has(String(node.data.vfsPath)))
    );
  }
}
