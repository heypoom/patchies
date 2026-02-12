import type { Command } from '../types';

/**
 * Groups multiple commands into a single undoable action.
 * Useful for paste operations, AI multi-insert, etc.
 */
export class BatchCommand implements Command {
  constructor(
    private commands: Command[],
    public readonly description: string
  ) {}

  execute(): void {
    for (const cmd of this.commands) {
      cmd.execute();
    }
  }

  undo(): void {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }
}
