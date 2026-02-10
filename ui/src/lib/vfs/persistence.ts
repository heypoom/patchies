// IndexedDB persistence for FileSystemHandles

import { openDB, type IDBPDatabase } from 'idb';

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
const DB_VERSION = 3;
const HANDLES_STORE = 'handles';
const FILES_STORE = 'files'; // Fallback store for file data (Firefox, Safari)
const DIR_HANDLES_STORE = 'dir-handles'; // Store for FileSystemDirectoryHandle

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
}

/** Cached database connection */
let dbInstance: IDBPDatabase<VfsDB> | null = null;

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

  await db.put(HANDLES_STORE, handle, path);
}

/**
 * Get a FileSystemFileHandle for a VFS path.
 */
export async function getHandle(path: string): Promise<FileSystemFileHandle | undefined> {
  const db = await getDb();

  return db.get(HANDLES_STORE, path);
}

/**
 * Remove a FileSystemFileHandle for a VFS path.
 */
export async function removeHandle(path: string): Promise<void> {
  const db = await getDb();

  await db.delete(HANDLES_STORE, path);
}

/**
 * Get all stored handles.
 */
export async function getAllHandles(): Promise<Map<string, FileSystemFileHandle>> {
  const db = await getDb();
  const keys = await db.getAllKeys(HANDLES_STORE);
  const values = await db.getAll(HANDLES_STORE);

  const handles = new Map<string, FileSystemFileHandle>();

  for (let i = 0; i < keys.length; i++) {
    handles.set(keys[i] as string, values[i]);
  }

  return handles;
}

/**
 * Clear all stored handles.
 */
export async function clearHandles(): Promise<void> {
  const db = await getDb();

  await db.clear(HANDLES_STORE);
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

  await db.put(FILES_STORE, cachedData, path);
}

/**
 * Get file data from IndexedDB.
 */
export async function getFileData(path: string): Promise<File | undefined> {
  const db = await getDb();
  const cached = await db.get(FILES_STORE, path);

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

  await db.delete(FILES_STORE, path);
}

/**
 * Clear all stored file data.
 */
export async function clearFileData(): Promise<void> {
  const db = await getDb();

  await db.clear(FILES_STORE);
}

/**
 * Check if file data exists for a path.
 */
export async function hasFileData(path: string): Promise<boolean> {
  const db = await getDb();
  const count = await db.count(FILES_STORE, path);

  return count > 0;
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

  await db.put(DIR_HANDLES_STORE, handle, path);
}

/**
 * Get a FileSystemDirectoryHandle for a VFS path.
 */
export async function getDirHandle(path: string): Promise<FileSystemDirectoryHandle | undefined> {
  const db = await getDb();

  return db.get(DIR_HANDLES_STORE, path);
}

/**
 * Remove a FileSystemDirectoryHandle for a VFS path.
 */
export async function removeDirHandle(path: string): Promise<void> {
  const db = await getDb();

  await db.delete(DIR_HANDLES_STORE, path);
}

/**
 * Get all stored directory handles.
 */
export async function getAllDirHandles(): Promise<Map<string, FileSystemDirectoryHandle>> {
  const db = await getDb();
  const keys = await db.getAllKeys(DIR_HANDLES_STORE);
  const values = await db.getAll(DIR_HANDLES_STORE);

  const handles = new Map<string, FileSystemDirectoryHandle>();

  for (let i = 0; i < keys.length; i++) {
    handles.set(keys[i] as string, values[i]);
  }

  return handles;
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
