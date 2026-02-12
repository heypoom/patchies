import type { Command, CanvasStateAccessors } from '../types';

/**
 * Command to update a specific data field on a node.
 * Used for tracking code changes and other data mutations.
 */
export class UpdateNodeDataCommand implements Command {
  readonly description: string;

  constructor(
    private nodeId: string,
    private dataKey: string,
    private oldValue: unknown,
    private newValue: unknown,
    private accessors: CanvasStateAccessors
  ) {
    const node = accessors.getNodes().find((n) => n.id === nodeId);

    const objectName =
      node?.type === 'object'
        ? (node.data?.name ?? node.data?.expr ?? 'object')
        : (node?.type ?? 'unknown');

    this.description = `Update ${dataKey} on ${objectName}`;
  }

  execute(): void {
    this.updateNodeData(this.newValue);
  }

  undo(): void {
    this.updateNodeData(this.oldValue);
  }

  private updateNodeData(value: unknown): void {
    this.accessors.setNodes(
      this.accessors.getNodes().map((node) =>
        node.id === this.nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                [this.dataKey]: value
              }
            }
          : node
      )
    );
  }
}
