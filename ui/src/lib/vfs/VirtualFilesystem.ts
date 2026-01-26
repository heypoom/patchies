// Virtual Filesystem Singleton

import { writable, derived, type Readable } from 'svelte/store';
import { match } from 'ts-pattern';
import {
	type VFSEntry,
	type VFSTree,
	type VFSTreeNode,
	type VFSProvider,
	isVFSEntry,
	isVFSPath,
	parseVFSPath,
	VFS_PREFIXES
} from './types';
import { generateUserPath, getFilenameFromUrl, guessMimeType } from './path-utils';
import { clearFileData, clearHandles } from './persistence';

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
		this.entries.set(path, entry);
		this.notifyChange();
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
			mimeType: file.type || guessMimeType(file.name),
			size: file.size
		};

		this.entries.set(path, entry);

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

		this.notifyChange();
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

		// Update entry metadata
		entry.filename = file.name;
		entry.mimeType = file.type || guessMimeType(file.name);

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

		// Clear pending permission status
		this.pendingPermissions.delete(path);
		this.notifyChange();
	}

	/**
	 * Register a URL and return its generated VFS path.
	 */
	async registerUrl(url: string): Promise<string> {
		const filename = getFilenameFromUrl(url);
		const mimeType = guessMimeType(filename);
		const existingPaths = new Set(this.entries.keys());
		const path = generateUserPath(filename, mimeType, existingPaths);

		const entry: VFSEntry = {
			provider: 'url',
			url,
			filename,
			mimeType
		};

		this.entries.set(path, entry);
		this.notifyChange();

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

		this.entries.set(folderPath, entry);
		this.notifyChange();

		return folderPath;
	}

	/**
	 * Check if a path is a folder.
	 */
	isFolder(path: string): boolean {
		const entry = this.entries.get(path);
		return entry?.provider === 'folder' || entry?.provider === 'local-folder';
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
		if (entry) return entry;

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
				.with('user', () => {
					if (!tree.user) tree.user = {};
					this.setNestedEntry(tree.user, parsed.segments, entry);
				})
				.with('obj', () => {
					if (!tree.objects) tree.objects = {};
					// First segment is the node ID
					const [nodeId, ...rest] = parsed.segments;
					if (!nodeId) return;
					if (!tree.objects[nodeId]) tree.objects[nodeId] = {};
					if (rest.length > 0) {
						this.setNestedEntry(tree.objects[nodeId], rest, entry);
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
		this.entries.clear();
		this.pendingPermissions.clear();

		// user namespace -- for user-uploaded files
		if (tree.user) {
			this.hydrateNamespace(tree.user, VFS_PREFIXES.USER);
		}

		// objects namespace -- for each objects
		if (tree.objects) {
			for (const [nodeId, nodeTree] of Object.entries(tree.objects)) {
				this.hydrateNamespace(nodeTree, `${VFS_PREFIXES.OBJECT}${nodeId}/`);
			}
		}

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
		this.getLocalProvider()?.clearDirHandles();
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
