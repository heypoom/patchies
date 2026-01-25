// Local Filesystem Provider - uses File System Access API with IndexedDB fallback

import type { VFSEntry, VFSProvider } from '../types';
import {
	storeHandle,
	getHandle,
	removeHandle,
	hasPermission,
	requestHandlePermission,
	storeFileData,
	getFileData,
	removeFileData,
	hasFileData,
	storeDirHandle,
	getDirHandle,
	removeDirHandle,
	getAllDirHandles,
	hasDirPermission,
	requestDirHandlePermission
} from '../persistence';

/**
 * Provider that uses the File System Access API for persistent file access.
 *
 * Persistence strategy:
 * 1. If FileSystemFileHandle is available (Chrome/Edge with showOpenFilePicker or drag-drop):
 *    - Store handle in IndexedDB, request permission on reload
 * 2. Fallback (Firefox, Safari, or drag-drop without handle):
 *    - Store actual file bytes in IndexedDB (works everywhere)
 */
export class LocalFilesystemProvider implements VFSProvider {
	readonly type = 'local' as const;

	/** In-memory cache of file handles for the current session */
	private handleCache: Map<string, FileSystemFileHandle> = new Map();

	/** In-memory cache of file data for the current session */
	private fileCache: Map<string, File> = new Map();

	/** In-memory cache of directory handles for the current session */
	private dirHandleCache: Map<string, FileSystemDirectoryHandle> = new Map();

	async resolve(entry: VFSEntry, path: string): Promise<File | Blob> {
		// 1. Check in-memory file cache first
		const cachedFile = this.fileCache.get(path);
		if (cachedFile) {
			return cachedFile;
		}

		// 2. Try to get from IndexedDB file data store (Firefox/Safari fallback)
		const storedFile = await getFileData(path);
		if (storedFile) {
			this.fileCache.set(path, storedFile);
			return storedFile;
		}

		// 3. Try to get handle from cache or IndexedDB (Chrome/Edge)
		let handle = this.handleCache.get(path);
		if (!handle) {
			handle = await getHandle(path);
			if (handle) {
				this.handleCache.set(path, handle);
			}
		}

		if (!handle) {
			throw new Error(`LocalFilesystemProvider: No handle or cached data found for ${path}`);
		}

		// Check permission
		const granted = await hasPermission(handle);
		if (!granted) {
			throw new Error(
				`LocalFilesystemProvider: Permission denied for ${path}. Call requestPermission() first.`
			);
		}

		// Get the file from handle
		const file = await handle.getFile();
		const result = new File([file], entry.filename || file.name, {
			type: entry.mimeType || file.type,
			lastModified: file.lastModified
		});

		// Cache it
		this.fileCache.set(path, result);
		return result;
	}

	/**
	 * Store a file in the VFS.
	 * Uses handle if available, otherwise falls back to storing file bytes.
	 */
	async storeFile(path: string, file: File, handle?: FileSystemFileHandle): Promise<void> {
		// Always cache in memory
		this.fileCache.set(path, file);

		if (handle) {
			// Chrome/Edge path: store handle for permission-based access
			this.handleCache.set(path, handle);
			await storeHandle(path, handle);
		} else {
			// Fallback path: store actual file bytes in IndexedDB
			// This works in Firefox, Safari, and when handles aren't available
			await storeFileData(path, file);
		}
	}

	/**
	 * Store a file with its handle (e.g., from showOpenFilePicker).
	 * Also stores file bytes as backup.
	 */
	async storeFileWithHandle(path: string, file: File, handle: FileSystemFileHandle): Promise<void> {
		this.handleCache.set(path, handle);
		this.fileCache.set(path, file);

		// Store both handle and file data for maximum compatibility
		await Promise.all([storeHandle(path, handle), storeFileData(path, file)]);
	}

	/**
	 * Check if a path needs permission to be granted.
	 */
	async needsPermission(path: string): Promise<boolean> {
		// If we have it in file cache, no permission needed
		if (this.fileCache.has(path)) {
			return false;
		}

		// Check if we have file data in IndexedDB (no permission needed)
		if (await hasFileData(path)) {
			return false;
		}

		// Check handle permission
		let handle = this.handleCache.get(path);
		if (!handle) {
			handle = await getHandle(path);
		}

		if (!handle) {
			// No handle and no file data - file is lost
			return true;
		}

		return !(await hasPermission(handle));
	}

	/**
	 * Request permission for a path.
	 */
	async requestPermission(path: string): Promise<boolean> {
		let handle = this.handleCache.get(path);
		if (!handle) {
			handle = await getHandle(path);
			if (handle) {
				this.handleCache.set(path, handle);
			}
		}

		if (!handle) {
			return false;
		}

		return requestHandlePermission(handle);
	}

