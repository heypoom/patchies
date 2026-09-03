import type { LocalFilesystemProvider } from './providers/LocalFilesystemProvider';
import type { VFSEntry, VFSProvider } from './types';
import type { VfsEntryIndex } from './VfsEntryIndex';

type LocalPermissionProvider = VFSProvider & {
  needsPermission?: (path: string) => Promise<boolean>;
  requestPermission?: (path: string) => Promise<boolean>;
};

/** Tracks local resources that require permission or relinking. */
export class VfsPermissionTracker {
  private pending = new Set<string>();

  snapshot(): Set<string> {
    return new Set(this.pending);
  }

  restore(paths: Iterable<string>, entries: VfsEntryIndex): void {
    this.pending = new Set([...paths].filter((path) => entries.has(path)));
  }

  getAll(): string[] {
    return [...this.pending];
  }

  has(path: string): boolean {
    return this.pending.has(path);
  }

  add(path: string): void {
    this.pending.add(path);
  }

  delete(path: string): void {
    this.pending.delete(path);
  }

  deleteAll(paths: Iterable<string>): void {
    for (const path of paths) this.pending.delete(path);
  }

  clear(): void {
    this.pending.clear();
  }

  async scan(
    entries: Iterable<[string, VFSEntry]>,
    localProvider: LocalPermissionProvider | undefined,
    linkedFolderProvider: LocalFilesystemProvider | undefined
  ): Promise<void> {
    this.pending.clear();

    for (const [path, entry] of entries) {
      if (entry.provider === 'local') {
        const needsPermission = await localProvider?.needsPermission?.(path);

        if (needsPermission) {
          this.pending.add(path);
        }

        continue;
      }

      if (entry.provider !== 'local-folder' || !linkedFolderProvider) continue;

      const handle = await linkedFolderProvider.getDirHandle(path);

      if (!handle || !(await linkedFolderProvider.hasDirPermission(path))) {
        this.pending.add(path);
      }
    }
  }

  async request(
    path: string,
    entry: VFSEntry | undefined,
    provider: LocalPermissionProvider | undefined
  ): Promise<boolean> {
    if (entry?.provider !== 'local' || !provider?.requestPermission) return false;

    const granted = await provider.requestPermission(path);

    if (granted) {
      this.pending.delete(path);
    }

    return granted;
  }

  async requestAll(
    getEntry: (path: string) => VFSEntry | undefined,
    provider: LocalPermissionProvider | undefined
  ): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const path of this.pending) {
      const ok = await this.request(path, getEntry(path), provider);
      results.set(path, ok);
    }

    return results;
  }

  async loadStoredDirectories(
    entries: VfsEntryIndex,
    provider: LocalFilesystemProvider
  ): Promise<void> {
    const handles = await provider.loadDirHandlesFromStorage();

    for (const [path, handle] of handles) {
      if (!entries.has(path)) {
        entries.set(path, { provider: 'local-folder', filename: handle.name });
      }

      if (!(await provider.hasDirPermission(path))) {
        this.pending.add(path);
      }
    }
  }
}
