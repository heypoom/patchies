import type { MountEntry } from '../vfs/VfsMountTree';
import type { EntryChange } from './remote-control-types';

export class VfsChangeTracker {
  private entries = new Map<string, MountEntry>();

  reset(entries: MountEntry[]): void {
    this.entries = new Map(entries.map((entry) => [entry.path, entry]));
  }

  clear(): void {
    this.entries.clear();
  }

  changes(entries: MountEntry[]): EntryChange[] {
    const next = new Map(entries.map((entry) => [entry.path, entry]));
    const paths = new Set([...this.entries.keys(), ...next.keys()]);

    return [...paths].sort().flatMap((path) => {
      const previous = this.entries.get(path);
      const entry = next.get(path);
      if (previous?.kind === entry?.kind && previous?.content === entry?.content) return [];

      return [{ path, entry: entry ?? null }];
    });
  }

  accept(changes: EntryChange[]): void {
    for (const { path, entry } of changes) {
      if (entry) this.entries.set(path, entry);
      else this.entries.delete(path);
    }
  }
}