	/**
	 * Remove a file from the provider.
	 */
	async remove(path: string): Promise<void> {
		this.handleCache.delete(path);
		this.fileCache.delete(path);
		await Promise.all([removeHandle(path), removeFileData(path)]);
	}

	/**
	 * Clear all cached data.
	 */
	clear(): void {
		this.handleCache.clear();
		this.fileCache.clear();
	}

	/**
	 * Check if we have a file or handle for a path.
	 */
	has(path: string): boolean {
		return this.fileCache.has(path) || this.handleCache.has(path);
	}

	/**
	 * Load all handles from IndexedDB into cache.
	 * Call this during hydration.
	 */
	async loadHandlesFromStorage(): Promise<void> {
		const { getAllHandles } = await import('../persistence');
		const handles = await getAllHandles();
		for (const [path, handle] of handles) {
			this.handleCache.set(path, handle);
		}
	}

	// ─────────────────────────────────────────────────────────────────
	// Directory Handle Methods (for local-folder provider type)
	// ─────────────────────────────────────────────────────────────────

	/**
	 * Store a directory handle for a VFS path.
	 */
	async storeDirHandle(path: string, handle: FileSystemDirectoryHandle): Promise<void> {
		this.dirHandleCache.set(path, handle);
		await storeDirHandle(path, handle);
	}

	/**
	 * Get a directory handle for a VFS path.
	 */
	async getDirHandle(path: string): Promise<FileSystemDirectoryHandle | undefined> {
		// Check cache first
		let handle = this.dirHandleCache.get(path);
		if (handle) return handle;

		// Try to load from IndexedDB
		handle = await getDirHandle(path);
		if (handle) {
			this.dirHandleCache.set(path, handle);
		}
		return handle;
	}

	/**
	 * Remove a directory handle.
	 */
	async removeDirHandle(path: string): Promise<void> {
		this.dirHandleCache.delete(path);
		await removeDirHandle(path);
	}

	/**
	 * Check if a directory handle has permission.
	 */
	async hasDirPermission(path: string): Promise<boolean> {
		const handle = await this.getDirHandle(path);
		if (!handle) return false;
		return hasDirPermission(handle);
	}

	/**
	 * Request permission for a directory handle.
	 */
	async requestDirPermission(path: string): Promise<boolean> {
		const handle = await this.getDirHandle(path);
		if (!handle) return false;
		return requestDirHandlePermission(handle);
	}

	/**
	 * List contents of a local folder.
	 */
	async listDirContents(
		path: string
	): Promise<Array<{ name: string; kind: 'file' | 'directory'; handle: FileSystemHandle }>> {
		const handle = await this.getDirHandle(path);
		if (!handle) {
			throw new Error(`LocalFilesystemProvider: No directory handle for path: ${path}`);
		}

		const hasPermission = await hasDirPermission(handle);
		if (!hasPermission) {
			throw new Error(`LocalFilesystemProvider: Permission denied for directory: ${path}`);
		}

		const entries: Array<{ name: string; kind: 'file' | 'directory'; handle: FileSystemHandle }> =
			[];

		// @ts-expect-error - TypeScript doesn't have full types for File System Access API iterators
		for await (const entryHandle of handle.values()) {
			entries.push({
				name: entryHandle.name,
				kind: entryHandle.kind,
				handle: entryHandle
			});
		}

		// Sort: directories first, then alphabetically
		entries.sort((a, b) => {
			if (a.kind !== b.kind) {
				return a.kind === 'directory' ? -1 : 1;
			}
			return a.name.localeCompare(b.name);
		});

		return entries;
	}

	/**
	 * Resolve a file from within a local folder.
	 */
	async resolveFileInDir(folderPath: string, relativePath: string[]): Promise<File> {
		let handle = await this.getDirHandle(folderPath);
		if (!handle) {
			throw new Error(`LocalFilesystemProvider: No directory handle for path: ${folderPath}`);
		}

		// Navigate through subdirectories
		for (let i = 0; i < relativePath.length - 1; i++) {
			handle = await handle.getDirectoryHandle(relativePath[i]);
		}

		const fileName = relativePath[relativePath.length - 1];
		const fileHandle = await handle.getFileHandle(fileName);
		return fileHandle.getFile();
	}

	/**
	 * Load all directory handles from IndexedDB into cache.
	 */
	async loadDirHandlesFromStorage(): Promise<Map<string, FileSystemDirectoryHandle>> {
		const handles = await getAllDirHandles();
		for (const [path, handle] of handles) {
			this.dirHandleCache.set(path, handle);
		}
		return handles;
	}

	/**
	 * Clear directory handle cache.
	 */
	clearDirHandles(): void {
		this.dirHandleCache.clear();
	}
}
