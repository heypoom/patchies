import type { LocalFilesystemProvider } from './providers/LocalFilesystemProvider';
import { guessMimeType } from './path-utils';
import {
  type VFSEntry,
  type VFSListEntry,
  type VFSListPage,
  type VFSSearchPage,
  isVFSFolder,
  VFS_PREFIXES
} from './types';
import type { VfsEntryIndex } from './VfsEntryIndex';

type PageOptions = { offset?: number; limit?: number };

/** Reads virtual and linked-folder directory trees through one interface. */
export class VfsDirectoryReader {
  constructor(
    private entries: VfsEntryIndex,
    private getLocalProvider: () => LocalFilesystemProvider | undefined
  ) {}

  findLinkedFolder(path: string): string | null {
    if (this.entries.get(path)?.provider === 'local-folder') return path;

    const segments = path.split('/');
    for (let index = 3; index < segments.length; index += 1) {
      const potentialFolderPath = segments.slice(0, index).join('/');
      if (this.entries.get(potentialFolderPath)?.provider === 'local-folder') {
        return potentialFolderPath;
      }
    }

    return null;
  }

  getEntry(path: string): VFSEntry | undefined {
    const entry = this.entries.get(path);
    if (entry) {
      return entry.mimeType ? entry : { ...entry, mimeType: guessMimeType(entry.filename) };
    }

    if (!this.findLinkedFolder(path)) return undefined;

    const filename = path.split('/').pop() || '';
    return { provider: 'local', filename, mimeType: guessMimeType(filename) };
  }

  async resolveLinkedFile(path: string): Promise<File | undefined> {
    const linkedFolderPath = this.findLinkedFolder(path);
    if (!linkedFolderPath || linkedFolderPath === path) return undefined;

    const provider = this.getLocalProvider();
    if (!provider) {
      throw new Error('VFS: Local provider not available for linked folder resolution');
    }

    const relativePath = path.slice(linkedFolderPath.length + 1).split('/');
    return provider.resolveFileInDir(linkedFolderPath, relativePath);
  }

  async listChildren(directory: string): Promise<VFSListEntry[]> {
    const entry = this.entries.get(directory);
    const linkedFolderPath = this.findLinkedFolder(directory);
    const hasChildren = this.entries.hasDescendant(directory);
    const isNamespaceRoot =
      directory === VFS_PREFIXES.PATCH ||
      directory === VFS_PREFIXES.USER ||
      directory === VFS_PREFIXES.OBJECT;

    if (entry && !isVFSFolder(entry)) {
      throw new TypeError(`VFS: Path is not a directory: ${directory}`);
    }

    if (!entry && !linkedFolderPath && !hasChildren && !isNamespaceRoot) {
      throw new Error(`VFS: Directory not found: ${directory}`);
    }

    const children = new Map<string, VFSListEntry>();
    for (const childPath of this.entries.immediateChildPaths(directory)) {
      children.set(childPath, this.createListEntry(childPath));
    }

    if (linkedFolderPath) {
      for (const child of await this.listLinkedFolderChildren(directory, linkedFolderPath)) {
        children.set(child.path, this.createListEntry(child.path, child.kind));
      }
    }

    return [...children.values()].sort((a, b) => a.path.localeCompare(b.path));
  }

  async listChildrenPage(directory: string, options: PageOptions = {}): Promise<VFSListPage> {
    const offset = Math.max(0, Math.floor(options.offset ?? 0));
    const limit = Math.max(1, Math.floor(options.limit ?? 50));
    const linkedFolderPath = this.findLinkedFolder(directory);

    if (linkedFolderPath) {
      const children = await this.listLinkedFolderChildren(directory, linkedFolderPath, {
        offset,
        limit: limit + 1
      });
      const truncated = children.length > limit;
      const entries = children
        .slice(0, limit)
        .map((child) => this.createListEntry(child.path, child.kind));

      return {
        entries,
        offset,
        limit,
        truncated,
        ...(truncated ? { nextOffset: offset + entries.length } : {})
      };
    }

    const children = await this.listChildren(directory);
    const entries = children.slice(offset, offset + limit);
    const truncated = offset + entries.length < children.length;

    return {
      entries,
      offset,
      limit,
      truncated,
      ...(truncated ? { nextOffset: offset + entries.length } : {})
    };
  }

