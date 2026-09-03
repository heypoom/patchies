import {
  type EmbeddedVFSEntry,
  type PatchImportItem,
  type VFSEntry,
  type VFSListEntry,
  isEmbeddedVFSEntry,
  isVFSFolder,
  VFS_PREFIXES
} from './types';
import { getBasename, getExtension, getFilename, guessMimeType } from './path-utils';

export const MAX_EMBEDDED_FILE_BYTES = 256 * 1024;
export const MAX_EMBEDDED_PATCH_BYTES = 1024 * 1024;

export const PATCH_TEXT_FILE_ACCEPT =
  'text/*,.js,.mjs,.gl,.glsl,.frag,.vert,.glslf,.glslv,.json,.jsonc,.css,.html,.htm,.svg,.xml,.yaml,.yml,.md,.txt,.csv';

const PATCH_TEXT_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.gl',
  '.glsl',
  '.frag',
  '.vert',
  '.glslf',
  '.glslv',
  '.json',
  '.jsonc',
  '.css',
  '.html',
  '.htm',
  '.svg',
  '.xml',
  '.yaml',
  '.yml',
  '.md',
  '.txt',
  '.csv'
]);

export type VfsCollisionStrategy = 'replace' | 'keep-both' | 'cancel';

export type PatchImportPlan = {
  stagedEntries: Map<string, VFSEntry>;
  removedExistingPaths: Set<string>;
  importedPaths: string[];
};

export type PatchImportSource = {
  getEntry: (path: string) => VFSEntry | undefined;
  listChildren: (path: string) => Promise<VFSListEntry[]>;
  resolve: (path: string) => Promise<File | Blob>;
};

export function getPatchImportError(file: File): string | null {
  if (file.size > MAX_EMBEDDED_FILE_BYTES) {
    return `${file.name} exceeds 256 KiB Patch-file limit`;
  }

  const extension = getExtension(file.name).toLowerCase();
  const isTextMimeType =
    file.type.startsWith('text/') ||
    file.type === 'application/javascript' ||
    file.type === 'application/json' ||
    file.type === 'application/xml' ||
    file.type === 'image/svg+xml';

  if (!isTextMimeType && !PATCH_TEXT_EXTENSIONS.has(extension)) {
    return `${file.name} is not a supported text file`;
  }

  return null;
}

/** Validates and stages atomic Patch imports against an immutable entry snapshot. */
export class PatchImportPlanner {
  constructor(private entries: ReadonlyMap<string, VFSEntry>) {}

  async prepareCopy(sourcePath: string, source: PatchImportSource): Promise<PatchImportItem[]> {
    const sourceEntry = source.getEntry(sourcePath);
    if (!sourceEntry) throw new Error(`VFS: Path not found: ${sourcePath}`);

    if (!isVFSFolder(sourceEntry)) {
      const file = await this.resolveSourceFile(sourcePath, sourceEntry, source);
      return [{ kind: 'file', file, relativePath: sourceEntry.filename }];
    }

    const rootName = sourceEntry.filename;
    const items: PatchImportItem[] = [{ kind: 'directory', relativePath: rootName }];
    const collectChildren = async (directory: string, relativeDirectory: string): Promise<void> => {
      for (const child of await source.listChildren(directory)) {
        const relativePath = `${relativeDirectory}/${child.name}`;

        if (child.kind === 'directory') {
          items.push({ kind: 'directory', relativePath });
          await collectChildren(child.path, relativePath);
          continue;
        }

        const entry = source.getEntry(child.path);
        if (!entry) throw new Error(`VFS: File not found: ${child.path}`);

        const file = await this.resolveSourceFile(child.path, entry, source);
        items.push({ kind: 'file', file, relativePath });
      }
    };

    await collectChildren(sourcePath, rootName);
    return items;
  }

