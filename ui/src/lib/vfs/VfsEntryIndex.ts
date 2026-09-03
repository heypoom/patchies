import type { VFSEntry } from './types';

/** In-memory index for VFS entries and complete path trees. */
export class VfsEntryIndex implements Iterable<[string, VFSEntry]> {
  private entries: Map<string, VFSEntry>;

  constructor(entries: Iterable<[string, VFSEntry]> = []) {
    this.entries = new Map(entries);
  }

  [Symbol.iterator](): MapIterator<[string, VFSEntry]> {
    return this.entries[Symbol.iterator]();
  }

  get size(): number {
    return this.entries.size;
  }

  get(path: string): VFSEntry | undefined {
    return this.entries.get(path);
  }

  set(path: string, entry: VFSEntry): this {
    this.entries.set(path, entry);
    return this;
  }

  has(path: string): boolean {
    return this.entries.has(path);
  }

  delete(path: string): boolean {
    return this.entries.delete(path);
  }

  clear(): void {
    this.entries.clear();
  }

  keys(): MapIterator<string> {
    return this.entries.keys();
  }

  values(): MapIterator<VFSEntry> {
    return this.entries.values();
  }

  snapshot(): Map<string, VFSEntry> {
    return new Map(
      [...this.entries].map(([path, entry]) => [path, { ...entry }] as [string, VFSEntry])
    );
  }

  replace(entries: Iterable<[string, VFSEntry]>): void {
    this.entries = new Map(
      [...entries].map(([path, entry]) => [path, { ...entry }] as [string, VFSEntry])
    );
  }

  paths(prefix?: string): string[] {
    const paths = [...this.entries.keys()];
    return prefix ? paths.filter((path) => path.startsWith(prefix)) : paths;
  }

  treePaths(path: string): string[] {
    return this.paths().filter(
      (candidate) => candidate === path || candidate.startsWith(`${path}/`)
    );
  }
}
