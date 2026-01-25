/**
 * useVfsMedia - A Svelte 5 composable for VFS-backed media files.
 *
 * Encapsulates all VFS state management, file loading, permission handling,
 * and drag-drop logic for media nodes (image, audio, video).
 */

import { VirtualFilesystem, isVFSPath } from './index';
import { logger } from '$lib/utils/logger';
import { get } from 'svelte/store';

export interface UseVfsMediaOptions {
	/** The node ID for VFS path generation */
	nodeId: string;

	/** MIME type prefix to accept (e.g., 'image/', 'audio/', 'video/') */
	acceptMimePrefix: 'image/' | 'audio/' | 'video/';

	/** Callback when a file is successfully loaded */
	onFileLoaded: (file: File) => Promise<void>;

	/** Callback to update node data with new vfsPath */
	updateNodeData: (data: { vfsPath?: string }) => void;

	/** Getter for current VFS path from node data */
	getVfsPath: () => string | undefined;

	/** File picker accept types (e.g., ['.png', '.jpg']) */
	filePickerAccept?: string[];

	/** File picker description (e.g., 'Images') */
	filePickerDescription?: string;
}

export interface UseVfsMediaReturn {
	// State (reactive getters)
	readonly isLoading: boolean;
	readonly needsReselect: boolean;
	readonly needsFolderRelink: boolean;
	readonly hasVfsPath: boolean;
	readonly linkedFolderPath: string | null;
	readonly linkedFolderName: string | null;
	readonly isDragging: boolean;

	// File input ref (getter/setter)
	fileInputRef: HTMLInputElement | null;

	// Methods
	loadFromVfsPath: (path: string) => Promise<void>;
	loadFromUrl: (url: string) => Promise<void>;
	loadFile: (file: File, handle?: FileSystemFileHandle) => Promise<void>;
	requestFilePermission: () => Promise<void>;
	openFilePickerWithHandle: () => Promise<void>;
	openFileDialog: () => void;

	// Drag-drop handlers
	handleDragOver: (e: DragEvent) => void;
	handleDragLeave: (e: DragEvent) => void;
	handleDrop: (e: DragEvent) => Promise<void>;
	handleFileSelect: (e: Event) => Promise<void>;

	// For message handling
	loadFromPath: (urlOrPath: string) => void;

	// Reset state (e.g., when file is successfully displayed)
	markLoaded: () => void;
}

/**
 * Find the linked folder path that contains a given VFS path.
 * E.g., for "user://my-folder/sub/file.jpg" returns "user://my-folder" if it's a linked folder.
 */
function findLinkedFolderPath(vfs: VirtualFilesystem, path: string | undefined): string | null {
	if (!path) return null;

	const segments = path.split('/');
	for (let i = 3; i < segments.length; i++) {
		const potentialPath = segments.slice(0, i).join('/');
		const entry = vfs.getEntry(potentialPath);
		if (entry?.provider === 'local-folder') {
			return potentialPath;
		}
	}
	return null;
}

/**
 * Creates a VFS media composable for handling file loading, permissions, and drag-drop.
 */