  getCollisions(
    files: Iterable<File | PatchImportItem>,
    targetFolder: string = VFS_PREFIXES.PATCH
  ): string[] {
    const items = this.normalizeItems(files);
    const collisions = items
      .map((item) => this.joinPath(targetFolder, item.relativePath))
      .filter((path) =>
        [...this.entries.keys()].some(
          (existing) => existing === path || existing.startsWith(`${path}/`)
        )
      );

    return [...new Set(collisions)].filter(
      (path, _, all) => !all.some((other) => other !== path && path.startsWith(`${other}/`))
    );
  }

  async plan(
    files: Iterable<File | PatchImportItem>,
    targetFolder: string = VFS_PREFIXES.PATCH,
    collision: VfsCollisionStrategy = 'keep-both'
  ): Promise<PatchImportPlan> {
    if (!targetFolder.startsWith(VFS_PREFIXES.PATCH)) {
      throw new Error(`VFS: Patch destination required: ${targetFolder}`);
    }

    const items = this.normalizeItems(files);
    const decodedContent = new Map<PatchImportItem, string>();
    const errors: string[] = [];

    for (const item of items) {
      if (item.kind === 'directory') continue;

      const importError = getPatchImportError(item.file);
      if (importError) {
        errors.push(importError);
        continue;
      }

      try {
        decodedContent.set(item, await this.decodeUtf8(item.file, item.relativePath));
      } catch (error) {
        errors.push(
          error instanceof Error ? error.message.replace('VFS: ', '') : item.relativePath
        );
      }
    }

    if (errors.length > 0) throw new Error(`VFS: ${errors.join('; ')}`);

    const stagedEntries = new Map<string, VFSEntry>();
    const occupied = new Set(this.entries.keys());
    const removedExistingPaths = new Set<string>();
    const resolvedDirectories = new Map<string, string>();
    let totalBytes = this.getEmbeddedByteLength();

    const removeExistingTree = (path: string) => {
      for (const [existingPath, entry] of this.entries) {
        if (existingPath !== path && !existingPath.startsWith(`${path}/`)) continue;
        if (removedExistingPaths.has(existingPath)) continue;

        removedExistingPaths.add(existingPath);
        occupied.delete(existingPath);
        if (isEmbeddedVFSEntry(entry)) totalBytes -= this.byteLength(entry.content);
      }
    };
    const removeStagedTree = (path: string) => {
      for (const [stagedPath, entry] of stagedEntries) {
        if (stagedPath !== path && !stagedPath.startsWith(`${path}/`)) continue;

        stagedEntries.delete(stagedPath);
        occupied.delete(stagedPath);
        if (isEmbeddedVFSEntry(entry)) totalBytes -= this.byteLength(entry.content);
      }
    };

    for (const item of items) {
      const parent = this.resolveParent(item.relativePath, targetFolder, resolvedDirectories);
      if (!parent) throw new Error(`VFS: Invalid import path: ${item.relativePath}`);

      const name = getFilename(item.relativePath);
      const rawPath = this.joinPath(parent, name);
      const priorEntry = stagedEntries.get(rawPath) ?? this.entries.get(rawPath);
      const path = this.resolveCollision(rawPath, collision, occupied, item.kind === 'directory');
      if (!path) throw new Error(`VFS: Import cancelled because ${name} already exists`);

      if (collision === 'replace' && path === rawPath) {
        removeStagedTree(path);
        removeExistingTree(path);
      }

      if (item.kind === 'directory') {
        resolvedDirectories.set(item.relativePath, path);
        stagedEntries.set(path, { provider: 'folder', filename: getFilename(path) });
        occupied.add(path);
        continue;
      }

      const content = decodedContent.get(item)!;
      const size = this.byteLength(content);
      totalBytes += size;
      if (totalBytes > MAX_EMBEDDED_PATCH_BYTES) {
        throw new Error('VFS: Embedded patch files exceed 1 MiB');
      }

      occupied.add(path);
      const entry: EmbeddedVFSEntry = {
        provider: 'embedded',
        filename: getFilename(path),
        mimeType: item.file.type || guessMimeType(item.file.name) || 'text/plain;charset=utf-8',
        content,
        size,
        revision: priorEntry && isEmbeddedVFSEntry(priorEntry) ? (priorEntry.revision ?? 0) + 1 : 1
      };
      stagedEntries.set(path, entry);
    }

    return {
      stagedEntries,
      removedExistingPaths,
      importedPaths: [...stagedEntries]
        .filter(([, entry]) => isEmbeddedVFSEntry(entry))
        .map(([path]) => path)
    };
  }

