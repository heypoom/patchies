import { type VFSEntry, parseVFSPath } from './types';

export type VfsRenameMove = {
  oldPath: string;
  newPath: string;
  entry: VFSEntry;
};

export type VfsRenamePlan = {
  moves: VfsRenameMove[];
};

export type VfsDeletePlan = {
  roots: string[];
  paths: string[];
};

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

  toMap(): Map<string, VFSEntry> {
    return new Map(this.entries);
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
    if (!prefix) return paths;

    if (prefix.endsWith('://')) {
      return paths.filter((path) => path.startsWith(prefix));
    }

    const normalizedPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;

    return paths.filter(
      (path) => path === normalizedPrefix || path.startsWith(`${normalizedPrefix}/`)
    );
  }

  treePaths(path: string): string[] {
    return this.paths().filter(
      (candidate) => candidate === path || candidate.startsWith(`${path}/`)
    );
  }

  immediateChildPaths(directory: string): string[] {
    const prefix = directory.endsWith('://') ? directory : `${directory}/`;
    const children = new Set<string>();

    for (const path of this.entries.keys()) {
      if (!path.startsWith(prefix)) continue;

      const child = path.slice(prefix.length).split('/')[0];

      if (child) {
        children.add(`${prefix}${child}`);
      }
    }

    return [...children];
  }

  hasDescendant(path: string): boolean {
    const prefix = path.endsWith('://') ? path : `${path}/`;
    return [...this.entries.keys()].some((candidate) => candidate.startsWith(prefix));
  }

  planRename(oldPath: string, newPath: string): VfsRenamePlan {
    const oldParsed = parseVFSPath(oldPath);
    const newParsed = parseVFSPath(newPath);

    if (!oldParsed || !newParsed || oldParsed.namespace !== newParsed.namespace) {
      throw new Error('VFS: Files can only be renamed within their namespace');
    }

    if (!this.entries.has(oldPath)) throw new Error(`VFS: Path not found: ${oldPath}`);
    if (this.entries.has(newPath)) throw new Error(`VFS: Path already exists: ${newPath}`);

    const paths = this.treePaths(oldPath);
    const movedPaths = new Set(paths);

    const moves = paths.map((path) => {
      const current = this.entries.get(path)!;
      const destination = path === oldPath ? newPath : `${newPath}${path.slice(oldPath.length)}`;
      const entry = {
        ...current,
        filename: destination.split('/').pop() ?? current.filename
      };

      if (this.entries.has(destination) && !movedPaths.has(destination)) {
        throw new Error(`VFS: Path already exists: ${destination}`);
      }

      return { oldPath: path, newPath: destination, entry };
    });

    return { moves };
  }

  applyRename(plan: VfsRenamePlan): void {
    for (const move of plan.moves) {
      this.entries.delete(move.oldPath);
    }

    for (const move of plan.moves) {
      this.entries.set(move.newPath, move.entry);
    }
  }

  planDelete(requestedPaths: Iterable<string>): VfsDeletePlan {
    const requested = [...new Set(requestedPaths)];

    const roots = requested.filter(
      (path) => !requested.some((other) => other !== path && path.startsWith(`${other}/`))
    );

    for (const path of roots) {
      if (!this.entries.has(path)) {
        throw new Error(`VFS: Path not found: ${path}`);
      }
    }

    const paths = this.paths().filter((path) =>
      roots.some((root) => path === root || path.startsWith(`${root}/`))
    );

    return { roots, paths };
  }

  removePaths(paths: Iterable<string>): void {
    for (const path of paths) this.entries.delete(path);
  }
}