  async search(query: string, directory: string): Promise<VFSListEntry[]> {
    const prefix = directory.endsWith('://') ? directory : `${directory}/`;
    const normalizedQuery = query.toLowerCase();
    const matches = new Map<string, VFSListEntry>();

    for (const path of this.entries.paths(prefix)) {
      if (path.toLowerCase().includes(normalizedQuery)) {
        matches.set(path, this.createListEntry(path));
      }
    }

    const containingLinkedFolder = this.findLinkedFolder(directory);
    const linkedFolderPaths = containingLinkedFolder
      ? [containingLinkedFolder]
      : [...this.entries]
          .filter(([path, entry]) => entry.provider === 'local-folder' && path.startsWith(prefix))
          .map(([path]) => path);

    for (const linkedFolderPath of linkedFolderPaths) {
      const searchRoot = containingLinkedFolder ? directory : linkedFolderPath;

      for (const entry of await this.searchLinkedFolder(searchRoot, linkedFolderPath)) {
        if (entry.path.toLowerCase().includes(normalizedQuery)) matches.set(entry.path, entry);
      }
    }

    return [...matches.values()].sort((a, b) => a.path.localeCompare(b.path));
  }

  async searchPage(
    query: string,
    directory: string,
    options: PageOptions = {}
  ): Promise<VFSSearchPage> {
    const offset = Math.max(0, Math.floor(options.offset ?? 0));
    const limit = Math.max(1, Math.floor(options.limit ?? 50));
    const normalizedQuery = query.toLowerCase();
    const entries: VFSListEntry[] = [];
    let skipped = 0;

    const visit = async (currentDirectory: string): Promise<boolean> => {
      for (const child of await this.listChildren(currentDirectory)) {
        if (child.path.toLowerCase().includes(normalizedQuery)) {
          if (skipped < offset) skipped += 1;
          else if (entries.length < limit) entries.push(child);
          else return true;
        }

        if (child.kind === 'directory' && (await visit(child.path))) return true;
      }

      return false;
    };

    const truncated = await visit(directory);

    return {
      entries,
      offset,
      limit,
      truncated,
      ...(truncated ? { nextOffset: offset + entries.length } : {})
    };
  }

  private createListEntry(path: string, kind?: VFSListEntry['kind']): VFSListEntry {
    const name = path.split('/').filter(Boolean).pop() ?? path;
    return { path, name, kind: kind ?? this.getPathKind(path) };
  }

  private getPathKind(path: string): VFSListEntry['kind'] {
    const entry = this.entries.get(path);
    if (entry && isVFSFolder(entry)) return 'directory';

    return this.entries.hasDescendant(path) ? 'directory' : 'file';
  }

  private async listLinkedFolderChildren(
    directory: string,
    linkedFolderPath: string,
    options?: PageOptions
  ): Promise<Array<{ path: string; kind: 'file' | 'directory' }>> {
    const provider = this.getLocalProvider();
    if (!provider) {
      throw new Error('VFS: Local provider not available for linked folder listing');
    }

    let handle = await provider.getDirHandle(linkedFolderPath);
    if (!handle) {
      throw new Error(`VFS: No directory handle for linked folder: ${linkedFolderPath}`);
    }
    if (!(await provider.hasDirPermission(linkedFolderPath))) {
      throw new Error(`VFS: Permission denied for linked folder: ${linkedFolderPath}`);
    }

    const relativeSegments =
      directory === linkedFolderPath ? [] : directory.slice(linkedFolderPath.length + 1).split('/');
    for (const segment of relativeSegments) {
      handle = await handle.getDirectoryHandle(segment);
    }

    const entries = await provider.listHandleContents(handle, options);
    const pathPrefix = directory.endsWith('/') ? directory : `${directory}/`;
    return entries.map((entry) => ({ path: `${pathPrefix}${entry.name}`, kind: entry.kind }));
  }

  private async searchLinkedFolder(
    directory: string,
    linkedFolderPath: string
  ): Promise<VFSListEntry[]> {
    const matches: VFSListEntry[] = [];

    for (const child of await this.listLinkedFolderChildren(directory, linkedFolderPath)) {
      matches.push(this.createListEntry(child.path, child.kind));
      if (child.kind === 'directory') {
        matches.push(...(await this.searchLinkedFolder(child.path, linkedFolderPath)));
      }
    }

    return matches;
  }
}
