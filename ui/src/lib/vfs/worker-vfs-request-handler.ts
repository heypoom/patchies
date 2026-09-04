import { VirtualFilesystem } from './VirtualFilesystem';
import type { VFSListEntry } from './types';
import { isExternalUrl, normalizeUserVfsPath } from './user-api-paths';

type VfsUrlResponse = { url: string } | { error: string };
type VfsEntriesResponse = { entries: VFSListEntry[] } | { error: string };
type VfsTextResponse = { text: string } | { error: string };

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const objectUrlsByNode = new Map<string, Set<string>>();

function trackObjectUrl(nodeId: string, url: string): void {
  const urls = objectUrlsByNode.get(nodeId) ?? new Set<string>();

  urls.add(url);
  objectUrlsByNode.set(nodeId, urls);
}

/** Resolve a worker VFS URL request on the main thread. */
export async function resolveVfsUrl(nodeId: string, path: string): Promise<VfsUrlResponse> {
  try {
    if (isExternalUrl(path)) return { url: path };

    const vfs = VirtualFilesystem.getInstance();
    const blob = await vfs.resolve(normalizeUserVfsPath(path));

    const url = URL.createObjectURL(blob);
    trackObjectUrl(nodeId, url);

    return { url };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

/** Revoke all Blob URLs created for a worker node. */
export function revokeWorkerVfsObjectUrls(nodeId: string): void {
  const urls = objectUrlsByNode.get(nodeId);
  if (!urls) return;

  for (const url of urls) {
    URL.revokeObjectURL(url);
  }

  objectUrlsByNode.delete(nodeId);
}

/** List a worker VFS directory request on the main thread. */
export async function listVfsEntries(path: string): Promise<VfsEntriesResponse> {
  try {
    const vfs = VirtualFilesystem.getInstance();

    return {
      entries: await vfs.listChildren(normalizeUserVfsPath(path))
    };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

/** Search a worker VFS directory request on the main thread. */
export async function searchVfsEntries(query: string, path: string): Promise<VfsEntriesResponse> {
  try {
    const vfs = VirtualFilesystem.getInstance();

    return {
      entries: await vfs.search(query, normalizeUserVfsPath(path))
    };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

/** Resolve a text-only VFS request used by render-worker GLSL includes. */
export async function resolveVfsText(path: string): Promise<VfsTextResponse> {
  if (!path.startsWith('patch://') && !path.startsWith('user://')) {
    return {
      error: `Invalid VFS path: "${path}". Only patch:// and user:// paths are supported.`
    };
  }

  try {
    const vfs = VirtualFilesystem.getInstance();
    const file = await vfs.resolve(path);

    return { text: await file.text() };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}
