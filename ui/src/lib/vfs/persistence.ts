// IndexedDB persistence for FileSystemHandles

import { openDB, type IDBPDatabase } from 'idb';
import { get } from 'svelte/store';
import { currentPatchId } from '../../stores/ui.store';

// Extend FileSystemFileHandle with permission methods (File System Access API)
// These are available in Chrome/Edge but not in TypeScript's lib.dom.d.ts
interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface FileSystemFileHandleWithPermissions extends FileSystemFileHandle {
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

const DB_NAME = 'patchies-vfs';
const DB_VERSION = 4;
const HANDLES_STORE = 'handles';
const FILES_STORE = 'files'; // Fallback store for file data (Firefox, Safari)
const DIR_HANDLES_STORE = 'dir-handles'; // Store for FileSystemDirectoryHandle
const DELETED_DIR_HANDLES_STORE = 'deleted-dir-handles';

/**
 * Cached file data for browsers without FileSystemFileHandle support.
 */
export interface CachedFileData {
  data: ArrayBuffer;
  name: string;
  type: string;
  lastModified: number;
}

interface VfsDB {
  [HANDLES_STORE]: {
    key: string;
    value: FileSystemFileHandle;
  };
  [FILES_STORE]: {
    key: string;
    value: CachedFileData;
  };
  [DIR_HANDLES_STORE]: {
    key: string;
    value: FileSystemDirectoryHandle;
  };
  [DELETED_DIR_HANDLES_STORE]: {
    key: string;
    value: true;
  };
}

/** Cached database connection */
let dbInstance: IDBPDatabase<VfsDB> | null = null;

const scopedKey = (path: string): string => `${get(currentPatchId)}:${path}`;

async function getWithLegacyFallback<T>(store: keyof VfsDB, path: string): Promise<T | undefined> {
  const db = await getDb();
  const key = scopedKey(path);
  const scoped = await db.get(store, key);
  if (scoped !== undefined) return scoped as T;

  const legacy = await db.get(store, path);
  if (legacy !== undefined) {
    await db.put(store, legacy, key);
  }

  return legacy as T | undefined;
}

async function clearScoped(store: keyof VfsDB): Promise<void> {
  const db = await getDb();
  const prefix = `${get(currentPatchId)}:`;
  const keys = await db.getAllKeys(store);

  await Promise.all(
    keys
      .filter((key) => typeof key === 'string' && key.startsWith(prefix))
      .map((key) => db.delete(store, key))
  );
}

/**
 * Get or create the database connection.
 */
async function getDb(): Promise<IDBPDatabase<VfsDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<VfsDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(HANDLES_STORE)) {
        db.createObjectStore(HANDLES_STORE);
      }

      if (!db.objectStoreNames.contains(FILES_STORE)) {
        db.createObjectStore(FILES_STORE);
      }

      if (!db.objectStoreNames.contains(DIR_HANDLES_STORE)) {
        db.createObjectStore(DIR_HANDLES_STORE);
      }

      if (!db.objectStoreNames.contains(DELETED_DIR_HANDLES_STORE)) {
        db.createObjectStore(DELETED_DIR_HANDLES_STORE);
      }
    },
    blocked() {
      console.warn('VFS: IndexedDB upgrade blocked. Close other tabs using this app and refresh.');
    }
  });

  return dbInstance;
}

// ─────────────────────────────────────────────────────────────────
// File Handle Storage
// ─────────────────────────────────────────────────────────────────

/**
 * Store a FileSystemFileHandle for a VFS path.
 */
export async function storeHandle(path: string, handle: FileSystemFileHandle): Promise<void> {
  const db = await getDb();

  await db.put(HANDLES_STORE, handle, scopedKey(path));
}

/**
 * Get a FileSystemFileHandle for a VFS path.
 */
export async function getHandle(path: string): Promise<FileSystemFileHandle | undefined> {
  const db = await getDb();

  return getWithLegacyFallback<FileSystemFileHandle>(HANDLES_STORE, path);
}

/**
 * Remove a FileSystemFileHandle for a VFS path.
 */
export async function removeHandle(path: string): Promise<void> {
  const db = await getDb();

  await db.delete(HANDLES_STORE, scopedKey(path));
}

/**
 * Get all stored handles.
 */
export async function getAllHandles(): Promise<Map<string, FileSystemFileHandle>> {
  const db = await getDb();
  const prefix = `${get(currentPatchId)}:`;
  const keys = (await db.getAllKeys(HANDLES_STORE)).filter(
    (key): key is string => typeof key === 'string' && key.startsWith(prefix)
  );

  const handles = new Map<string, FileSystemFileHandle>();

  for (const key of keys) {
    const value = await db.get(HANDLES_STORE, key);
    if (value) handles.set(key.slice(prefix.length), value);
  }

  return handles;
}

/**
 * Clear all stored handles.
 */
export async function clearHandles(): Promise<void> {
  const db = await getDb();

  await clearScoped(HANDLES_STORE);
}

/**
 * Check if a handle has read permission.
 */
