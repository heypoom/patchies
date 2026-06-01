import { describe, expect, test } from 'vitest';

import {
  getExpandedChildDirectories,
  getExpandedLinkedFolderPathsToLoad,
  type LinkedFolderItem
} from './file-tree-linked-folders';

function createHandle(name: string, kind: 'file' | 'directory'): FileSystemHandle {
  return { name, kind } as FileSystemHandle;
}

describe('file tree linked folders', () => {
  test('finds restored expanded linked folders that need contents loaded', () => {
    expect(
      getExpandedLinkedFolderPathsToLoad({
        entries: new Map([
          ['user://project', { provider: 'local-folder' }],
          ['user://manual', { provider: 'folder' }]
        ]),
        expandedPaths: new Set(['user://project', 'user://manual']),
        loadedPaths: new Set(),
        pendingPaths: new Set(),
        loadingPaths: new Set()
      })
    ).toEqual(['user://project']);
  });

  test('does not load linked folders that are loaded, pending, collapsed, or already loading', () => {
    expect(
      getExpandedLinkedFolderPathsToLoad({
        entries: new Map([
          ['user://loaded', { provider: 'local-folder' }],
          ['user://pending', { provider: 'local-folder' }],
          ['user://collapsed', { provider: 'local-folder' }],
          ['user://loading', { provider: 'local-folder' }]
        ]),
        expandedPaths: new Set(['user://loaded', 'user://pending', 'user://loading']),
        loadedPaths: new Set(['user://loaded']),
        pendingPaths: new Set(['user://pending']),
        loadingPaths: new Set(['user://loading'])
      })
    ).toEqual([]);
  });

  test('finds expanded child directories that still need contents loaded', () => {
    const contents: LinkedFolderItem[] = [
      { name: 'samples', kind: 'directory', handle: createHandle('samples', 'directory') },
      { name: 'readme.md', kind: 'file', handle: createHandle('readme.md', 'file') }
    ];

    expect(
      getExpandedChildDirectories({
        parentPath: 'user://project',
        contents,
        expandedPaths: new Set(['user://project/samples']),
        loadedPaths: new Set(['user://project'])
      })
    ).toEqual([{ path: 'user://project/samples', handle: contents[0].handle }]);
  });

  test('skips already loaded child directories unless refreshing', () => {
    const contents: LinkedFolderItem[] = [
      { name: 'samples', kind: 'directory', handle: createHandle('samples', 'directory') }
    ];

    const args = {
      parentPath: 'user://project',
      contents,
      expandedPaths: new Set(['user://project/samples']),
      loadedPaths: new Set(['user://project/samples'])
    };

    expect(getExpandedChildDirectories(args)).toEqual([]);
    expect(getExpandedChildDirectories({ ...args, includeLoaded: true })).toEqual([
      { path: 'user://project/samples', handle: contents[0].handle }
    ]);
  });
});
