import type { RuntimeObjectViewRevisionListener } from '../types/runtime-object';

export class RuntimeViewRevisionTracker {
  private revisions = new Map<string, number>();
  private listeners = new Set<RuntimeObjectViewRevisionListener>();

  track(nodeId: string): number {
    return this.revisions.get(nodeId) ?? 0;
  }

  bump(nodeId: string): void {
    this.revisions.set(nodeId, this.track(nodeId) + 1);

    for (const listener of this.listeners) {
      listener(nodeId);
    }
  }

  subscribe(listener: RuntimeObjectViewRevisionListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }
}
