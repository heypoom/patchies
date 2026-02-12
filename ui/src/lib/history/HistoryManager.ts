import type { Command } from './types';

/**
 * Manages undo/redo history using the command pattern.
 * Singleton service that tracks executed commands in stacks.
 */
export class HistoryManager {
  private static instance: HistoryManager;

  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxSize = 100;

  /** Whether we're currently executing an undo/redo (prevents re-recording) */
  private isUndoingOrRedoing = false;

  /**
   * Execute a command and add it to the history.
   * Clears the redo stack since we're branching from the current state.
   */
  execute(command: Command): void {
    if (this.isUndoingOrRedoing) return;

    command.execute();
    this.undoStack.push(command);
    this.redoStack = [];

    // Trim history if too large
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
  }

  /**
   * Record a command without executing it.
   * Useful when the action has already been performed (e.g., by XYFlow callbacks).
   */
  record(command: Command): void {
    if (this.isUndoingOrRedoing) return;

    this.undoStack.push(command);
    this.redoStack = [];

    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
  }

  /**
   * Undo the last command.
   * @returns The description of the undone command, or null if nothing to undo
   */
  undo(): string | null {
    const command = this.undoStack.pop();
    if (!command) return null;

    this.isUndoingOrRedoing = true;
    try {
      command.undo();
      this.redoStack.push(command);
    } finally {
      this.isUndoingOrRedoing = false;
    }

    return command.description;
  }

  /**
   * Redo the last undone command.
   * @returns The description of the redone command, or null if nothing to redo
   */
  redo(): string | null {
    const command = this.redoStack.pop();
    if (!command) return null;

    this.isUndoingOrRedoing = true;
    try {
      command.execute();
      this.undoStack.push(command);
    } finally {
      this.isUndoingOrRedoing = false;
    }

    return command.description;
  }

  /** Check if undo is available */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /** Check if redo is available */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Get the description of the next undo action */
  peekUndo(): string | null {
    return this.undoStack.at(-1)?.description ?? null;
  }

  /** Get the description of the next redo action */
  peekRedo(): string | null {
    return this.redoStack.at(-1)?.description ?? null;
  }

  /** Clear all history (e.g., when loading a new patch) */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  /** Check if currently performing undo/redo */
  get isPerformingUndoRedo(): boolean {
    return this.isUndoingOrRedoing;
  }

  static getInstance(): HistoryManager {
    if (!HistoryManager.instance) {
      HistoryManager.instance = new HistoryManager();
    }
    return HistoryManager.instance;
  }
}
