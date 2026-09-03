import { describe, expect, it } from 'vitest';

import { collectDroppedPatchItems } from './drop-import';

const fileEntry = (name: string, content: string): FileSystemFileEntry =>
  ({
    name,
    isFile: true,
    isDirectory: false,
    file: (resolve: (file: File) => void) => resolve(new File([content], name))
  }) as FileSystemFileEntry;

function directoryEntry(name: string, batches: FileSystemEntry[][]): FileSystemDirectoryEntry {
  return {
    name,
    isFile: false,
    isDirectory: true,
    createReader: () => ({
      readEntries: (resolve: (entries: FileSystemEntry[]) => void) => resolve(batches.shift() ?? [])
    })
  } as FileSystemDirectoryEntry;
}

describe('collectDroppedPatchItems', () => {
  it('collects recursive folders, empty folders, and every directory reader batch', async () => {
    const empty = directoryEntry('empty', [[]]);
    const nested = directoryEntry('nested', [[fileEntry('two.js', 'two')], []]);
    const root = directoryEntry('bundle', [[fileEntry('one.js', 'one')], [empty, nested], []]);
    const dataTransfer = {
      items: [{ kind: 'file', webkitGetAsEntry: () => root }],
      files: []
    } as unknown as DataTransfer;

    const items = await collectDroppedPatchItems(dataTransfer);

    expect(items.map((item) => `${item.kind}:${item.relativePath}`)).toEqual([
      'directory:bundle',
      'file:bundle/one.js',
      'directory:bundle/empty',
      'directory:bundle/nested',
      'file:bundle/nested/two.js'
    ]);
  });
});
