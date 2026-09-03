// Virtual Filesystem Singleton

import { writable, derived, type Readable } from 'svelte/store';
import { match } from 'ts-pattern';
import {
  type VFSEntry,
  type EmbeddedVFSEntry,
  type PatchImportItem,
  type VFSTree,
  type VFSTreeNode,
  type VFSProvider,
  type VFSListEntry,
  type VFSListPage,
  type VFSSearchPage,
  isVFSFolder,
  isEmbeddedVFSEntry,
  isVFSEntry,
  isVFSPath,
  parseVFSPath,
  VFS_PREFIXES
} from './types';
import {
  generateUserPath,
  getBasename,
  getExtension,
  getFilename,
  getFilenameFromUrl,
  guessMimeType
} from './path-utils';
import { clearFileData, clearHandles } from './persistence';
import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
import { HistoryManager, type Command } from '$lib/history';

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

declare global {
  interface Window {
    vfs: VirtualFilesystem;
  }
}

/**
 * Virtual Filesystem - singleton for managing file references.
 *
 * Files are referenced by VFS paths like:
 * - user://images/photo.jpg (user uploads)
 * - obj://csound~-24/sound.csd (node-specific files)
 *
 * The VFS stores metadata (VFSEntry) and delegates resolution to providers.
 */
export class VirtualFilesystem {
  private static instance: VirtualFilesystem | null = null;

  /** Flat map of path -> entry for quick lookups */
  private entries: Map<string, VFSEntry> = new Map();

  /** Registered providers */
  private providers: Map<string, VFSProvider> = new Map();

  /** Paths that need permission re-grant (local files after reload) */
  private pendingPermissions: Set<string> = new Set();

  /** Hydrated embedded files that exceed the patch limits and cannot be executed. */
  private invalidEmbeddedPaths: Map<string, string> = new Map();

  /** Version counter for reactivity - increments on any mutation */
  private versionStore = writable(0);

  /** Readable store of all entries - subscribe to this for reactive updates */
  readonly entries$: Readable<Map<string, VFSEntry>> = derived(this.versionStore, () =>
    this.getAllEntries()
  );

  /** Readable store of paths needing permission re-grant */
  readonly pendingPermissions$: Readable<Set<string>> = derived(
    this.versionStore,
    () => new Set(this.pendingPermissions)
  );

  private constructor() {
    // Private constructor for singleton
  }

  /** Notify subscribers that the VFS has changed */
  private notifyChange(): void {
    this.versionStore.update((v) => v + 1);
  }

  private cloneEntries(entries = this.entries): Map<string, VFSEntry> {
    return new Map([...entries].map(([path, entry]) => [path, { ...entry }] as [string, VFSEntry]));
  }

  private restoreEntries(entries: Map<string, VFSEntry>): void {
    const previous = this.entries;
    this.entries = this.cloneEntries(entries);
    this.invalidEmbeddedPaths = this.findInvalidEmbeddedPaths(this.entries);
    this.pendingPermissions = new Set(
      [...this.pendingPermissions].filter((path) => this.entries.has(path))
    );
    this.notifyChange();

    for (const [path, entry] of this.entries) {
      const prior = previous.get(path);
      if (
        isEmbeddedVFSEntry(entry) &&
        (!prior ||
          !isEmbeddedVFSEntry(prior) ||
          prior.content !== entry.content ||
          prior.revision !== entry.revision)
      ) {
        this.emitContentModified(path, entry.revision ?? 1);
      }
    }
  }

  private recordMutation(
    description: string,
    mutate: () => void,
    callbacks?: { redo?: () => void; undo?: () => void }
  ): void {
    const before = this.cloneEntries();

    mutate();
    this.invalidEmbeddedPaths = this.findInvalidEmbeddedPaths(this.entries);

    const after = this.cloneEntries();
    const command: Command = {
      description,
      execute: () => {
        this.restoreEntries(after);
        callbacks?.redo?.();
      },
      undo: () => {
        this.restoreEntries(before);
        callbacks?.undo?.();
      }
    };

    HistoryManager.getInstance().record(command);
  }

  private assertValidEntry(path: string, entry: VFSEntry, enforceEmbeddedLimits = true): void {
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
      throw new Error(`VFS: Embedded file content must be UTF-8 text: ${path}`);
    }

