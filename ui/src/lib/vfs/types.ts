// Virtual Filesystem Types

export type VFSProviderType = 'url' | 'local' | 'folder';

/**
 * Entry metadata stored in the VFS tree.
 * This is what gets serialized to the patch file.
 */
export interface VFSEntry {
	provider: VFSProviderType;
	/** URL for 'url' provider */
	url?: string;
	/** Original filename for display */
	filename: string;
	/** MIME type, e.g., 'image/png'. Not present for folders. */
	mimeType?: string;
}

/**
 * Check if a VFSEntry is a folder
 */
export function isVFSFolder(entry: VFSEntry): boolean {
	return entry.provider === 'folder';
}

/**
 * Provider interface for resolving VFS entries to actual file content.
 */
export interface VFSProvider {
	type: VFSProviderType;
	resolve(entry: VFSEntry, path: string): Promise<File | Blob>;
}

/**
 * Tree structure for serialization.
 * Matches the patch format with nested directories.
 *
 * Example:
 * {
 *   user: {
 *     images: {
 *       'photo.jpg': { provider: 'local', filename: 'photo.jpg' }
 *     }
 *   }
 * }
 */
export type VFSTreeNode = VFSEntry | { [key: string]: VFSTreeNode };

export interface VFSTree {
	user?: { [key: string]: VFSTreeNode };
	objects?: { [nodeId: string]: { [key: string]: VFSTreeNode } };
}

/**
 * Check if a tree node is a VFSEntry (leaf) or a directory (branch).
 */
export function isVFSEntry(node: VFSTreeNode): node is VFSEntry {
	return typeof node === 'object' && node !== null && 'provider' in node && 'filename' in node;
}

/**
 * VFS path prefixes
 */
export const VFS_PREFIXES = {
	USER: 'user://',
	OBJECT: 'obj://'
} as const;

/**
 * Check if a path is a VFS path (has user:// or obj:// prefix)
 */
export function isVFSPath(path: string): boolean {
	return path.startsWith(VFS_PREFIXES.USER) || path.startsWith(VFS_PREFIXES.OBJECT);
}

/**
 * Parse a VFS path into its components.
 * Example: 'user://images/photo.jpg' -> { namespace: 'user', segments: ['images', 'photo.jpg'] }
 */
export function parseVFSPath(
	path: string
): { namespace: 'user' | 'obj'; segments: string[] } | null {
	if (path.startsWith(VFS_PREFIXES.USER)) {
		const rest = path.slice(VFS_PREFIXES.USER.length);
		return { namespace: 'user', segments: rest.split('/').filter(Boolean) };
	}
	if (path.startsWith(VFS_PREFIXES.OBJECT)) {
		const rest = path.slice(VFS_PREFIXES.OBJECT.length);
		return { namespace: 'obj', segments: rest.split('/').filter(Boolean) };
	}
	return null;
}
