import type { Migration } from '../types';

/**
 * Migration 002: Add VFS files field
 *
 * Adds the `files` field to patches for Virtual Filesystem support.
 * Old patches without `files` will get an empty structure.
 *
 * This migration also converts old ImageNode data format:
 *   Before: { file: File, fileName: string }
 *   After: { vfsPath: string }
 *
 * Note: Since File objects are ephemeral and don't survive serialization,
 * old patches with file data will lose those files. Users will need to
 * re-add images after this migration.
 */
export const migration002: Migration = {
  version: 2,
  name: 'add-vfs-files-field',

  migrate(patch) {
    // Add empty files structure if not present
    const migratedPatch = {
      ...patch,
      files: patch.files ?? { user: {}, objects: {} }
    };

    // Strip file and fileName from `img` node
    if (migratedPatch.nodes) {
      migratedPatch.nodes = migratedPatch.nodes.map((node) => {
        if (node.type === 'img' && node.data) {
          delete node.data.file;
          delete node.data.fileName;

          return { ...node, data: node.data };
        }

        return node;
      });
    }

    return migratedPatch;
  }
};
