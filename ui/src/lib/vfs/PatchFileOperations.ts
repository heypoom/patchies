import {
  MAX_EMBEDDED_FILE_BYTES,
  MAX_EMBEDDED_PATCH_BYTES,
  PatchImportPlanner,
  type PatchImportSource,
  type VfsCollisionStrategy
} from './PatchImportPlanner';

import { getBasename, getExtension, getFilename, guessMimeType } from './path-utils';

import {
  type EmbeddedVFSEntry,
  type PatchImportItem,
  type VFSEntry,
  isEmbeddedVFSEntry,
  parseVFSPath,
  VFS_PREFIXES
} from './types';

import type { VfsEntryIndex } from './VfsEntryIndex';

type MutationCallbacks = { redo?: () => void; undo?: () => void };

type PatchFileAccess = {
  entries: VfsEntryIndex;
  recordMutation: (description: string, mutate: () => void, callbacks?: MutationCallbacks) => void;
  notifyChange: () => void;
  emitContentModified: (path: string, revision: number) => void;
};

/** Owns validation, budgets, content changes, and atomic patch-file imports. */
export class PatchFileOperations {
  private invalidPaths = new Map<string, string>();

  constructor(private access: PatchFileAccess) {}

  validateEntry(path: string, entry: VFSEntry, enforceLimits = true): void {
    const parsed = parseVFSPath(path);

    if (!parsed || parsed.segments.length === 0) {
      throw new Error(`VFS: Invalid path: ${path}`);
    }

    if (parsed.namespace === 'patch') {
      if (entry.provider !== 'embedded' && entry.provider !== 'folder') {
        throw new Error(`VFS: patch:// entries must use the embedded provider: ${path}`);
      }
    } else if (entry.provider === 'embedded') {
      throw new Error(`VFS: embedded entries are only valid under patch://: ${path}`);
    }

    if (entry.provider === 'embedded' && !isEmbeddedVFSEntry(entry)) {
      throw new Error(`VFS: embedded file content must be UTF-8 text: ${path}`);
    }

    if (enforceLimits && isEmbeddedVFSEntry(entry)) {
      this.assertContentWithinBudget(entry.content, path);
    }
  }

  refreshValidation(): void {
    const invalidPaths = new Map<string, string>();
    let totalBytes = 0;

    for (const [path, entry] of this.access.entries) {
      if (!isEmbeddedVFSEntry(entry)) continue;

      const size = byteLength(entry.content);
      totalBytes += size;

      if (size > MAX_EMBEDDED_FILE_BYTES) {
        invalidPaths.set(path, `VFS: Embedded file exceeds 256 KiB: ${path}`);
      }
    }

    if (totalBytes > MAX_EMBEDDED_PATCH_BYTES) {
      for (const [path, entry] of this.access.entries) {
        if (isEmbeddedVFSEntry(entry) && !invalidPaths.has(path)) {
          invalidPaths.set(path, 'VFS: Embedded patch files exceed 1 MiB');
        }
      }
    }

    this.invalidPaths = invalidPaths;
  }

  assertReadable(path: string): void {
    const validationError = this.invalidPaths.get(path);

    if (validationError) {
      throw new Error(validationError);
    }
  }

  create(path: string, content = '', collision: VfsCollisionStrategy = 'cancel'): string | null {
    const parsed = parseVFSPath(path);

    if (parsed?.namespace !== 'patch') {
      throw new Error(`VFS: Embedded files must use patch:// paths: ${path}`);
    }

    const destination = this.resolveCollision(path, collision);
    if (!destination) return null;

    const filename = getFilename(destination);

    const entry: EmbeddedVFSEntry = {
      provider: 'embedded',
      filename,
      mimeType: guessMimeType(filename) ?? 'text/plain;charset=utf-8',
      content,
      size: byteLength(content),
      revision: 1
    };

    this.validateEntry(destination, entry);

    this.access.recordMutation(`Create ${filename}`, () => {
      this.access.entries.set(destination, entry);
      this.access.notifyChange();
      this.access.emitContentModified(destination, entry.revision ?? 1);
    });

    return destination;
  }

