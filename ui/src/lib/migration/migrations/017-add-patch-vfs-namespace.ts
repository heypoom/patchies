import type { Migration } from '../types';

/** Adds the portable patch:// namespace without changing existing user:// entries. */
export const migration017: Migration = {
  version: 17,
  name: 'add-patch-vfs-namespace',

  migrate(patch) {
    return {
      ...patch,
      files: {
        user: {},
        objects: {},
        ...(patch.files ?? {}),
        patch: patch.files?.patch ?? {}
      }
    };
  }
};
