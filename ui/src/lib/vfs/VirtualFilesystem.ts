// Virtual Filesystem Singleton

import { match } from 'ts-pattern';
import { derived, writable, type Readable } from 'svelte/store';
import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
import { PatchFileOperations } from './PatchFileOperations';
import type { VfsCollisionStrategy } from './PatchImportPlanner';
import { clearFileData, clearHandles } from './persistence';
import { generateUserPath, getFilenameFromUrl, guessMimeType } from './path-utils';
import type { LocalFileState, LocalFilesystemProvider } from './providers/LocalFilesystemProvider';
import {
  type PatchImportItem,
  type VFSEntry,
  type VFSListEntry,
  type VFSListPage,
  type VFSProvider,
  type VFSSearchPage,
  type VFSTree,
  isEmbeddedVFSEntry,
  isVFSPath,
  VFS_PREFIXES
} from './types';
import { VfsDirectoryReader } from './VfsDirectoryReader';
import { VfsEntryIndex, type VfsRenameMove } from './VfsEntryIndex';
import { VfsMutationCoordinator, type VfsMutationSnapshot } from './VfsMutationCoordinator';
import { VfsPermissionTracker } from './VfsPermissionTracker';
import { VfsTreeCodec } from './VfsTreeCodec';

export {
  MAX_EMBEDDED_FILE_BYTES,
  MAX_EMBEDDED_PATCH_BYTES,
  PATCH_TEXT_FILE_ACCEPT,
  getPatchImportError
} from './PatchImportPlanner';

export type { VfsCollisionStrategy } from './PatchImportPlanner';

declare global {
  interface Window {
    vfs: VirtualFilesystem;
  }
}

/** Stable public façade for virtual file operations and provider coordination. */
export class VirtualFilesystem {
  private static instance: VirtualFilesystem | null = null;

  private entries = new VfsEntryIndex();
  private providers = new Map<string, VFSProvider>();
  private permissions = new VfsPermissionTracker();
  private versionStore = writable(0);
  private mutationCoordinator: VfsMutationCoordinator;
  private patchFiles: PatchFileOperations;
  private directoryReader: VfsDirectoryReader;
  private treeCodec = new VfsTreeCodec();
  private contentRevisionClock = new Map<string, number>();

  readonly entries$: Readable<Map<string, VFSEntry>> = derived(this.versionStore, () =>
    this.getAllEntries()
  );

  readonly pendingPermissions$: Readable<Set<string>> = derived(
    this.versionStore,
    () => new Set(this.permissions.getAll())
  );

  private constructor() {
    this.mutationCoordinator = new VfsMutationCoordinator({
      snapshot: () => this.createMutationSnapshot(),
      restore: (snapshot) => this.restoreEntries(snapshot),
      afterMutation: () => this.patchFiles.refreshValidation()
    });

    this.patchFiles = new PatchFileOperations({
      entries: this.entries,
      recordMutation: (description, mutate, callbacks) =>
        this.mutationCoordinator.record(description, mutate, callbacks),
      notifyChange: () => this.notifyChange(),
      emitContentModified: (path, revision) => this.emitContentModified(path, revision)
    });

    this.directoryReader = new VfsDirectoryReader(this.entries, () => this.getLocalProvider());
  }

  static getInstance(): VirtualFilesystem {
    if (!VirtualFilesystem.instance) {
      VirtualFilesystem.instance = new VirtualFilesystem();

      if (typeof window !== 'undefined') {
        window.vfs = VirtualFilesystem.instance;
      }
    }

    return VirtualFilesystem.instance;
  }

  static resetInstance(): void {
    VirtualFilesystem.instance = null;
  }

  registerProvider(provider: VFSProvider): void {
    this.providers.set(provider.type, provider);
  }

  getProvider(type: string): VFSProvider | undefined {
    return this.providers.get(type);
  }

  registerEntry(path: string, entry: VFSEntry): void {
    this.patchFiles.validateEntry(path, entry);
    this.entries.set(path, entry);
    this.notifyChange();
  }

  createEmbeddedFile(
    path: string,
    content = '',
    collision: VfsCollisionStrategy = 'cancel'
  ): string | null {
    return this.patchFiles.create(path, content, collision);
  }