  private async resolveSourceFile(
    path: string,
    entry: VFSEntry,
    source: PatchImportSource
  ): Promise<File> {
    if (entry.size && entry.size > MAX_EMBEDDED_FILE_BYTES) {
      throw new Error(`VFS: ${entry.filename} exceeds 256 KiB Patch-file limit`);
    }

    const blob = await source.resolve(path);
    return blob instanceof File
      ? blob
      : new File([blob], entry.filename, { type: entry.mimeType ?? blob.type });
  }

  private normalizeItems(files: Iterable<File | PatchImportItem>): PatchImportItem[] {
    const directories = new Set<string>();
    const fileItems: PatchImportItem[] = [];

    for (const input of files) {
      const item: PatchImportItem =
        input instanceof File
          ? { kind: 'file', file: input, relativePath: this.getImportRelativePath(input) }
          : { ...input, relativePath: this.normalizeRelativePath(input.relativePath) };
      const segments = item.relativePath.split('/');

      for (let index = 1; index < segments.length; index += 1) {
        directories.add(segments.slice(0, index).join('/'));
      }

      if (item.kind === 'directory') directories.add(item.relativePath);
      else fileItems.push(item);
    }

    const directoryItems: PatchImportItem[] = [...directories]
      .sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))
      .map((relativePath) => ({ kind: 'directory', relativePath }));

    return [...directoryItems, ...fileItems];
  }

  private resolveCollision(
    path: string,
    collision: VfsCollisionStrategy,
    occupied: Set<string>,
    directory: boolean
  ): string | null {
    const hasCollision = (candidate: string) =>
      occupied.has(candidate) || [...occupied].some((item) => item.startsWith(`${candidate}/`));

    if (!hasCollision(path)) return path;
    if (collision === 'replace') return path;
    if (collision === 'cancel') return null;

    const filename = getFilename(path);
    const extension = directory ? '' : getExtension(filename);
    const basename = directory ? filename : getBasename(filename);
    const parent = path.slice(0, -filename.length);
    let counter = 1;
    let candidate = `${parent}${basename}-${counter}${extension}`;

    while (hasCollision(candidate)) {
      counter += 1;
      candidate = `${parent}${basename}-${counter}${extension}`;
    }

    return candidate;
  }

  private getEmbeddedByteLength(): number {
    let total = 0;
    for (const entry of this.entries.values()) {
      if (isEmbeddedVFSEntry(entry)) total += this.byteLength(entry.content);
    }
    return total;
  }

  private async decodeUtf8(blob: Blob, path: string): Promise<string> {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(await blob.arrayBuffer());
    } catch {
      throw new Error(`VFS: Only UTF-8 text can be embedded: ${path}`);
    }
  }

  private getImportRelativePath(file: File): string {
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    return this.normalizeRelativePath(relativePath || file.name);
  }

  private normalizeRelativePath(relativePath: string): string {
    const normalized = relativePath.replaceAll('\\', '/');
    const segments = normalized.split('/').filter(Boolean);

    if (segments.length === 0 || segments.some((segment) => segment === '.' || segment === '..')) {
      throw new Error(`VFS: Invalid import path: ${normalized}`);
    }

    return segments.join('/');
  }

  private resolveParent(
    relativePath: string,
    targetFolder: string,
    resolvedDirectories: ReadonlyMap<string, string>
  ): string | undefined {
    const separator = relativePath.lastIndexOf('/');
    return separator === -1
      ? targetFolder
      : resolvedDirectories.get(relativePath.slice(0, separator));
  }

  private joinPath(parent: string, child: string): string {
    return parent.endsWith('://') || parent.endsWith('/')
      ? `${parent}${child}`
      : `${parent}/${child}`;
  }

  private byteLength(content: string): number {
    return new TextEncoder().encode(content).byteLength;
  }
}
