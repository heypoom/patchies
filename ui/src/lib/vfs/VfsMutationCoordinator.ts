import { HistoryManager, type Command } from '$lib/history';
import type { VFSEntry } from './types';

export type VfsMutationSnapshot = {
  entries: Map<string, VFSEntry>;
  pendingPermissions: Set<string>;
};

type VfsMutationCallbacks = {
  redo?: () => void;
  undo?: () => void;
};

type VfsMutationAccess = {
  snapshot: () => VfsMutationSnapshot;
  restore: (snapshot: VfsMutationSnapshot) => void;
  afterMutation: () => void;
};

/** Records entry-map transitions as one reversible VFS history operation. */
export class VfsMutationCoordinator {
  constructor(private access: VfsMutationAccess) {}

  record(description: string, mutate: () => void, callbacks?: VfsMutationCallbacks): void {
    const before = this.access.snapshot();

    mutate();
    this.access.afterMutation();

    const after = this.access.snapshot();
    const command: Command = {
      description,
      execute: () => {
        this.access.restore(after);
        callbacks?.redo?.();
      },
      undo: () => {
        this.access.restore(before);
        callbacks?.undo?.();
      }
    };

    HistoryManager.getInstance().record(command);
  }
}