export function useVfsMedia(options: UseVfsMediaOptions): UseVfsMediaReturn {
	const vfs = VirtualFilesystem.getInstance();

	// Reactive state
	let isLoading = $state(false);
	let needsReselect = $state(false);
	let needsFolderRelink = $state(false);
	let isDragging = $state(false);
	let fileInputRef = $state<HTMLInputElement | null>(null);

	// Derived state
	const hasVfsPath = $derived(!!options.getVfsPath());
	const linkedFolderPath = $derived(findLinkedFolderPath(vfs, options.getVfsPath()));
	const linkedFolderName = $derived(linkedFolderPath?.split('/').pop() ?? null);

	// Track pending permissions reactively via subscription
	let pendingPermissions = $state<Set<string>>(get(vfs.pendingPermissions$));

	// Subscribe to pending permissions store and update local state
	$effect(() => {
		const unsubscribe = vfs.pendingPermissions$.subscribe((pending) => {
			pendingPermissions = pending;
		});

		return unsubscribe;
	});

	// Watch for when the linked folder is re-linked (removed from pending permissions)
	$effect(() => {
		// If we're waiting for a folder relink and the folder is no longer pending, retry loading
		if (needsFolderRelink && linkedFolderPath && !pendingPermissions.has(linkedFolderPath)) {
			// Folder has been re-linked, retry loading
			needsFolderRelink = false;

			const path = options.getVfsPath();
			if (path) {
				loadFromVfsPath(path);
			}
		}
	});

	// ─────────────────────────────────────────────────────────────────
	// Core Methods
	// ─────────────────────────────────────────────────────────────────

	async function loadFromVfsPath(vfsPath: string): Promise<void> {
		try {
			isLoading = true;
			needsReselect = false;
			needsFolderRelink = false;

			const fileOrBlob = await vfs.resolve(vfsPath);

			const file =
				fileOrBlob instanceof File
					? fileOrBlob
					: new File([fileOrBlob], 'media', { type: fileOrBlob.type });

			await options.onFileLoaded(file);
		} catch (err) {
			logger.error('[vfs load error]', err);

			if (err instanceof Error) {
				// Check if the error is about a missing directory handle (linked folder)
				if (err.message.includes('No directory handle')) {
					needsFolderRelink = true;
				} else if (
					err.message.includes('Permission denied') ||
					err.message.includes('No handle or cached data found')
				) {
					needsReselect = true;
				}
			}
		} finally {
			isLoading = false;
		}
	}

	async function loadFromUrl(url: string): Promise<void> {
		try {
			isLoading = true;
			const vfsPath = await vfs.registerUrl(url);

			// Update node data with VFS path
			options.updateNodeData({ vfsPath });

			await loadFromVfsPath(vfsPath);
		} catch (err) {
			console.error('Failed to load from URL:', err);
			isLoading = false;
		}
	}

	function loadFromPath(urlOrPath: string): void {
		if (isVFSPath(urlOrPath)) {
			loadFromVfsPath(urlOrPath);
		} else {
			loadFromUrl(urlOrPath);
		}
	}

	async function loadFile(file: File, handle?: FileSystemFileHandle): Promise<void> {
		try {
			isLoading = true;

			const vfsPath = await vfs.storeFile(file, handle);
			options.updateNodeData({ vfsPath });

			await options.onFileLoaded(file);
		} catch (error) {
			console.error('Failed to load file:', error);
		} finally {
			isLoading = false;
		}
	}

	// ─────────────────────────────────────────────────────────────────
	// Permission Handling
	// ─────────────────────────────────────────────────────────────────

	async function requestFilePermission(): Promise<void> {
		const vfsPath = options.getVfsPath();
		if (!vfsPath) return;

		// First try to request permission from existing handle
		const granted = await vfs.requestPermission(vfsPath);
		if (granted) {
			needsReselect = false;
			needsFolderRelink = false;
			await loadFromVfsPath(vfsPath);
			return;
		}

		// If no handle exists, prompt user to re-select the file
		const entry = vfs.getEntryOrLinkedFile(vfsPath);
		const filename = entry?.filename || 'the file';

		console.log(`VFS: No handle for ${vfsPath}, prompting user to re-select ${filename}`);

		// Open file picker and replace the existing VFS entry
		try {
			if ('showOpenFilePicker' in window) {
				const pickerOptions = buildFilePickerOptions();

				// @ts-expect-error - showOpenFilePicker is not typed
				const [handle] = await window.showOpenFilePicker(pickerOptions);

				const file = await handle.getFile();
				// Replace file at the existing path instead of creating a new one
				await vfs.replaceFile(vfsPath, file, handle);
				await options.onFileLoaded(file);
			} else {
				// Fall back to traditional file input (won't have handle for persistence)
				fileInputRef?.click();
			}
		} catch (err) {
			if (err instanceof Error && err.name !== 'AbortError') {
				console.error('File picker error:', err);
			}
		}
	}

	async function openFilePickerWithHandle(): Promise<void> {
		try {
			// Use File System Access API if available
			if ('showOpenFilePicker' in window) {
				const pickerOptions = buildFilePickerOptions();

				// @ts-expect-error - showOpenFilePicker is not typed
				const [handle] = await window.showOpenFilePicker(pickerOptions);

				const file = await handle.getFile();
				await loadFile(file, handle);
			} else {
				// Fall back to traditional file input
				fileInputRef?.click();
			}
		} catch (err) {
			// User cancelled or error - ignore
			if (err instanceof Error && err.name !== 'AbortError') {
				console.error('File picker error:', err);
			}
		}
	}

	function buildFilePickerOptions() {
		const accept: Record<string, string[]> = {};
		accept[`${options.acceptMimePrefix}*`] =
			options.filePickerAccept ?? getDefaultAcceptExtensions(options.acceptMimePrefix);

		return {
			types: [
				{
					description:
						options.filePickerDescription ?? getDefaultDescription(options.acceptMimePrefix),
					accept
				}
			],
			multiple: false
		};
	}

	function openFileDialog(): void {
		// Use the handle-based picker for persistence support
		openFilePickerWithHandle();
	}

	// ─────────────────────────────────────────────────────────────────
	// Drag & Drop Handlers
	// ─────────────────────────────────────────────────────────────────

	function handleDragOver(event: DragEvent): void {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(event: DragEvent): void {
		event.preventDefault();
		isDragging = false;
	}

	async function handleDrop(event: DragEvent): Promise<void> {
		event.preventDefault();
		event.stopPropagation();
		isDragging = false;

		// Check for VFS path drop first
		const vfsPathData = event.dataTransfer?.getData('application/x-vfs-path');
		if (vfsPathData) {
			// Verify it's the correct file type (supports linked folder files too)
			const entry = vfs.getEntryOrLinkedFile(vfsPathData);

			if (entry?.mimeType?.startsWith(options.acceptMimePrefix)) {
				options.updateNodeData({ vfsPath: vfsPathData });
				await loadFromVfsPath(vfsPathData);
				return;
			} else {
				console.warn(
					`Only ${options.acceptMimePrefix}* files are supported, got:`,
					entry?.mimeType
				);
				return;
			}
		}

		const items = event.dataTransfer?.items;
		if (!items || items.length === 0) return;

		const item = items[0];
		if (!item.type.startsWith(options.acceptMimePrefix)) {
			console.warn(`Only ${options.acceptMimePrefix}* files are supported`);
			return;
		}

		// Try to get FileSystemFileHandle for persistence (Chrome 86+)
		let handle: FileSystemFileHandle | undefined;
		if ('getAsFileSystemHandle' in item) {
			try {
				const fsHandle = await (
					item as DataTransferItem & { getAsFileSystemHandle(): Promise<FileSystemHandle | null> }
				).getAsFileSystemHandle();
				if (fsHandle?.kind === 'file') {
					handle = fsHandle as FileSystemFileHandle;
				}
			} catch {
				// Not supported or user denied - fall back to file-only
			}
		}

		const file = item.getAsFile();
		if (!file) return;

		await loadFile(file, handle);
	}

	async function handleFileSelect(event: Event): Promise<void> {
		const input = event.target as HTMLInputElement;
		const files = input.files;
		if (!files || files.length === 0) return;

		const file = files[0];
		const vfsPath = options.getVfsPath();

		// If we're replacing an existing file that needs reselection, use replaceFile
		if (vfsPath && needsReselect) {
			await vfs.replaceFile(vfsPath, file);
			await options.onFileLoaded(file);
		} else {
			// File input doesn't give us handles, so we'll use showOpenFilePicker for persistence
			// For now, just load without handle (won't persist across reloads)
			await loadFile(file);
		}

		// Reset input so same file can be selected again
		input.value = '';
	}

	function markLoaded(): void {
		needsReselect = false;
		needsFolderRelink = false;
	}

	// ─────────────────────────────────────────────────────────────────
	// Return Interface
	// ─────────────────────────────────────────────────────────────────

	return {
		// State getters
		get isLoading() {
			return isLoading;
		},
		get needsReselect() {
			return needsReselect;
		},
		get needsFolderRelink() {
			return needsFolderRelink;
		},
		get hasVfsPath() {
			return hasVfsPath;
		},
		get linkedFolderPath() {
			return linkedFolderPath;
		},
		get linkedFolderName() {
			return linkedFolderName;
		},
		get isDragging() {
			return isDragging;
		},

		// File input ref (getter/setter for bind:this)
		get fileInputRef() {
			return fileInputRef;
		},
		set fileInputRef(ref: HTMLInputElement | null) {
			fileInputRef = ref;
		},

		// Methods
		loadFromVfsPath,
		loadFromUrl,
		loadFromPath,
		loadFile,
		requestFilePermission,
		openFilePickerWithHandle,
		openFileDialog,
		handleDragOver,
		handleDragLeave,
		handleDrop,
		handleFileSelect,
		markLoaded
	};
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function getDefaultAcceptExtensions(mimePrefix: string): string[] {
	switch (mimePrefix) {
		case 'image/':
			return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];
		case 'audio/':
			return ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'];
		case 'video/':
			return ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
		default:
			return [];
	}
}

function getDefaultDescription(mimePrefix: string): string {
	switch (mimePrefix) {
		case 'image/':
			return 'Images';
		case 'audio/':
			return 'Audio Files';
		case 'video/':
			return 'Video Files';
		default:
			return 'Files';
	}
}
