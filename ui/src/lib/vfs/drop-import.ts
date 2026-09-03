import type { PatchImportItem } from './types';

const readFileEntry = (entry: FileSystemFileEntry): Promise<File> =>
  new Promise((resolve, reject) => entry.file(resolve, reject));

async function readDirectoryEntries(entry: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = entry.createReader();
  const entries: FileSystemEntry[] = [];

  while (true) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject)
    );
    if (batch.length === 0) return entries;

    entries.push(...batch);
  }
}

async function collectEntry(
  entry: FileSystemEntry,
  parentPath: string,
  items: PatchImportItem[]
): Promise<void> {
  const relativePath = parentPath ? `${parentPath}/${entry.name}` : entry.name;

  if (entry.isFile) {
    items.push({
      kind: 'file',
      file: await readFileEntry(entry as FileSystemFileEntry),
      relativePath
    });

    return;
  }

  items.push({ kind: 'directory', relativePath });

  const children = await readDirectoryEntries(entry as FileSystemDirectoryEntry);
  for (const child of children) {
    await collectEntry(child, relativePath, items);
  }
}

/** Collect dropped files and folders before the DataTransfer becomes invalid. */
export async function collectDroppedPatchItems(
  dataTransfer: DataTransfer
): Promise<PatchImportItem[]> {
  const entries = Array.from(dataTransfer.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.webkitGetAsEntry())
    .filter((entry): entry is FileSystemEntry => entry !== null);

  if (entries.length === 0) {
    return Array.from(dataTransfer.files).map((file) => ({
      kind: 'file' as const,
      file,
      relativePath: file.webkitRelativePath || file.name
    }));
  }

  const items: PatchImportItem[] = [];
  for (const entry of entries) {
    await collectEntry(entry, '', items);
  }

  return items;
}