    if (enforceEmbeddedLimits && isEmbeddedVFSEntry(entry)) {
      this.assertEmbeddedContent(entry.content, path);
    }
  }

  private findInvalidEmbeddedPaths(entries: Map<string, VFSEntry>): Map<string, string> {
    const invalidPaths = new Map<string, string>();
    const encoder = new TextEncoder();
    let totalBytes = 0;

    for (const [path, entry] of entries) {
      if (!isEmbeddedVFSEntry(entry)) continue;

      const size = encoder.encode(entry.content).byteLength;
      totalBytes += size;

      if (size > MAX_EMBEDDED_FILE_BYTES) {
        invalidPaths.set(path, `VFS: Embedded file exceeds 256 KiB: ${path}`);
      }
    }

    if (totalBytes > MAX_EMBEDDED_PATCH_BYTES) {
      for (const [path, entry] of entries) {
        if (isEmbeddedVFSEntry(entry) && !invalidPaths.has(path)) {
          invalidPaths.set(path, 'VFS: Embedded patch files exceed 1 MiB');
        }
      }
    }

    return invalidPaths;
  }

  private assertEmbeddedContent(content: string, path: string): void {
    const size = new TextEncoder().encode(content).byteLength;
    if (size > MAX_EMBEDDED_FILE_BYTES) {
      throw new Error(`VFS: Embedded file exceeds 256 KiB: ${path}`);
    }

    const total = this.getEmbeddedByteLength(path) + size;
    if (total > MAX_EMBEDDED_PATCH_BYTES) {
      throw new Error('VFS: Embedded patch files exceed 1 MiB');
    }
  }

  private getEmbeddedByteLength(excludingPath?: string): number {
    const encoder = new TextEncoder();
    let total = 0;

    for (const [path, entry] of this.entries) {
      if (path === excludingPath || !isEmbeddedVFSEntry(entry)) continue;
      total += encoder.encode(entry.content).byteLength;
    }

    return total;
  }

  static getInstance(): VirtualFilesystem {
    if (!VirtualFilesystem.instance) {
      VirtualFilesystem.instance = new VirtualFilesystem();

      // Expose for debugging
      if (typeof window !== 'undefined') {
        window.vfs = VirtualFilesystem.instance;
      }
    }
    return VirtualFilesystem.instance;
  }

  /**
   * Reset the singleton (useful for testing).
   */
  static resetInstance(): void {
    VirtualFilesystem.instance = null;
  }

  // ─────────────────────────────────────────────────────────────────
  // Provider Management
  // ─────────────────────────────────────────────────────────────────

  registerProvider(provider: VFSProvider): void {
    this.providers.set(provider.type, provider);
  }

  getProvider(type: string): VFSProvider | undefined {
    return this.providers.get(type);
  }

  // ─────────────────────────────────────────────────────────────────
  // Registration
  // ─────────────────────────────────────────────────────────────────

  /**
   * Register a file entry at a specific path.
   */
  registerEntry(path: string, entry: VFSEntry): void {
    this.assertValidEntry(path, entry);
    this.entries.set(path, entry);
    this.notifyChange();
  }

  /** Create or replace a UTF-8 text file embedded in the current patch. */
  createEmbeddedFile(
    path: string,
    content = '',
    collision: VfsCollisionStrategy = 'cancel'
  ): string | null {
    const parsed = parseVFSPath(path);
    if (parsed?.namespace !== 'patch') {
      throw new Error(`VFS: Embedded files must use patch:// paths: ${path}`);
    }

    const destination = this.resolveCollision(path, collision);
    if (!destination) return null;

    const filename = destination.split('/').pop() ?? destination;
    const entry: EmbeddedVFSEntry = {
      provider: 'embedded',
      filename,
      mimeType: guessMimeType(filename) ?? 'text/plain;charset=utf-8',
      content,
      size: new TextEncoder().encode(content).byteLength,
      revision: 1
    };

    this.assertValidEntry(destination, entry);
    this.recordMutation(`Create ${filename}`, () => {
      this.entries.set(destination, entry);
      this.notifyChange();
      this.emitContentModified(destination, entry.revision ?? 1);
    });

    return destination;
  }

  /** Save embedded content as one undoable VFS operation. */
  writeEmbeddedFile(path: string, content: string): void {
    const entry = this.entries.get(path);
    if (!entry || !isEmbeddedVFSEntry(entry)) {
      throw new Error(`VFS: Embedded file not found: ${path}`);
    }

    this.assertEmbeddedContent(content, path);
    const updated: EmbeddedVFSEntry = {
      ...entry,
      content,
      size: new TextEncoder().encode(content).byteLength,
      revision: (entry.revision ?? 0) + 1
    };

    this.recordMutation(`Write ${entry.filename}`, () => {
      this.entries.set(path, updated);
      this.notifyChange();
      this.emitContentModified(path, updated.revision ?? 1);
    });
  }

  readEmbeddedFile(path: string): string {
    const entry = this.entries.get(path);
    if (!entry || !isEmbeddedVFSEntry(entry)) {
      throw new Error(`VFS: Embedded file not found: ${path}`);
    }

    const validationError = this.invalidEmbeddedPaths.get(path);
    if (validationError) throw new Error(validationError);

    return entry.content;
  }

  /** Return embedded bytes for explicit export, including quarantined recovery files. */
  exportEmbeddedFile(path: string): File {
    const entry = this.entries.get(path);
    if (!entry || !isEmbeddedVFSEntry(entry)) {
      throw new Error(`VFS: Embedded file not found: ${path}`);
    }

    return new File([entry.content], entry.filename, {
      type: entry.mimeType || 'text/plain;charset=utf-8'
    });
  }

  private resolveCollision(
    path: string,
    collision: VfsCollisionStrategy,
    occupied = new Set(this.entries.keys()),
    directory = false
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

  private emitContentModified(path: string, revision: number): void {
    PatchiesEventBus.getInstance().dispatch({ type: 'vfsContentModified', path, revision });
  }

  /**
   * Register a local file and return its generated VFS path.
   * The file will be stored via the LocalFilesystemProvider.
   * @deprecated Use storeFile() instead for clarity
   */
  async registerLocalFile(file: File): Promise<string> {
    return this.storeFile(file);
  }

  /**
   * Store a local file in the VFS and return its generated path.
   * Optionally provide a FileSystemFileHandle for better persistence in Chrome/Edge.
   * Optionally provide a targetFolder to place the file in a specific folder.
   */
  async storeFile(
    file: File,
    handle?: FileSystemFileHandle,
    targetFolder?: string
  ): Promise<string> {
    const existingPaths = new Set(this.entries.keys());
    const path = generateUserPath(file.name, file.type, existingPaths, targetFolder);

    const entry: VFSEntry = {
      provider: 'local',
      filename: file.name,
      mimeType:
        file.type?.startsWith('audio/') ||
        file.type?.startsWith('video/') ||
        file.type?.startsWith('image/')
          ? file.type
          : (guessMimeType(file.name) ?? file.type),
      size: file.size
    };

    // Store via provider
    const provider = this.providers.get('local');
    if (provider && 'storeFile' in provider) {
      const localProvider = provider as VFSProvider & {
        storeFile: (path: string, file: File, handle?: FileSystemFileHandle) => Promise<void>;
        storeFileWithHandle: (
          path: string,
          file: File,
          handle: FileSystemFileHandle
        ) => Promise<void>;
      };

      if (handle && 'storeFileWithHandle' in localProvider) {
        await localProvider.storeFileWithHandle(path, file, handle);
      } else {
        await localProvider.storeFile(path, file);
      }
    }

    this.recordMutation(`Add ${file.name}`, () => {
      this.entries.set(path, entry);
      this.notifyChange();
    });
    return path;
  }

  /**
   * Replace a file at an existing path (for re-linking files that lost permission).
   * This updates the file data and clears the pending permission status.
   */
  async replaceFile(path: string, file: File, handle?: FileSystemFileHandle): Promise<void> {
    const entry = this.entries.get(path);
    if (!entry) {
      throw new Error(`VFS: Cannot replace file at non-existent path: ${path}`);
    }

    const localProvider = this.getLocalProvider();
    const previousProviderState = await localProvider?.captureFileState(path);
    const replacementProviderState = { file, handle };
    const wasPendingPermission = this.pendingPermissions.has(path);
    const updatedEntry: VFSEntry = {
      ...entry,
      filename: file.name,
      mimeType: file.type || guessMimeType(file.name),
      size: file.size
    };
    const dispatchRelinked = () =>
      PatchiesEventBus.getInstance().dispatch({ type: 'fileRelinked', path });
    const restoreProviderState = (
      state: import('./providers/LocalFilesystemProvider').LocalFileState | undefined,
      pendingPermission: boolean
    ) => {
      if (pendingPermission) {
        this.pendingPermissions.add(path);
      } else {
        this.pendingPermissions.delete(path);
      }
      this.notifyChange();

      if (!localProvider || !state) {
        dispatchRelinked();
        return;
      }

      void localProvider
        .restoreFileState(path, state)
        .then(dispatchRelinked)
        .catch((error) => console.error('VFS: Failed to restore replaced file state', error));
    };

    if (localProvider) {
      try {
        await localProvider.restoreFileState(path, replacementProviderState);
      } catch (error) {
        if (previousProviderState) {
          await localProvider.restoreFileState(path, previousProviderState);
        }

        throw error;
      }
    }

    this.recordMutation(
      `Replace ${entry.filename}`,
      () => {
        this.entries.set(path, updatedEntry);
        this.pendingPermissions.delete(path);
        this.notifyChange();
        dispatchRelinked();
      },
      {
        redo: () => restoreProviderState(replacementProviderState, false),
        undo: () => restoreProviderState(previousProviderState, wasPendingPermission)
      }
    );
  }

  /**
   * Register a URL and return its generated VFS path.
   * Optionally provide a targetFolder to place the file in a specific folder.
   */
  async registerUrl(url: string, targetFolder?: string): Promise<string> {
    const filename = getFilenameFromUrl(url);
    const mimeType = guessMimeType(filename);
    const existingPaths = new Set(this.entries.keys());
    const path = generateUserPath(filename, mimeType, existingPaths, targetFolder);

    // Ensure the target folder entry exists in VFS so it appears in the tree
    if (targetFolder && !this.entries.has(targetFolder)) {
      const folderName = targetFolder.split('/').pop() ?? targetFolder;
      this.entries.set(targetFolder, { provider: 'folder', filename: folderName });
    }

    const entry: VFSEntry = {
      provider: 'url',
      url,
      filename,
      mimeType
    };

    this.recordMutation(`Add ${filename}`, () => {
      this.entries.set(path, entry);
      this.notifyChange();
    });

    return path;
  }

  /**
   * Create a folder at the specified path.
   * @param parentPath - Parent folder path (e.g., 'user://' or 'user://images')
   * @param folderName - Name of the new folder
   * @returns The full path of the created folder
   */
  createFolder(parentPath: string, folderName: string): string {
    // Normalize parent path (remove trailing slash if present, except for namespace roots)
    const normalizedParent =
      parentPath.endsWith('/') && !parentPath.endsWith('://')
        ? parentPath.slice(0, -1)
        : parentPath;

    // Build the full folder path
    const folderPath = normalizedParent.endsWith('://')
      ? `${normalizedParent}${folderName}`
      : `${normalizedParent}/${folderName}`;

    const entry: VFSEntry = {
      provider: 'folder',
      filename: folderName
    };

    this.recordMutation(`Create ${folderName}`, () => {
      this.entries.set(folderPath, entry);
      this.notifyChange();
    });

    return folderPath;
  }

  /**
   * Check if a path is a folder.
   */
  isFolder(path: string): boolean {
    const entry = this.entries.get(path);
    return entry?.provider === 'folder' || entry?.provider === 'local-folder';
  }

  /** Rename a file or folder tree without changing its ownership namespace. */
  renamePath(oldPath: string, newPath: string): void {
    const oldParsed = parseVFSPath(oldPath);
    const newParsed = parseVFSPath(newPath);
    if (!oldParsed || !newParsed || oldParsed.namespace !== newParsed.namespace) {
      throw new Error('VFS: Files can only be renamed within their namespace');
    }
    if (!this.entries.has(oldPath)) throw new Error(`VFS: Path not found: ${oldPath}`);
    if (this.entries.has(newPath)) throw new Error(`VFS: Path already exists: ${newPath}`);

    const paths = this.list().filter((path) => path === oldPath || path.startsWith(`${oldPath}/`));
    const renamed = paths.map((path) => {
      const entry = this.entries.get(path)!;
      const destination = path === oldPath ? newPath : `${newPath}${path.slice(oldPath.length)}`;
      const filename = destination.split('/').pop() ?? entry.filename;

      return [destination, { ...entry, filename }] as const;
    });

    const movedPaths = new Set(paths);
    for (const [destination] of renamed) {
      if (this.entries.has(destination) && !movedPaths.has(destination)) {
        throw new Error(`VFS: Path already exists: ${destination}`);
      }
    }

    const moves = renamed.map(([newPath, entry], index) => ({
      oldPath: paths[index],
      newPath,
      entry
    }));
    const movePersistedEntries = (direction: 'forward' | 'backward') => {
      const provider = this.getLocalProvider();
      if (!provider) return;

      for (const move of moves) {
        const from = direction === 'forward' ? move.oldPath : move.newPath;
        const to = direction === 'forward' ? move.newPath : move.oldPath;

        if (move.entry.provider === 'local') {
          void provider.rename(from, to);
        } else if (move.entry.provider === 'local-folder') {
          void provider.renameDirHandle(from, to);
        }
      }
    };
    const emitPathRenames = (direction: 'forward' | 'backward') => {
      for (const move of moves) {
        PatchiesEventBus.getInstance().dispatch({
          type: 'vfsPathRenamed',
          oldPath: direction === 'forward' ? move.oldPath : move.newPath,
          newPath: direction === 'forward' ? move.newPath : move.oldPath
        });
      }
    };

    this.recordMutation(
      `Rename ${oldPath.split('/').pop()}`,
      () => {
        for (const path of paths) this.entries.delete(path);
        for (const [path, entry] of renamed) this.entries.set(path, entry);
        movePersistedEntries('forward');
        this.notifyChange();
        emitPathRenames('forward');
      },
      {
        redo: () => {
          movePersistedEntries('forward');
          emitPathRenames('forward');
        },
        undo: () => {
          movePersistedEntries('backward');
          emitPathRenames('backward');
        }
      }
    );
  }

  /** Delete a file or a complete folder tree as one undoable operation. */
  deletePath(path: string): void {
    this.deletePaths([path]);
  }

  /** Delete multiple paths, collapsing descendants into one undoable operation. */
  deletePaths(requestedPaths: Iterable<string>): void {
    const requested = [...new Set(requestedPaths)];
    const roots = requested.filter(
      (path) => !requested.some((other) => other !== path && path.startsWith(`${other}/`))
    );

    for (const path of roots) {
      if (!this.entries.has(path)) throw new Error(`VFS: Path not found: ${path}`);
    }

    const paths = this.list().filter((item) =>
      roots.some((root) => item === root || item.startsWith(`${root}/`))
    );
    if (paths.length === 0) return;

    const linkedFolderPaths = paths.filter(
      (item) => this.entries.get(item)?.provider === 'local-folder'
    );
    const setLinkedFoldersDeleted = (deleted: boolean) => {
      const provider = this.getLocalProvider();
      if (!provider) return;

      for (const linkedFolderPath of linkedFolderPaths) {
        const operation = deleted
          ? provider.hideDirHandle(linkedFolderPath)
          : provider.restoreDirHandle(linkedFolderPath);
        void operation.catch((error) =>
          console.error('VFS: Failed to update deleted folder state', error)
        );
      }
    };

    this.recordMutation(
      roots.length === 1 ? `Delete ${roots[0].split('/').pop()}` : `Delete ${roots.length} paths`,
      () => {
        for (const item of paths) {
          this.entries.delete(item);
          this.pendingPermissions.delete(item);
        }
        setLinkedFoldersDeleted(true);
        this.notifyChange();
      },
      {
        redo: () => setLinkedFoldersDeleted(true),
        undo: () => setLinkedFoldersDeleted(false)
      }
    );
  }

  /** Copy a user-owned text file into patch ownership without moving the original. */
  async copyToPatch(
    sourcePath: string,
    targetFolder: string = VFS_PREFIXES.PATCH,
    collision: VfsCollisionStrategy = 'cancel'
  ): Promise<string | null> {
    const items = await this.preparePatchCopy(sourcePath);
    const imported = await this.importToPatch(items, targetFolder, collision);

    return imported[0] ?? null;
  }

  /** Resolve a User file or folder into a portable, atomic Patch import batch. */
  async preparePatchCopy(sourcePath: string): Promise<PatchImportItem[]> {
    const source = this.getEntryOrLinkedFile(sourcePath);
    if (!source) throw new Error(`VFS: Path not found: ${sourcePath}`);

    if (!isVFSFolder(source)) {
      this.assertPatchCopySize(source);

      const blob = await this.resolve(sourcePath);
      const file =
        blob instanceof File
          ? blob
          : new File([blob], source.filename, { type: source.mimeType ?? blob.type });

      return [{ kind: 'file', file, relativePath: source.filename }];
    }

    const rootName = source.filename;
    const items: PatchImportItem[] = [{ kind: 'directory', relativePath: rootName }];
    const collectChildren = async (directory: string, relativeDirectory: string): Promise<void> => {
      for (const child of await this.listChildren(directory)) {
        const relativePath = `${relativeDirectory}/${child.name}`;

        if (child.kind === 'directory') {
          items.push({ kind: 'directory', relativePath });
          await collectChildren(child.path, relativePath);

          continue;
        }

        const entry = this.getEntryOrLinkedFile(child.path);
        if (!entry) throw new Error(`VFS: File not found: ${child.path}`);
        this.assertPatchCopySize(entry);

        const blob = await this.resolve(child.path);
        const file =
          blob instanceof File
            ? blob
            : new File([blob], entry.filename, { type: entry.mimeType ?? blob.type });
        items.push({ kind: 'file', file, relativePath });
      }
    };

    await collectChildren(sourcePath, rootName);

    return items;
  }

  private assertPatchCopySize(entry: VFSEntry): void {
    if (entry.size && entry.size > MAX_EMBEDDED_FILE_BYTES) {
      throw new Error(`VFS: ${entry.filename} exceeds 256 KiB Patch-file limit`);
    }
  }

  /** Return top-level destination paths that require a collision decision. */
  getPatchImportCollisions(
    files: Iterable<File | PatchImportItem>,
    targetFolder: string = VFS_PREFIXES.PATCH
  ): string[] {
    const items = this.normalizePatchImportItems(files);
    const collisions = items
      .map((item) => this.joinVfsPath(targetFolder, item.relativePath))
      .filter((path) =>
        [...this.entries.keys()].some(
          (existing) => existing === path || existing.startsWith(`${path}/`)
        )
      );

    return [...new Set(collisions)].filter(
      (path, _, all) => !all.some((other) => other !== path && path.startsWith(`${other}/`))
    );
  }

  /** Import text files atomically: an invalid file or budget violation imports nothing. */
  async importToPatch(
    files: Iterable<File | PatchImportItem>,
    targetFolder: string = VFS_PREFIXES.PATCH,
    collision: VfsCollisionStrategy = 'keep-both'
  ): Promise<string[]> {
    if (!targetFolder.startsWith(VFS_PREFIXES.PATCH)) {
      throw new Error(`VFS: Patch destination required: ${targetFolder}`);
    }

    const items = this.normalizePatchImportItems(files);
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

    const staged = new Map<string, VFSEntry>();
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
        if (isEmbeddedVFSEntry(entry)) {
          totalBytes -= new TextEncoder().encode(entry.content).byteLength;
        }
      }
    };
    const removeStagedTree = (path: string) => {
      for (const [stagedPath, entry] of staged) {
        if (stagedPath !== path && !stagedPath.startsWith(`${path}/`)) continue;

        staged.delete(stagedPath);
        occupied.delete(stagedPath);
        if (isEmbeddedVFSEntry(entry)) {
          totalBytes -= new TextEncoder().encode(entry.content).byteLength;
        }
      }
    };
    const resolveParent = (relativePath: string) => {
      const separator = relativePath.lastIndexOf('/');
      if (separator === -1) {
        return targetFolder;
      }

      const relativeParent = relativePath.slice(0, separator);

      return resolvedDirectories.get(relativeParent);
    };

    for (const item of items) {
      const parent = resolveParent(item.relativePath);
      if (!parent) throw new Error(`VFS: Invalid import path: ${item.relativePath}`);

      const name = getFilename(item.relativePath);
      const rawPath = this.joinVfsPath(parent, name);
      const priorEntry = staged.get(rawPath) ?? this.entries.get(rawPath);
      const path = this.resolveCollision(rawPath, collision, occupied, item.kind === 'directory');
      if (!path) throw new Error(`VFS: Import cancelled because ${name} already exists`);

      if (collision === 'replace' && path === rawPath) {
        removeStagedTree(path);
        removeExistingTree(path);
      }

      if (item.kind === 'directory') {
        resolvedDirectories.set(item.relativePath, path);
        staged.set(path, { provider: 'folder', filename: getFilename(path) });
        occupied.add(path);

        continue;
      }

      const content = decodedContent.get(item)!;
      const size = new TextEncoder().encode(content).byteLength;

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
      staged.set(path, entry);
    }

    const importedFiles = [...staged].filter(([, entry]) => isEmbeddedVFSEntry(entry));
    this.recordMutation(
      `Import ${importedFiles.length} patch file${importedFiles.length === 1 ? '' : 's'}`,
      () => {
        for (const path of removedExistingPaths) this.entries.delete(path);
        for (const [path, entry] of staged) {
          this.entries.set(path, entry);
          if (isEmbeddedVFSEntry(entry)) {
            this.emitContentModified(path, entry.revision ?? 1);
          }
        }
        this.notifyChange();
      }
    );

    return importedFiles.map(([path]) => path);
  }

  private normalizePatchImportItems(files: Iterable<File | PatchImportItem>): PatchImportItem[] {
    const directories = new Set<string>();
    const fileItems: PatchImportItem[] = [];

    for (const input of files) {
      const item: PatchImportItem =
        input instanceof File
          ? { kind: 'file', file: input, relativePath: this.getImportRelativePath(input) }
          : { ...input, relativePath: this.normalizeImportRelativePath(input.relativePath) };
      const segments = item.relativePath.split('/');

      for (let index = 1; index < segments.length; index += 1) {
        directories.add(segments.slice(0, index).join('/'));
      }

      if (item.kind === 'directory') {
        directories.add(item.relativePath);
      } else {
        fileItems.push(item);
      }
    }

    const directoryItems: PatchImportItem[] = [...directories]
      .sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))
      .map((relativePath) => ({ kind: 'directory', relativePath }));

    return [...directoryItems, ...fileItems];
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
    return this.normalizeImportRelativePath(relativePath || file.name);
  }

  private normalizeImportRelativePath(relativePath: string): string {
    const normalized = relativePath.replaceAll('\\', '/');
    const segments = normalized.split('/').filter(Boolean);

    if (segments.length === 0 || segments.some((segment) => segment === '.' || segment === '..')) {
      throw new Error(`VFS: Invalid import path: ${normalized}`);
    }

    return segments.join('/');
  }

  private joinVfsPath(parent: string, child: string): string {
    if (parent.endsWith('://') || parent.endsWith('/')) return `${parent}${child}`;

    return `${parent}/${child}`;
  }

  // ─────────────────────────────────────────────────────────────────
  // Local Folder Linking (delegates to LocalFilesystemProvider)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Link a local folder using a FileSystemDirectoryHandle.
   * The VFS only stores the folder entry; contents are resolved on-demand by the provider.
   */
  async linkLocalFolder(handle: FileSystemDirectoryHandle): Promise<string> {
    const folderName = handle.name;
    const existingPaths = new Set(this.entries.keys());

    // Generate a unique path under user://
    let path = `user://${folderName}`;
    let counter = 1;
    while (existingPaths.has(path)) {
      path = `user://${folderName}-${counter}`;
      counter++;
    }

    const entry: VFSEntry = {
      provider: 'local-folder',
      filename: folderName
    };

    this.entries.set(path, entry);

    // Delegate storage to provider
    const provider = this.getLocalProvider();
    if (provider) {
      await provider.storeDirHandle(path, handle);
    }

    this.notifyChange();
    return path;
  }

  /**
   * Re-link a local folder that lost its handle (e.g., after sharing a patch).
   * Updates the existing entry with a new directory handle.
   */
  async relinkLocalFolder(path: string, handle: FileSystemDirectoryHandle): Promise<void> {
    const entry = this.entries.get(path);
    if (!entry || entry.provider !== 'local-folder') {
      throw new Error(`VFS: Cannot relink - path is not a linked folder: ${path}`);
    }

    // Update the entry filename in case the new folder has a different name
    entry.filename = handle.name;

    // Store the new handle
    const provider = this.getLocalProvider();
    if (provider) {
      await provider.storeDirHandle(path, handle);
    }

    // Clear pending permission status
    this.pendingPermissions.delete(path);
    this.notifyChange();
  }

  /**
   * Get the local provider instance (for directory operations).
   */
  private getLocalProvider():
    | import('./providers/LocalFilesystemProvider').LocalFilesystemProvider
    | undefined {
    const provider = this.providers.get('local');
    if (provider && 'storeDirHandle' in provider) {
      return provider as import('./providers/LocalFilesystemProvider').LocalFilesystemProvider;
    }
    return undefined;
  }

  // ─────────────────────────────────────────────────────────────────
  // Resolution
  // ─────────────────────────────────────────────────────────────────

  /**
   * Resolve a VFS path to actual file content.
   * Supports paths within linked folders (e.g., user://my-folder/subdir/file.jpg)
   */
  async resolve(path: string): Promise<File | Blob> {
    const entry = this.entries.get(path);
    if (entry) {
      if (isEmbeddedVFSEntry(entry)) {
        const validationError = this.invalidEmbeddedPaths.get(path);
        if (validationError) throw new Error(validationError);
      }

      // Direct entry found
      const provider = this.providers.get(entry.provider);
      if (!provider) {
        throw new Error(`VFS: No provider registered for type: ${entry.provider}`);
      }
      return provider.resolve(entry, path);
    }

    // Entry not found - check if it's a path within a linked folder
    const linkedFolderPath = this.findLinkedFolderForPath(path);
    if (linkedFolderPath) {
      const localProvider = this.getLocalProvider();
      if (!localProvider) {
        throw new Error(`VFS: Local provider not available for linked folder resolution`);
      }

      // Extract relative path within the linked folder
      const relativePath = path.slice(linkedFolderPath.length + 1).split('/');
      return localProvider.resolveFileInDir(linkedFolderPath, relativePath);
    }

    throw new Error(`VFS: Path not found: ${path}`);
  }

  /**
   * Find the linked folder path that contains a given path.
   * E.g., for "user://my-folder/sub/file.jpg" returns "user://my-folder" if it's a linked folder.
   */
  private findLinkedFolderForPath(path: string): string | null {
    // Check each potential parent path to find a linked folder
    const segments = path.split('/');

    // Start from the namespace (e.g., "user://my-folder")
    for (let i = 3; i < segments.length; i++) {
      const potentialFolderPath = segments.slice(0, i).join('/');
      const entry = this.entries.get(potentialFolderPath);
      if (entry?.provider === 'local-folder') {
        return potentialFolderPath;
      }
    }
    return null;
  }

  /**
   * Check if a path is within a linked folder.
   */
  isPathInLinkedFolder(path: string): boolean {
    return this.findLinkedFolderForPath(path) !== null;
  }

  /**
   * Get metadata for a path, including paths within linked folders.
   * For linked folder files, returns a synthetic entry.
   */
  getEntryOrLinkedFile(path: string): VFSEntry | undefined {
    const entry = this.entries.get(path);

    if (entry) {
      // Fall back to guessing MIME type if not stored (for files added before MIME support)
      if (!entry.mimeType) {
        return { ...entry, mimeType: guessMimeType(entry.filename) };
      }

      return entry;
    }

    // Check if it's within a linked folder
    const linkedFolderPath = this.findLinkedFolderForPath(path);
    if (linkedFolderPath) {
      const filename = path.split('/').pop() || '';
      return {
        provider: 'local',
        filename,
        mimeType: guessMimeType(filename)
      };
    }
    return undefined;
  }

  /**
   * Get the entry metadata for a path.
   */
  getEntry(path: string): VFSEntry | undefined {
    return this.entries.get(path);
  }

  /**
   * Check if a path exists in the VFS.
   */
  has(path: string): boolean {
    return this.entries.has(path);
  }

  /**
   * Check if a string is a VFS path.
   */
  isVFSPath(path: string): boolean {
    return isVFSPath(path);
  }

  // ─────────────────────────────────────────────────────────────────
  // Listing
  // ─────────────────────────────────────────────────────────────────

  /**
   * List all paths, optionally filtered by prefix.
   */
  list(prefix?: string): string[] {
    const paths = Array.from(this.entries.keys());
    if (!prefix) return paths;
    return paths.filter((p) => p.startsWith(prefix));
  }

  /** List the immediate children of a VFS directory, including linked local folders. */
  async listChildren(directory: string): Promise<VFSListEntry[]> {
    const entry = this.entries.get(directory);
    const prefix = directory.endsWith('://') ? directory : `${directory}/`;
    const linkedFolderPath = this.getLinkedFolderForPath(directory);
    const hasChildren = [...this.entries.keys()].some((path) => path.startsWith(prefix));
    const isNamespaceRoot =
      directory === VFS_PREFIXES.PATCH ||
      directory === VFS_PREFIXES.USER ||
      directory === VFS_PREFIXES.OBJECT;

    if (entry && entry.provider !== 'folder' && entry.provider !== 'local-folder') {
      throw new TypeError(`VFS: Path is not a directory: ${directory}`);
    }

    if (!entry && !linkedFolderPath && !hasChildren && !isNamespaceRoot) {
      throw new Error(`VFS: Directory not found: ${directory}`);
    }

    const children = new Map<string, VFSListEntry>();

    for (const path of this.entries.keys()) {
      if (!path.startsWith(prefix)) continue;

      const child = path.slice(prefix.length).split('/')[0];
      if (!child) continue;

      const childPath = `${prefix}${child}`;
      children.set(childPath, this.createListEntry(childPath));
    }

    if (linkedFolderPath) {
      const linkedChildren = await this.listLinkedFolderChildren(directory, linkedFolderPath);

      for (const child of linkedChildren) {
        children.set(child.path, this.createListEntry(child.path, child.kind));
      }
    }

    return [...children.values()].sort((a, b) => a.path.localeCompare(b.path));
  }

  /** List one bounded page of immediate VFS directory entries. */
  async listChildrenPage(
    directory: string,
    options: { offset?: number; limit?: number } = {}
  ): Promise<VFSListPage> {
    const offset = Math.max(0, Math.floor(options.offset ?? 0));
    const limit = Math.max(1, Math.floor(options.limit ?? 50));

    const linkedFolderPath = this.getLinkedFolderForPath(directory);

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

  /** Recursively find VFS paths whose path includes the query, case-insensitively. */
  async search(query: string, directory: string): Promise<VFSListEntry[]> {
    const prefix = directory.endsWith('://') ? directory : `${directory}/`;
    const normalizedQuery = query.toLowerCase();
    const matches = new Map<string, VFSListEntry>();

    for (const path of this.list(prefix)) {
      if (path.toLowerCase().includes(normalizedQuery)) {
        matches.set(path, this.createListEntry(path));
      }
    }

    const containingLinkedFolder = this.getLinkedFolderForPath(directory);

    const linkedFolderPaths = containingLinkedFolder
      ? [containingLinkedFolder]
      : [...this.entries]
          .filter(([path, entry]) => entry.provider === 'local-folder' && path.startsWith(prefix))
          .map(([path]) => path);

    for (const linkedFolderPath of linkedFolderPaths) {
      const searchRoot = containingLinkedFolder ? directory : linkedFolderPath;

      for (const entry of await this.searchLinkedFolder(searchRoot, linkedFolderPath)) {
        if (entry.path.toLowerCase().includes(normalizedQuery)) {
          matches.set(entry.path, entry);
        }
      }
    }

    return [...matches.values()].sort((a, b) => a.path.localeCompare(b.path));
  }

  /**
   * Recursively search VFS paths without materializing more than one result page.
   * Entries are visited in deterministic directory traversal order.
   */
  async searchPage(
    query: string,
    directory: string,
    options: { offset?: number; limit?: number } = {}
  ): Promise<VFSSearchPage> {
    const offset = Math.max(0, Math.floor(options.offset ?? 0));
    const limit = Math.max(1, Math.floor(options.limit ?? 50));

    const normalizedQuery = query.toLowerCase();
    const entries: VFSListEntry[] = [];

    let skipped = 0;

    const visit = async (currentDirectory: string): Promise<boolean> => {
      const children = await this.listChildren(currentDirectory);

      for (const child of children) {
        if (child.path.toLowerCase().includes(normalizedQuery)) {
          if (skipped < offset) {
            skipped++;
          } else if (entries.length < limit) {
            entries.push(child);
          } else {
            return true;
          }
        }

        if (child.kind === 'directory' && (await visit(child.path))) {
          return true;
        }
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

    return [...this.entries.keys()].some((entryPath) => entryPath.startsWith(`${path}/`))
      ? 'directory'
      : 'file';
  }

  private getLinkedFolderForPath(path: string): string | null {
    return this.entries.get(path)?.provider === 'local-folder'
      ? path
      : this.findLinkedFolderForPath(path);
  }

  private async listLinkedFolderChildren(
    directory: string,
    linkedFolderPath: string,
    options?: { offset?: number; limit?: number }
  ): Promise<Array<{ path: string; kind: 'file' | 'directory' }>> {
    const localProvider = this.getLocalProvider();

    if (!localProvider) {
      throw new Error('VFS: Local provider not available for linked folder listing');
    }

    let handle = await localProvider.getDirHandle(linkedFolderPath);

    if (!handle) {
      throw new Error(`VFS: No directory handle for linked folder: ${linkedFolderPath}`);
    }

    const hasDirectoryPermission = await localProvider.hasDirPermission(linkedFolderPath);

    if (!hasDirectoryPermission) {
      throw new Error(`VFS: Permission denied for linked folder: ${linkedFolderPath}`);
    }

    const relativeSegments =
      directory === linkedFolderPath ? [] : directory.slice(linkedFolderPath.length + 1).split('/');

    for (const segment of relativeSegments) {
      handle = await handle.getDirectoryHandle(segment);
    }

    const entries = await localProvider.listHandleContents(handle, options);
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

  /**
   * Get all entries as a map.
   */
  getAllEntries(): Map<string, VFSEntry> {
    return new Map(this.entries);
  }

  // ─────────────────────────────────────────────────────────────────
  // Persistence (Serialize/Hydrate)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Serialize the VFS to a tree structure for patch saving.
   */
  serialize(): VFSTree {
    const tree: VFSTree = {};

    for (const [path, entry] of this.entries) {
      const parsed = parseVFSPath(path);
      if (!parsed) continue;

      match(parsed.namespace)
        .with('patch', () => {
          if (!tree.patch) tree.patch = {};
          this.setNestedEntry(tree.patch, parsed.segments, { ...entry });
        })
        .with('user', () => {
          if (!tree.user) tree.user = {};
          this.setNestedEntry(tree.user, parsed.segments, { ...entry });
        })
        .with('obj', () => {
          if (!tree.objects) tree.objects = {};
          // First segment is the node ID
          const [nodeId, ...rest] = parsed.segments;
          if (!nodeId) return;
          if (!tree.objects[nodeId]) tree.objects[nodeId] = {};
          if (rest.length > 0) {
            this.setNestedEntry(tree.objects[nodeId], rest, { ...entry });
          }
        })
        .exhaustive();
    }

    return tree;
  }

  /**
   * Hydrate the VFS from a saved tree structure.
   */
  async hydrate(tree: VFSTree): Promise<void> {
    const hydrated = new Map<string, VFSEntry>();
    this.collectHydratedNamespace(hydrated, tree.patch, VFS_PREFIXES.PATCH);
    this.collectHydratedNamespace(hydrated, tree.user, VFS_PREFIXES.USER);
    if (tree.objects) {
      for (const [nodeId, nodeTree] of Object.entries(tree.objects)) {
        this.collectHydratedNamespace(hydrated, nodeTree, `${VFS_PREFIXES.OBJECT}${nodeId}/`);
      }
    }

    this.entries.clear();
    this.pendingPermissions.clear();
    this.entries = hydrated;
    this.invalidEmbeddedPaths = this.findInvalidEmbeddedPaths(hydrated);

    // Check which local files need permission
    for (const [path, entry] of this.entries) {
      if (entry.provider === 'local') {
        const provider = this.providers.get('local');

        if (provider && 'needsPermission' in provider) {
          const needs = await (
            provider as VFSProvider & { needsPermission: (path: string) => Promise<boolean> }
          ).needsPermission(path);

          if (needs) {
            this.pendingPermissions.add(path);
          }
        }

        continue;
      }

      if (entry.provider === 'local-folder') {
        // Check if linked folder has its handle available
        const localProvider = this.getLocalProvider();

        if (localProvider) {
          const handle = await localProvider.getDirHandle(path);

          if (!handle) {
            // Handle is missing - needs re-link
            this.pendingPermissions.add(path);
          } else {
            // Handle exists, check permission
            const hasPermission = await localProvider.hasDirPermission(path);

            if (!hasPermission) {
              this.pendingPermissions.add(path);
            }
          }
        }

        continue;
      }
    }

    this.notifyChange();
  }

  private hydrateNamespace(node: { [key: string]: VFSTreeNode }, prefix: string): void {
    for (const [key, value] of Object.entries(node)) {
      if (isVFSEntry(value)) {
        this.entries.set(`${prefix}${key}`, value);
      } else {
        // It's a directory, recurse
        this.hydrateNamespace(value as { [key: string]: VFSTreeNode }, `${prefix}${key}/`);
      }
    }
  }

  private collectHydratedNamespace(
    entries: Map<string, VFSEntry>,
    node: { [key: string]: VFSTreeNode } | undefined,
    prefix: string
  ): void {
    if (!node) return;

    for (const [key, value] of Object.entries(node)) {
      const path = `${prefix}${key}`;
      if (isVFSEntry(value)) {
        const entry = { ...value };
        this.assertValidEntry(path, entry, false);
        entries.set(path, entry);
      } else {
        this.collectHydratedNamespace(entries, value as { [key: string]: VFSTreeNode }, `${path}/`);
      }
    }
  }

  private setNestedEntry(
    obj: { [key: string]: VFSTreeNode },
    segments: string[],
    entry: VFSEntry
  ): void {
    if (segments.length === 0) return;

    if (segments.length === 1) {
      obj[segments[0]] = entry;
      return;
    }

    const [first, ...rest] = segments;
    if (!obj[first] || isVFSEntry(obj[first])) {
      obj[first] = {};
    }
    this.setNestedEntry(obj[first] as { [key: string]: VFSTreeNode }, rest, entry);
  }

  // ─────────────────────────────────────────────────────────────────
  // Permission Management
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get paths that need permission re-grant.
   */
  getPendingPermissions(): string[] {
    return Array.from(this.pendingPermissions);
  }

  /**
   * Request permission for a single path.
   */
  async requestPermission(path: string): Promise<boolean> {
    const entry = this.entries.get(path);
    if (!entry || entry.provider !== 'local') return false;

    const provider = this.providers.get('local');
    if (!provider || !('requestPermission' in provider)) return false;

    const granted = await (
      provider as VFSProvider & { requestPermission: (path: string) => Promise<boolean> }
    ).requestPermission(path);
    if (granted) {
      this.pendingPermissions.delete(path);
    }
    return granted;
  }

  /**
   * Request permission for all pending paths.
   */
  async requestAllPermissions(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const path of this.pendingPermissions) {
      const granted = await this.requestPermission(path);
      results.set(path, granted);
    }

    return results;
  }

  /**
   * Mark a path as having permission granted.
   */
  markPermissionGranted(path: string): void {
    this.pendingPermissions.delete(path);
  }

  // ─────────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────────

  /**
   * Remove a single entry.
   */
  remove(path: string): void {
    const entry = this.entries.get(path);

    this.entries.delete(path);
    this.pendingPermissions.delete(path);

    // Clean up directory handle if it's a local folder
    if (entry?.provider === 'local-folder') {
      const provider = this.getLocalProvider();
      provider?.removeDirHandle(path);
    }

    this.notifyChange();
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.entries.clear();
    this.pendingPermissions.clear();
    this.invalidEmbeddedPaths.clear();

    const localProvider = this.getLocalProvider();
    localProvider?.clear();
    localProvider?.clearDirHandles();

    this.notifyChange();
  }

  clearPersistedData(): void {
    clearHandles();
    clearFileData();
  }

  /**
   * Load directory handles from storage and create entries for them.
   * Call this during app initialization.
   */
  async loadDirHandlesFromStorage(): Promise<void> {
    const provider = this.getLocalProvider();
    if (!provider) return;

    const handles = await provider.loadDirHandlesFromStorage();
    for (const [path, handle] of handles) {
      // Create entry if it doesn't exist
      if (!this.entries.has(path)) {
        this.entries.set(path, {
          provider: 'local-folder',
          filename: handle.name
        });
      }

      // Check permission status
      const hasPermission = await provider.hasDirPermission(path);
      if (!hasPermission) {
        this.pendingPermissions.add(path);
      }
    }

    this.notifyChange();
  }
}
