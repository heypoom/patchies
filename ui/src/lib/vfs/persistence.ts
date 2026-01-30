// IndexedDB persistence for FileSystemHandles

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
const DB_VERSION = 3; // Bumped for directory handles store
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

/**
 * Open the IndexedDB database.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onblocked = () => {
      console.warn('VFS: IndexedDB upgrade blocked. Close other tabs using this app and refresh.');
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(HANDLES_STORE)) {
        db.createObjectStore(HANDLES_STORE);
      }

      if (!db.objectStoreNames.contains(FILES_STORE)) {
        db.createObjectStore(FILES_STORE);
      }

      if (!db.objectStoreNames.contains(DIR_HANDLES_STORE)) {
        db.createObjectStore(DIR_HANDLES_STORE);
      }
    };
  });
}

/**
 * Store a FileSystemFileHandle for a VFS path.
 */
export async function storeHandle(path: string, handle: FileSystemFileHandle): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLES_STORE, 'readwrite');
    const store = tx.objectStore(HANDLES_STORE);
    const request = store.put(handle, path);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    tx.oncomplete = () => db.close();
  });
}

/**
 * Get a FileSystemFileHandle for a VFS path.
 */
export async function getHandle(path: string): Promise<FileSystemFileHandle | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLES_STORE, 'readonly');
    const store = tx.objectStore(HANDLES_STORE);
    const request = store.get(path);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as FileSystemFileHandle | undefined);

    tx.oncomplete = () => db.close();
  });
}

/**
 * Remove a FileSystemFileHandle for a VFS path.
 */
export async function removeHandle(path: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLES_STORE, 'readwrite');
    const store = tx.objectStore(HANDLES_STORE);
    const request = store.delete(path);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    tx.oncomplete = () => db.close();
  });
}

/**
 * Get all stored handles.
 */
export async function getAllHandles(): Promise<Map<string, FileSystemFileHandle>> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLES_STORE, 'readonly');
    const store = tx.objectStore(HANDLES_STORE);
    const handles = new Map<string, FileSystemFileHandle>();

    const cursorRequest = store.openCursor();

    cursorRequest.onerror = () => reject(cursorRequest.error);
    cursorRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        handles.set(cursor.key as string, cursor.value as FileSystemFileHandle);
        cursor.continue();
      } else {
        resolve(handles);
      }
    };

    tx.oncomplete = () => db.close();
  });
}

/**
 * Clear all stored handles.
 */
export async function clearHandles(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLES_STORE, 'readwrite');
    const store = tx.objectStore(HANDLES_STORE);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    tx.oncomplete = () => db.close();
  });
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
  const db = await openDB();
  const arrayBuffer = await file.arrayBuffer();

  const cachedData: CachedFileData = {
    data: arrayBuffer,
    name: file.name,
    type: file.type,
    lastModified: file.lastModified
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILES_STORE, 'readwrite');
    const store = tx.objectStore(FILES_STORE);
    const request = store.put(cachedData, path);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    tx.oncomplete = () => db.close();
  });
}

/**
 * Get file data from IndexedDB.
 */
export async function getFileData(path: string): Promise<File | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILES_STORE, 'readonly');
    const store = tx.objectStore(FILES_STORE);
    const request = store.get(path);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cached = request.result as CachedFileData | undefined;
      if (cached) {
        const file = new File([cached.data], cached.name, {
          type: cached.type,
          lastModified: cached.lastModified
        });
        resolve(file);
      } else {
        resolve(undefined);
      }
    };

    tx.oncomplete = () => db.close();
  });
}

/**
 * Remove file data from IndexedDB.
 */
export async function removeFileData(path: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILES_STORE, 'readwrite');
    const store = tx.objectStore(FILES_STORE);
    const request = store.delete(path);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    tx.oncomplete = () => db.close();
  });
}

/**
 * Clear all stored file data.
 */
export async function clearFileData(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILES_STORE, 'readwrite');
    const store = tx.objectStore(FILES_STORE);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    tx.oncomplete = () => db.close();
  });
}

/**
 * Check if file data exists for a path.
 */
export async function hasFileData(path: string): Promise<boolean> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILES_STORE, 'readonly');
    const store = tx.objectStore(FILES_STORE);
    const request = store.count(path);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result > 0);

    tx.oncomplete = () => db.close();
  });
}

// ─────────────────────────────────────────────────────────────────
// Directory Handle Storage (for linked local folders)
// ─────────────────────────────────────────────────────────────────

/**
 * Check if the dir-handles store exists in the database.
 * This can be false if the DB upgrade was blocked by another tab.
 */
function hasDirHandlesStore(db: IDBDatabase): boolean {
  return db.objectStoreNames.contains(DIR_HANDLES_STORE);
}

/**
 * Store a FileSystemDirectoryHandle for a VFS path.
 */
export async function storeDirHandle(
  path: string,
  handle: FileSystemDirectoryHandle
): Promise<void> {
  const db = await openDB();

  // Check if store exists (upgrade may have been blocked)
  if (!hasDirHandlesStore(db)) {
    db.close();
    console.warn(
      'VFS: dir-handles store not available. Close other tabs and refresh to complete database upgrade.'
    );
    return;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(DIR_HANDLES_STORE, 'readwrite');
    const store = tx.objectStore(DIR_HANDLES_STORE);
    const request = store.put(handle, path);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    tx.oncomplete = () => db.close();
  });
}

/**
 * Get a FileSystemDirectoryHandle for a VFS path.
 */
export async function getDirHandle(path: string): Promise<FileSystemDirectoryHandle | undefined> {
  const db = await openDB();

  if (!hasDirHandlesStore(db)) {
    db.close();
    return undefined;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(DIR_HANDLES_STORE, 'readonly');
    const store = tx.objectStore(DIR_HANDLES_STORE);
    const request = store.get(path);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as FileSystemDirectoryHandle | undefined);

    tx.oncomplete = () => db.close();
  });
}

/**
 * Remove a FileSystemDirectoryHandle for a VFS path.
 */
export async function removeDirHandle(path: string): Promise<void> {
  const db = await openDB();

  if (!hasDirHandlesStore(db)) {
    db.close();
    return;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(DIR_HANDLES_STORE, 'readwrite');
    const store = tx.objectStore(DIR_HANDLES_STORE);
    const request = store.delete(path);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    tx.oncomplete = () => db.close();
  });
}

/**
 * Get all stored directory handles.
 */
export async function getAllDirHandles(): Promise<Map<string, FileSystemDirectoryHandle>> {
  const db = await openDB();

  if (!hasDirHandlesStore(db)) {
    db.close();
    return new Map();
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(DIR_HANDLES_STORE, 'readonly');
    const store = tx.objectStore(DIR_HANDLES_STORE);
    const handles = new Map<string, FileSystemDirectoryHandle>();

    const cursorRequest = store.openCursor();

    cursorRequest.onerror = () => reject(cursorRequest.error);
    cursorRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        handles.set(cursor.key as string, cursor.value as FileSystemDirectoryHandle);
        cursor.continue();
      } else {
        resolve(handles);
      }
    };

    tx.oncomplete = () => db.close();
  });
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
