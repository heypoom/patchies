import type { Migration, RawPatchData } from '../types';
import type { VFSEntry, VFSTree } from '$lib/vfs/types';

/**
 * Extract file extension from URL or path
 */
function getExtension(urlOrPath: string): string {
	try {
		// Try to parse as URL first
		const url = new URL(urlOrPath);
		const pathname = url.pathname;
		const lastDot = pathname.lastIndexOf('.');
		if (lastDot !== -1) {
			return pathname.slice(lastDot + 1).toLowerCase();
		}
	} catch {
		// Not a valid URL, try as path
		const lastDot = urlOrPath.lastIndexOf('.');
		if (lastDot !== -1) {
			return urlOrPath.slice(lastDot + 1).toLowerCase();
		}
	}

	// Default to wav if no extension found
	return 'wav';
}

/**
 * Extract filename from URL
 */
function getFilenameFromUrl(url: string): string {
	try {
		const parsed = new URL(url);
		const pathname = parsed.pathname;
		const segments = pathname.split('/').filter(Boolean);

		if (segments.length > 0) {
			return decodeURIComponent(segments[segments.length - 1]);
		}
	} catch {
		// Fallback
	}

	return 'audio.wav';
}

/**
 * Migration 004: Convert soundfile~ URL to VFS paths
 *
 * Before: soundfile~ nodes had `data.url: "<url>"` and `data.fileName: "<name>"`
 * After: They use `data.vfsPath: "user://<filename>"` with VFS entries
 *
 * This migration:
 * 1. Finds soundfile~ nodes with data.url
 * 2. Converts data.url to data.vfsPath
 * 3. Registers the URL in the VFS files tree as a 'url' provider entry
 * 4. Uses format `<nodeId>.<ext>` to avoid collisions (e.g., soundfile~-45.wav)
 */
export const migration004: Migration = {
	version: 4,
	name: 'soundfile-vfs-migration',

	migrate(patch: RawPatchData): RawPatchData {
		if (!patch.nodes) return patch;

		// Ensure files structure exists
		const files: VFSTree = patch.files ?? { user: {}, objects: {} };
		if (!files.user) files.user = {};

		const migratedNodes = patch.nodes.map((node) => {
			// Only process soundfile~ nodes
			if (node.type !== 'soundfile~') {
				return node;
			}

			// Check if it has a URL that needs migration
			const url = node.data?.url;
			if (typeof url !== 'string' || !url) {
				return node;
			}

			// Already has vfsPath, skip
			if (node.data?.vfsPath) {
				return node;
			}

			// Get extension and filename
			const ext = getExtension(url);
			const existingFileName = node.data?.fileName;
			const displayFilename =
				typeof existingFileName === 'string' && existingFileName
					? existingFileName
					: getFilenameFromUrl(url);

			// Generate VFS filename: <nodeId>.<ext> (e.g., soundfile~-45.wav)
			const vfsFilename = `${node.id}.${ext}`;
			const vfsPath = `user://${vfsFilename}`;

			// Create VFS entry for the URL
			const vfsEntry: VFSEntry = {
				provider: 'url',
				url: url,
				filename: displayFilename,
				mimeType: `audio/${ext === 'mp3' ? 'mpeg' : ext}`
			};

			// Add to VFS tree
			files.user![vfsFilename] = vfsEntry;

			// Update node data - remove url, add vfsPath
			const newData = { ...node.data };
			delete newData.url;
			newData.vfsPath = vfsPath;
			newData.fileName = displayFilename;

			return { ...node, data: newData };
		});

		return { ...patch, nodes: migratedNodes, files };
	}
};
