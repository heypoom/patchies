import { describe, expect, it } from 'vitest';

import { migration017 } from './017-add-patch-vfs-namespace';

describe('migration017', () => {
  it('adds an empty Patch namespace without converting user files', () => {
    const migrated = migration017.migrate({
      files: {
        user: { 'shared.js': { provider: 'url', filename: 'shared.js', url: '/shared.js' } }
      }
    });

    expect(migrated.files).toEqual({
      patch: {},
      user: { 'shared.js': { provider: 'url', filename: 'shared.js', url: '/shared.js' } }
    });
  });
});
