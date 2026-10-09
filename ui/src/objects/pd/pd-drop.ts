import { VirtualFilesystem } from '$lib/vfs';

const isPdFilename = (filename: string): boolean => filename.toLowerCase().endsWith('.pd');

async function getFileHandle(
  items: DataTransferItemList | undefined
): Promise<FileSystemFileHandle | undefined> {
  const item = items ? Array.from(items).find((candidate) => candidate.kind === 'file') : undefined;
  if (!item || !('getAsFileSystemHandle' in item)) return undefined;

  try {
    const handle = await (
      item as DataTransferItem & {
        getAsFileSystemHandle(): Promise<FileSystemHandle | null>;
      }
    ).getAsFileSystemHandle();

    return handle?.kind === 'file' ? (handle as FileSystemFileHandle) : undefined;
  } catch {
    return undefined;
  }
}

export async function resolvePdDropPath(dataTransfer: DataTransfer | null): Promise<string | null> {
  if (!dataTransfer) return null;

  const vfs = VirtualFilesystem.getInstance();
  const vfsPath = dataTransfer.getData('application/x-vfs-path');

  if (vfsPath) {
    const entry = vfs.getEntryOrLinkedFile(vfsPath);
    if (!entry || !isPdFilename(entry.filename)) throw new Error('Choose a .pd patch file.');

    return vfsPath;
  }

  const file =
    dataTransfer.files?.[0] ??
    (dataTransfer.items
      ? Array.from(dataTransfer.items)
          .find((item) => item.kind === 'file')
          ?.getAsFile()
      : null);
  if (!file) return null;
  if (!isPdFilename(file.name)) throw new Error('Choose a .pd patch file.');

  return vfs.storeFile(file, await getFileHandle(dataTransfer.items));
}