  write(path: string, content: string): void {
    const entry = this.access.entries.get(path);

    if (!entry || !isEmbeddedVFSEntry(entry)) {
      throw new Error(`VFS: Embedded file not found: ${path}`);
    }

    this.assertContentWithinBudget(content, path);

    const updated: EmbeddedVFSEntry = {
      ...entry,
      content,
      size: byteLength(content),
      revision: (entry.revision ?? 0) + 1
    };

    this.access.recordMutation(`Write ${entry.filename}`, () => {
      this.access.entries.set(path, updated);
      this.access.notifyChange();
      this.access.emitContentModified(path, updated.revision ?? 1);
    });
  }

  read(path: string): string {
    const entry = this.access.entries.get(path);

    if (!entry || !isEmbeddedVFSEntry(entry)) {
      throw new Error(`VFS: Embedded file not found: ${path}`);
    }

    this.assertReadable(path);

    return entry.content;
  }

  export(path: string): File {
    const entry = this.access.entries.get(path);

    if (!entry || !isEmbeddedVFSEntry(entry)) {
      throw new Error(`VFS: Embedded file not found: ${path}`);
    }

    return new File([entry.content], entry.filename, {
      type: entry.mimeType || 'text/plain;charset=utf-8'
    });
  }

  async prepareCopy(sourcePath: string, source: PatchImportSource): Promise<PatchImportItem[]> {
    return this.createImportPlanner().prepareCopy(sourcePath, source);
  }

  getImportCollisions(
    files: Iterable<File | PatchImportItem>,
    targetFolder: string = VFS_PREFIXES.PATCH
  ): string[] {
    return this.createImportPlanner().getCollisions(files, targetFolder);
  }

  async import(
    files: Iterable<File | PatchImportItem>,
    targetFolder: string = VFS_PREFIXES.PATCH,
    collision: VfsCollisionStrategy = 'keep-both'
  ): Promise<string[]> {
    const plan = await this.createImportPlanner().plan(files, targetFolder, collision);

    this.access.recordMutation(
      `Import ${plan.importedPaths.length} patch file${plan.importedPaths.length === 1 ? '' : 's'}`,
      () => {
        for (const path of plan.removedExistingPaths) {
          this.access.entries.delete(path);
        }

        for (const [path, entry] of plan.stagedEntries) {
          this.access.entries.set(path, entry);

          if (isEmbeddedVFSEntry(entry)) {
            this.access.emitContentModified(path, entry.revision ?? 1);
          }
        }

        this.access.notifyChange();
      }
    );

    return plan.importedPaths;
  }

  private resolveCollision(path: string, collision: VfsCollisionStrategy): string | null {
    const occupied = new Set(this.access.entries.keys());

    const hasCollision = (candidate: string) =>
      occupied.has(candidate) || [...occupied].some((item) => item.startsWith(`${candidate}/`));

    if (!hasCollision(path)) return path;
    if (collision === 'replace') return path;
    if (collision === 'cancel') return null;

    const filename = getFilename(path);
    const extension = getExtension(filename);
    const basename = getBasename(filename);
    const parent = path.slice(0, -filename.length);

    let counter = 1;
    let candidate = `${parent}${basename}-${counter}${extension}`;

    while (hasCollision(candidate)) {
      counter += 1;
      candidate = `${parent}${basename}-${counter}${extension}`;
    }

    return candidate;
  }

  private assertContentWithinBudget(content: string, path: string): void {
    const size = byteLength(content);

    if (size > MAX_EMBEDDED_FILE_BYTES) {
      throw new Error(`VFS: Embedded file exceeds 256 KiB: ${path}`);
    }

    if (this.getEmbeddedByteLength(path) + size > MAX_EMBEDDED_PATCH_BYTES) {
      throw new Error('VFS: Embedded patch files exceed 1 MiB');
    }
  }

  private getEmbeddedByteLength(excludingPath?: string): number {
    let total = 0;

    for (const [path, entry] of this.access.entries) {
      if (path !== excludingPath && isEmbeddedVFSEntry(entry)) {
        total += byteLength(entry.content);
      }
    }

    return total;
  }

  private createImportPlanner(): PatchImportPlanner {
    return new PatchImportPlanner(this.access.entries.snapshot());
  }
}

const byteLength = (content: string) => new TextEncoder().encode(content).byteLength;
