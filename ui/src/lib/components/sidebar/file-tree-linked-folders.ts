export type LinkedFolderItem = {
  name: string;
  kind: 'file' | 'directory';
  handle: FileSystemHandle;
};

export type ExpandedChildDirectory = {
  path: string;
  handle: FileSystemDirectoryHandle;
};

export function getExpandedLinkedFolderPathsToLoad({
  entries,
  expandedPaths,
  loadedPaths,
  pendingPaths,
  loadingPaths
}: {
  entries: Iterable<[string, { provider: string }]>;
  expandedPaths: ReadonlySet<string>;
  loadedPaths: ReadonlySet<string>;
  pendingPaths: ReadonlySet<string>;
  loadingPaths: ReadonlySet<string>;
}): string[] {
  const pathsToLoad: string[] = [];

  for (const [path, entry] of entries) {
    if (entry.provider !== 'local-folder') continue;
    if (!expandedPaths.has(path)) continue;
    if (loadedPaths.has(path)) continue;
    if (pendingPaths.has(path)) continue;
    if (loadingPaths.has(path)) continue;

    pathsToLoad.push(path);
  }

  return pathsToLoad;
}

export function getExpandedChildDirectories({
  parentPath,
  contents,
  expandedPaths,
  loadedPaths,
  includeLoaded = false
}: {
  parentPath: string;
  contents: LinkedFolderItem[];
  expandedPaths: ReadonlySet<string>;
  loadedPaths: ReadonlySet<string>;
  includeLoaded?: boolean;
}): ExpandedChildDirectory[] {
  const childDirectories: ExpandedChildDirectory[] = [];

  for (const item of contents) {
    if (item.kind !== 'directory') continue;

    const childPath = `${parentPath}/${item.name}`;

    if (!expandedPaths.has(childPath)) continue;
    if (!includeLoaded && loadedPaths.has(childPath)) continue;

    childDirectories.push({
      path: childPath,
      handle: item.handle as FileSystemDirectoryHandle
    });
  }

  return childDirectories;
}