export async function hasPermission(handle: FileSystemFileHandle): Promise<boolean> {
  try {
    const handleWithPerms = handle as FileSystemFileHandleWithPermissions;
    const permission = await handleWithPerms.queryPermission({ mode: 'read' });

    return permission === 'granted';
  } catch {
    return false;
  }
}

/**
 * Request read permission for a handle.
 * Returns true if permission was granted.
 */
export async function requestHandlePermission(handle: FileSystemFileHandle): Promise<boolean> {
  try {
    const handleWithPerms = handle as FileSystemFileHandleWithPermissions;
    const permission = await handleWithPerms.requestPermission({ mode: 'read' });

    return permission === 'granted';
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────
// File Data Storage (fallback for browsers without handle support)
// ─────────────────────────────────────────────────────────────────

/**
 * Store file data in IndexedDB (for browsers without FileSystemFileHandle support).
 */
export async function storeFileData(path: string, file: File): Promise<void> {
  const db = await getDb();
  const arrayBuffer = await file.arrayBuffer();

  const cachedData: CachedFileData = {
    data: arrayBuffer,
    name: file.name,
    type: file.type,
    lastModified: file.lastModified
  };

  await db.put(FILES_STORE, cachedData, scopedKey(path));
}

/**
 * Get file data from IndexedDB.
 */
export async function getFileData(path: string): Promise<File | undefined> {
  const cached = await getWithLegacyFallback<CachedFileData>(FILES_STORE, path);

  if (cached) {
    return new File([cached.data], cached.name, {
      type: cached.type,
      lastModified: cached.lastModified
    });
  }
  return undefined;
}

/**
 * Remove file data from IndexedDB.
 */
export async function removeFileData(path: string): Promise<void> {
  const db = await getDb();

  await db.delete(FILES_STORE, scopedKey(path));
}

/**
 * Clear all stored file data.
 */
export async function clearFileData(): Promise<void> {
  await clearScoped(FILES_STORE);
}

/**
 * Check if file data exists for a path.
 */
export async function hasFileData(path: string): Promise<boolean> {
  return (await getFileData(path)) !== undefined;
}

// ─────────────────────────────────────────────────────────────────
// Directory Handle Storage (for linked local folders)
// ─────────────────────────────────────────────────────────────────

/**
 * Store a FileSystemDirectoryHandle for a VFS path.
 */
export async function storeDirHandle(
  path: string,
  handle: FileSystemDirectoryHandle
): Promise<void> {
  const db = await getDb();

  await db.put(DIR_HANDLES_STORE, handle, scopedKey(path));
}

/**
 * Get a FileSystemDirectoryHandle for a VFS path.
 */
export async function getDirHandle(path: string): Promise<FileSystemDirectoryHandle | undefined> {
  const db = await getDb();

  return getWithLegacyFallback<FileSystemDirectoryHandle>(DIR_HANDLES_STORE, path);
}

/**
 * Remove a FileSystemDirectoryHandle for a VFS path.
 */
export async function removeDirHandle(path: string): Promise<void> {
  const db = await getDb();

  await db.delete(DIR_HANDLES_STORE, scopedKey(path));
}

/**
 * Get all stored directory handles.
 */
export async function getAllDirHandles(): Promise<Map<string, FileSystemDirectoryHandle>> {
  const db = await getDb();
  const prefix = `${get(currentPatchId)}:`;
  const keys = (await db.getAllKeys(DIR_HANDLES_STORE)).filter(
    (key): key is string => typeof key === 'string' && key.startsWith(prefix)
  );

  const handles = new Map<string, FileSystemDirectoryHandle>();

  for (const key of keys) {
    if (await db.get(DELETED_DIR_HANDLES_STORE, key)) continue;

    const value = await db.get(DIR_HANDLES_STORE, key);
    if (value) handles.set(key.slice(prefix.length), value);
  }

  return handles;
}

/** Hide a persisted directory handle while its delete action remains undoable. */
export async function markDirHandleDeleted(path: string): Promise<void> {
  const db = await getDb();

  await db.put(DELETED_DIR_HANDLES_STORE, true, scopedKey(path));
}

/** Restore a directory handle hidden by an undoable delete. */
export async function restoreDeletedDirHandle(path: string): Promise<void> {
  const db = await getDb();

  await db.delete(DELETED_DIR_HANDLES_STORE, scopedKey(path));
}

/**
 * Check if a directory handle has read permission.
 */
export async function hasDirPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    const handleWithPerms = handle as FileSystemDirectoryHandle & {
      queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    };

    const permission = await handleWithPerms.queryPermission({ mode: 'read' });

    return permission === 'granted';
  } catch {
    return false;
  }
}

/**
 * Request read permission for a directory handle.
 */
export async function requestDirHandlePermission(
  handle: FileSystemDirectoryHandle
): Promise<boolean> {
  try {
    const handleWithPerms = handle as FileSystemDirectoryHandle & {
      requestPermission(
        descriptor?: FileSystemHandlePermissionDescriptor
      ): Promise<PermissionState>;
    };

    const permission = await handleWithPerms.requestPermission({ mode: 'read' });

    return permission === 'granted';
  } catch {
    return false;
  }
}
