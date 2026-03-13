import type { Command, CanvasStateAccessors } from '../types';

/**
 * Command to replace all data fields on a node atomically.
 * Used by AI operations which may update many fields at once.
 */
export class ReplaceNodeDataCommand implements Command {
  readonly description: string;

  constructor(
    private nodeId: string,
    private oldData: Record<string, unknown>,
    private newData: Record<string, unknown>,
    private accessors: CanvasStateAccessors
  ) {
    const node = accessors.getNodes().find((n) => n.id === nodeId);
    const objectName =
      node?.type === 'object'
        ? (node.data?.name ?? node.data?.expr ?? 'object')
        : (node?.type ?? 'unknown');
    this.description = `AI edit ${objectName}`;
  }

  execute(): void {
    this.applyData(this.newData);
  }

  undo(): void {
    this.applyData(this.oldData);
  }

  private applyData(data: Record<string, unknown>): void {
    this.accessors.setNodes(
      this.accessors
        .getNodes()
        .map((node) => (node.id === this.nodeId ? { ...node, data: { ...data } } : node))
    );
  }
}
