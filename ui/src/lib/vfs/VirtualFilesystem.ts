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
			mimeType: file.type || guessMimeType(file.name)
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
		return entry?.provider === 'folder';
	}

	// ─────────────────────────────────────────────────────────────────
	// Resolution
	// ─────────────────────────────────────────────────────────────────

	/**
	 * Resolve a VFS path to actual file content.
	 */
	async resolve(path: string): Promise<File | Blob> {
		const entry = this.entries.get(path);
		if (!entry) {
			throw new Error(`VFS: Path not found: ${path}`);
		}

		const provider = this.providers.get(entry.provider);
		if (!provider) {
			throw new Error(`VFS: No provider registered for type: ${entry.provider}`);
		}

		return provider.resolve(entry, path);
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

		if (tree.user) {
			this.hydrateNamespace(tree.user, VFS_PREFIXES.USER);
		}

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
		this.entries.delete(path);
		this.pendingPermissions.delete(path);
		this.notifyChange();
	}

	/**
	 * Clear all entries.
	 */
	clear(): void {
		this.entries.clear();
		this.pendingPermissions.clear();
		this.notifyChange();
	}

	clearPersistedData(): void {
		clearHandles();
		clearFileData();
	}
}
