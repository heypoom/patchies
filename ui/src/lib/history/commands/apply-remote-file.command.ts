import type { CanvasStateAccessors, Command } from '../types';

export class ApplyRemoteFileCommand implements Command {
  readonly description = 'Apply remote file';

  constructor(
    private nodeID: string,
    private dataKey: string,
    private oldValue: string,
    private newValue: string,
    private runDataKey: string | undefined,
    private accessors: CanvasStateAccessors
  ) {}

  execute(): void {
    this.update(this.newValue);
  }

  undo(): void {
    this.update(this.oldValue);
  }

  private update(value: string): void {
    this.accessors.setNodes(
      this.accessors.getNodes().map((node) =>
        node.id === this.nodeID
          ? {
              ...node,
              data: {
                ...node.data,
                [this.dataKey]: value,
                ...(this.runDataKey ? { [this.runDataKey]: Date.now() } : {})
              }
            }
          : node
      )
    );
  }
}
