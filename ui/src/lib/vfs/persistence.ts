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
const DB_VERSION = 2; // Bumped for new store
const HANDLES_STORE = 'handles';
const FILES_STORE = 'files'; // Fallback store for file data (Firefox, Safari)

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

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;

			if (!db.objectStoreNames.contains(HANDLES_STORE)) {
				db.createObjectStore(HANDLES_STORE);
			}

			if (!db.objectStoreNames.contains(FILES_STORE)) {
				db.createObjectStore(FILES_STORE);
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