  writeEmbeddedFile(path: string, content: string): void {
    this.patchFiles.write(path, content);
  }

  readEmbeddedFile(path: string): string {
    return this.patchFiles.read(path);
  }

  exportEmbeddedFile(path: string): File {
    return this.patchFiles.export(path);
  }

  /** @deprecated Use storeFile() instead for clarity. */
  async registerLocalFile(file: File): Promise<string> {
    return this.storeFile(file);
  }

  async storeFile(
    file: File,
    handle?: FileSystemFileHandle,
    targetFolder?: string
  ): Promise<string> {
    const path = generateUserPath(file.name, file.type, new Set(this.entries.keys()), targetFolder);

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

    const provider = this.providers.get('local');

    if (provider && 'storeFile' in provider) {
      const localProvider = provider as VFSProvider & {
        storeFile: (path: string, file: File, handle?: FileSystemFileHandle) => Promise<void>;
        storeFileWithHandle?: (
          path: string,
          file: File,
          handle: FileSystemFileHandle
        ) => Promise<void>;
      };

      if (handle && localProvider.storeFileWithHandle) {
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

  async replaceFile(path: string, file: File, handle?: FileSystemFileHandle): Promise<void> {
    const entry = this.entries.get(path);
    if (!entry) {
      throw new Error(`VFS: Cannot replace file at non-existent path: ${path}`);
    }

    const provider = this.getLocalProvider();
    const previousProviderState = await provider?.captureFileState(path);
    const replacementProviderState = { file, handle };
    const wasPendingPermission = this.permissions.has(path);

    const updatedEntry: VFSEntry = {
      ...entry,
      filename: file.name,
      mimeType: file.type || guessMimeType(file.name),
      size: file.size
    };

    const dispatchRelinked = () =>
      PatchiesEventBus.getInstance().dispatch({ type: 'fileRelinked', path });

    const restoreProviderState = (
      state: LocalFileState | undefined,
      pendingPermission: boolean
    ) => {
      if (pendingPermission) this.permissions.add(path);
      else this.permissions.delete(path);
      this.notifyChange();

      if (!provider || !state) {
        dispatchRelinked();
        return;
      }

      void provider
        .restoreFileState(path, state)
        .then(dispatchRelinked)
        .catch((error) => console.error('VFS: Failed to restore replaced file state', error));
    };

    if (provider) {
      try {
        await provider.restoreFileState(path, replacementProviderState);
      } catch (error) {
        if (previousProviderState) await provider.restoreFileState(path, previousProviderState);
        throw error;
      }
    }

    this.recordMutation(
      `Replace ${entry.filename}`,
      () => {
        this.entries.set(path, updatedEntry);
        this.permissions.delete(path);
        this.notifyChange();
        dispatchRelinked();
      },
      {
        redo: () => restoreProviderState(replacementProviderState, false),
        undo: () => restoreProviderState(previousProviderState, wasPendingPermission)
      }
    );
  }

  async registerUrl(url: string, targetFolder?: string): Promise<string> {
    const filename = getFilenameFromUrl(url);
    const mimeType = guessMimeType(filename);
    const path = generateUserPath(filename, mimeType, new Set(this.entries.keys()), targetFolder);

    if (targetFolder && !this.entries.has(targetFolder)) {
      this.entries.set(targetFolder, {
        provider: 'folder',
        filename: targetFolder.split('/').pop() ?? targetFolder
      });
    }

    this.recordMutation(`Add ${filename}`, () => {
      this.entries.set(path, { provider: 'url', url, filename, mimeType });
      this.notifyChange();
    });

    return path;
  }

  createFolder(parentPath: string, folderName: string): string {
    const normalizedParent =
      parentPath.endsWith('/') && !parentPath.endsWith('://')
        ? parentPath.slice(0, -1)
        : parentPath;

    const folderPath = normalizedParent.endsWith('://')
      ? `${normalizedParent}${folderName}`
      : `${normalizedParent}/${folderName}`;

    this.recordMutation(`Create ${folderName}`, () => {
      this.entries.set(folderPath, { provider: 'folder', filename: folderName });
      this.notifyChange();
    });

    return folderPath;
  }

  isFolder(path: string): boolean {
    const provider = this.entries.get(path)?.provider;

    return provider === 'folder' || provider === 'local-folder';
  }

  renamePath(oldPath: string, newPath: string): void {
    const plan = this.entries.planRename(oldPath, newPath);

    const persist = (direction: 'forward' | 'backward') =>
      this.queuePersistedRename(plan.moves, direction);

    const emit = (direction: 'forward' | 'backward') => this.emitPathRenames(plan.moves, direction);

    this.recordMutation(
      `Rename ${oldPath.split('/').pop()}`,
      () => {
        this.entries.applyRename(plan);
        persist('forward');
        this.notifyChange();
        emit('forward');
      },
      {
        redo: () => {
          persist('forward');
          emit('forward');
        },
        undo: () => {
          persist('backward');
          emit('backward');
        }
      }
    );
  }

  deletePath(path: string): void {
    this.deletePaths([path]);
  }

  deletePaths(requestedPaths: Iterable<string>): void {
    const plan = this.entries.planDelete(requestedPaths);
    if (plan.paths.length === 0) return;

    const deletedEmbeddedFiles = plan.paths.flatMap((path) => {
      const entry = this.entries.get(path);

      return entry && isEmbeddedVFSEntry(entry)
        ? [{ path, revision: (entry.revision ?? 0) + 1 }]
        : [];
    });

    const linkedFolderPaths = plan.paths.filter(
      (path) => this.entries.get(path)?.provider === 'local-folder'
    );

    const setLinkedFoldersDeleted = (deleted: boolean) => {
      const provider = this.getLocalProvider();
      if (!provider) return;

      this.mutationCoordinator.queueEffect('update deleted folder state', async () => {
        for (const path of linkedFolderPaths) {
          if (deleted) {
            await provider.hideDirHandle(path);
          } else {
            await provider.restoreDirHandle(path);
          }
        }
      });
    };

    this.recordMutation(
      plan.roots.length === 1
        ? `Delete ${plan.roots[0].split('/').pop()}`
        : `Delete ${plan.roots.length} paths`,
      () => {
        this.entries.removePaths(plan.paths);
        this.permissions.deleteAll(plan.paths);
        setLinkedFoldersDeleted(true);
        this.notifyChange();

        for (const file of deletedEmbeddedFiles) {
          this.emitContentModified(file.path, file.revision);
        }
      },
      {
        redo: () => setLinkedFoldersDeleted(true),
        undo: () => setLinkedFoldersDeleted(false)
      }
    );
  }

  async copyToPatch(
    sourcePath: string,
    targetFolder: string = VFS_PREFIXES.PATCH,
    collision: VfsCollisionStrategy = 'cancel'
  ): Promise<string | null> {
    const items = await this.preparePatchCopy(sourcePath);
    const imported = await this.importToPatch(items, targetFolder, collision);

    return imported[0] ?? null;
  }

  async preparePatchCopy(sourcePath: string): Promise<PatchImportItem[]> {
    return this.patchFiles.prepareCopy(sourcePath, {
      getEntry: (path) => this.getEntryOrLinkedFile(path),
      listChildren: (path) => this.listChildren(path),
      resolve: (path) => this.resolve(path)
    });
  }

  getPatchImportCollisions(
    files: Iterable<File | PatchImportItem>,
    targetFolder: string = VFS_PREFIXES.PATCH
  ): string[] {
    return this.patchFiles.getImportCollisions(files, targetFolder);
  }

  async importToPatch(
    files: Iterable<File | PatchImportItem>,
    targetFolder: string = VFS_PREFIXES.PATCH,
    collision: VfsCollisionStrategy = 'keep-both'
  ): Promise<string[]> {
    return this.patchFiles.import(files, targetFolder, collision);
  }

  async linkLocalFolder(handle: FileSystemDirectoryHandle): Promise<string> {
    const folderName = handle.name;
    let path = `user://${folderName}`;
    let counter = 1;

    while (this.entries.has(path)) {
      path = `user://${folderName}-${counter}`;
      counter += 1;
    }

    this.entries.set(path, { provider: 'local-folder', filename: folderName });
    await this.getLocalProvider()?.storeDirHandle(path, handle);
    this.notifyChange();

    return path;
  }

  async relinkLocalFolder(path: string, handle: FileSystemDirectoryHandle): Promise<void> {
    const entry = this.entries.get(path);
    if (entry?.provider !== 'local-folder') {
      throw new Error(`VFS: Cannot relink - path is not a linked folder: ${path}`);
    }

    entry.filename = handle.name;
    await this.getLocalProvider()?.storeDirHandle(path, handle);
    this.permissions.delete(path);
    this.notifyChange();
  }

  async resolve(path: string): Promise<File | Blob> {
    const entry = this.entries.get(path);
    if (entry) {
      if (isEmbeddedVFSEntry(entry)) this.patchFiles.assertReadable(path);

      const provider = this.providers.get(entry.provider);

      if (!provider) {
        throw new Error(`VFS: No provider registered for type: ${entry.provider}`);
      }

      return provider.resolve(entry, path);
    }

    const linkedFile = await this.directoryReader.resolveLinkedFile(path);
    if (linkedFile) return linkedFile;

    throw new Error(`VFS: Path not found: ${path}`);
  }

  isPathInLinkedFolder(path: string): boolean {
    const linkedFolder = this.directoryReader.findLinkedFolder(path);

    return linkedFolder !== null && linkedFolder !== path;
  }

  getEntryOrLinkedFile(path: string): VFSEntry | undefined {
    return this.directoryReader.getEntry(path);
  }

  getEntry(path: string): VFSEntry | undefined {
    return this.entries.get(path);
  }

  has(path: string): boolean {
    return this.entries.has(path);
  }

  isVFSPath(path: string): boolean {
    return isVFSPath(path);
  }

  list(prefix?: string): string[] {
    return this.entries.paths(prefix);
  }

  async listChildren(directory: string): Promise<VFSListEntry[]> {
    return this.directoryReader.listChildren(directory);
  }

  async listChildrenPage(
    directory: string,
    options: { offset?: number; limit?: number } = {}
  ): Promise<VFSListPage> {
    return this.directoryReader.listChildrenPage(directory, options);
  }

  async search(query: string, directory: string): Promise<VFSListEntry[]> {
    return this.directoryReader.search(query, directory);
  }

  async searchPage(
    query: string,
    directory: string,
    options: { offset?: number; limit?: number } = {}
  ): Promise<VFSSearchPage> {
    return this.directoryReader.searchPage(query, directory, options);
  }

  getAllEntries(): Map<string, VFSEntry> {
    return this.entries.toMap();
  }

  serialize(): VFSTree {
    return this.treeCodec.serialize(this.entries);
  }

  async hydrate(tree: VFSTree): Promise<void> {
    const hydrated = this.treeCodec.deserialize(tree, (path, entry) =>
      this.patchFiles.validateEntry(path, entry, false)
    );

    this.entries.replace(hydrated);
    this.patchFiles.refreshValidation();

    await this.permissions.scan(this.entries, this.providers.get('local'), this.getLocalProvider());

    this.notifyChange();
  }

  getPendingPermissions(): string[] {
    return this.permissions.getAll();
  }

  async requestPermission(path: string): Promise<boolean> {
    return this.permissions.request(path, this.entries.get(path), this.providers.get('local'));
  }

  async requestAllPermissions(): Promise<Map<string, boolean>> {
    return this.permissions.requestAll(
      (path) => this.entries.get(path),
      this.providers.get('local')
    );
  }

  markPermissionGranted(path: string): void {
    this.permissions.delete(path);
  }

  remove(path: string): void {
    const entry = this.entries.get(path);
    const deletionRevision =
      entry && isEmbeddedVFSEntry(entry) ? (entry.revision ?? 0) + 1 : undefined;

    this.entries.delete(path);
    this.permissions.delete(path);

    if (entry?.provider === 'local-folder') {
      this.getLocalProvider()?.removeDirHandle(path);
    }

    this.notifyChange();

    if (deletionRevision !== undefined) this.emitContentModified(path, deletionRevision);
  }

  clear(): void {
    const deletedEmbeddedFiles = [...this.entries].flatMap(([path, entry]) =>
      isEmbeddedVFSEntry(entry) ? [{ path, revision: (entry.revision ?? 0) + 1 }] : []
    );

    this.entries.clear();
    this.permissions.clear();
    this.patchFiles.refreshValidation();

    const provider = this.getLocalProvider();
    provider?.clear();
    provider?.clearDirHandles();

    this.notifyChange();

    for (const file of deletedEmbeddedFiles) {
      this.emitContentModified(file.path, file.revision);
    }

    this.contentRevisionClock.clear();
  }

  clearPersistedData(): void {
    clearHandles();
    clearFileData();
  }

  async loadDirHandlesFromStorage(): Promise<void> {
    const provider = this.getLocalProvider();
    if (!provider) return;

    await this.permissions.loadStoredDirectories(this.entries, provider);
    this.notifyChange();
  }

  private notifyChange(): void {
    this.versionStore.update((version) => version + 1);
  }

  private createMutationSnapshot(): VfsMutationSnapshot {
    return {
      entries: this.entries.snapshot(),
      pendingPermissions: this.permissions.snapshot()
    };
  }

  private restoreEntries({ entries, pendingPermissions }: VfsMutationSnapshot): void {
    const previous = this.entries.snapshot();
    this.entries.replace(entries);
    this.permissions.restore(pendingPermissions, this.entries);
    this.patchFiles.refreshValidation();
    this.notifyChange();

    for (const [path, entry] of this.entries) {
      const prior = previous.get(path);

      const hasVfsModified =
        isEmbeddedVFSEntry(entry) &&
        (!prior ||
          !isEmbeddedVFSEntry(prior) ||
          prior.content !== entry.content ||
          prior.revision !== entry.revision);

      if (hasVfsModified) {
        this.emitContentModified(path, entry.revision ?? 1);
      }
    }

    for (const [path, entry] of previous) {
      if (isEmbeddedVFSEntry(entry) && !this.entries.has(path)) {
        this.emitContentModified(path, (entry.revision ?? 0) + 1);
      }
    }
  }

  private recordMutation(
    description: string,
    mutate: () => void,
    callbacks?: { redo?: () => void; undo?: () => void }
  ): void {
    this.mutationCoordinator.record(description, mutate, callbacks);
  }

  private getLocalProvider(): LocalFilesystemProvider | undefined {
    const provider = this.providers.get('local');

    if (provider && 'storeDirHandle' in provider) {
      return provider as LocalFilesystemProvider;
    }

    return undefined;
  }

  private queuePersistedRename(moves: VfsRenameMove[], direction: 'forward' | 'backward'): void {
    const provider = this.getLocalProvider();
    if (!provider) return;

    this.mutationCoordinator.queueEffect('persist renamed paths', async () => {
      for (const move of moves) {
        const from = direction === 'forward' ? move.oldPath : move.newPath;
        const to = direction === 'forward' ? move.newPath : move.oldPath;

        await match(move.entry.provider)
          .with('local', async () => {
            await provider.rename(from, to);
          })
          .with('local-folder', async () => {
            await provider.renameDirHandle(from, to);
          })
          .otherwise(() => {});
      }
    });
  }

  private emitPathRenames(moves: VfsRenameMove[], direction: 'forward' | 'backward'): void {
    for (const move of moves) {
      PatchiesEventBus.getInstance().dispatch({
        type: 'vfsPathRenamed',
        oldPath: direction === 'forward' ? move.oldPath : move.newPath,
        newPath: direction === 'forward' ? move.newPath : move.oldPath
      });
    }
  }

  private emitContentModified(path: string, revision: number): void {
    const monotonicRevision = Math.max(revision, (this.contentRevisionClock.get(path) ?? 0) + 1);
    this.contentRevisionClock.set(path, monotonicRevision);

    PatchiesEventBus.getInstance().dispatch({
      type: 'vfsContentModified',
      path,
      revision: monotonicRevision
    });
  }
}
