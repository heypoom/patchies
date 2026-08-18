import { describe, expect, test } from 'vitest';

import { listVfsFiles, readVfsText, searchVfsFiles, statVfsFile } from './vfs-tool-handlers';

const entries = new Map([
  [
    'user://notes/readme.txt',
    { provider: 'local' as const, filename: 'readme.txt', mimeType: 'text/plain', size: 11 }
  ],
  [
    'user://images/cat.png',
    { provider: 'local' as const, filename: 'cat.png', mimeType: 'image/png', size: 4 }
  ]
]);
const vfs = {
  getEntryOrLinkedFile: (path: string) => entries.get(path),
  isFolder: (path: string) => path === 'user://notes',
  listChildrenPage: async (path: string, options: { offset: number; limit: number }) => ({
    entries: [{ path: `${path}notes`, name: 'notes', kind: 'directory' as const }],
    ...options,
    truncated: false
  }),
  searchPage: async (query: string, path: string, options: { offset: number; limit: number }) => ({
    entries: [{ path: `${path}notes/${query}.txt`, name: `${query}.txt`, kind: 'file' as const }],
    ...options,
    truncated: false
  }),
  resolve: async (path: string) =>
    path.endsWith('.txt') ? new Blob(['hello world'], { type: 'text/plain' }) : new Blob(['png'])
};

describe('chat VFS tool handlers', () => {
  test('lists and searches normalized VFS paths', async () => {
    await expect(listVfsFiles({}, vfs)).resolves.toMatchObject({
      path: 'user://',
      offset: 0,
      limit: 50,
      truncated: false
    });
    await expect(searchVfsFiles({ query: 'kick', path: './samples' }, vfs)).resolves.toMatchObject({
      path: 'user://samples',
      query: 'kick',
      offset: 0,
      limit: 50,
      truncated: false
    });
  });

  test('caps requested VFS search pages', async () => {
    await expect(
      searchVfsFiles({ query: 'kick', offset: 5, limit: 999 }, vfs)
    ).resolves.toMatchObject({
      offset: 5,
      limit: 100
    });
  });

  test('caps requested VFS list pages', async () => {
    await expect(listVfsFiles({ offset: 5, limit: 999 }, vfs)).resolves.toMatchObject({
      offset: 5,
      limit: 100
    });
  });

  test('returns stored file metadata without reading its content', () => {
    expect(statVfsFile({ path: './notes/readme.txt' }, vfs)).toMatchObject({
      path: 'user://notes/readme.txt',
      size: 11,
      mimeType: 'text/plain'
    });
  });

  test('reads a bounded text range and reports whether more content remains', async () => {
    await expect(
      readVfsText({ path: './notes/readme.txt', offset: 6, length: 3 }, vfs)
    ).resolves.toMatchObject({
      content: 'wor',
      offset: 6,
      bytesRead: 3,
      truncated: true,
      size: 11
    });
  });

  test('rejects binary files', async () => {
    await expect(readVfsText({ path: './images/cat.png' }, vfs)).resolves.toMatchObject({
      error: 'VFS file is not a supported text format: user://images/cat.png'
    });
  });

  test('caps an oversized text read', async () => {
    const largeVfs = {
      ...vfs,
      getEntryOrLinkedFile: () => ({
        provider: 'local' as const,
        filename: 'large.txt',
        mimeType: 'text/plain',
        size: 40 * 1024
      }),
      resolve: async () => new Blob(['x'.repeat(40 * 1024)], { type: 'text/plain' })
    };

    await expect(
      readVfsText({ path: './large.txt', length: 40 * 1024 }, largeVfs)
    ).resolves.toMatchObject({ bytesRead: 32 * 1024, truncated: true });
  });

  test('aligns a range that starts inside a UTF-8 character', async () => {
    const unicodeVfs = {
      ...vfs,
      getEntryOrLinkedFile: () => ({
        provider: 'local' as const,
        filename: 'unicode.txt',
        mimeType: 'text/plain'
      }),
      resolve: async () => new Blob(['aéz'], { type: 'text/plain' })
    };

    await expect(
      readVfsText({ path: './unicode.txt', offset: 2, length: 1 }, unicodeVfs)
    ).resolves.toMatchObject({ offset: 1, bytesRead: 2, content: 'é' });
  });

  test('clamps post-EOF offsets to an empty range', async () => {
    await expect(
      readVfsText({ path: './notes/readme.txt', offset: 99 }, vfs)
    ).resolves.toMatchObject({
      offset: 11,
      bytesRead: 0,
      truncated: false,
      content: ''
    });
  });
});
