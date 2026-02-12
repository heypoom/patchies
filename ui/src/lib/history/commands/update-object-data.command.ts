import type { Command, CanvasStateAccessors } from '../types';

export interface ObjectData {
  expr: string;
  name: string;
  params: unknown[];
}

/**
 * Command to update ObjectNode data (expr, name, params) atomically.
 * This ensures undo/redo updates all three fields together to avoid inconsistent state.
 */
export class UpdateObjectDataCommand implements Command {
  readonly description: string;

  constructor(
    private nodeId: string,
    private oldData: ObjectData,
    private newData: ObjectData,
    private accessors: CanvasStateAccessors
  ) {
    this.description = `Update ${newData.name}`;
  }

  execute(): void {
    this.updateNodeData(this.newData);
  }

  undo(): void {
    this.updateNodeData(this.oldData);
  }

  private updateNodeData(data: ObjectData): void {
    this.accessors.setNodes(
      this.accessors.getNodes().map((node) =>
        node.id === this.nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                expr: data.expr,
                name: data.name,
                params: data.params
              }
            }
          : node
      )
    );
  }
}
