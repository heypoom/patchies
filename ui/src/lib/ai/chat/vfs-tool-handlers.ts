import { VirtualFilesystem } from '$lib/vfs';
import { guessMimeType } from '$lib/vfs/path-utils';
import { isExternalUrl, normalizeUserVfsPath } from '$lib/vfs/user-api-paths';
import type { VFSEntry, VFSListEntry } from '$lib/vfs/types';

const DEFAULT_READ_LENGTH = 16 * 1024;
export const MAX_VFS_TEXT_READ_LENGTH = 32 * 1024;

const TEXT_MIME_TYPES = new Set([
  'application/javascript',
  'application/json',
  'application/ld+json',
  'application/sql',
  'application/typescript',
  'application/x-javascript',
  'application/xml',
  'application/yaml',
  'application/x-yaml'
]);

const TEXT_EXTENSIONS = new Set([
  '.asm',
  '.c',
  '.cc',
  '.cpp',
  '.csd',
  '.css',
  '.csv',
  '.glsl',
  '.h',
  '.html',
  '.java',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.py',
  '.rs',
  '.scss',
  '.sh',
  '.sql',
  '.svg',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml'
]);

interface ChatVfs {
  getEntryOrLinkedFile(path: string): VFSEntry | undefined;
  isFolder(path: string): boolean;
  listChildren(path: string): Promise<VFSListEntry[]>;
  search(query: string, path: string): Promise<VFSListEntry[]>;
  resolve(path: string): Promise<File | Blob>;
}

const getVfs = (vfs?: ChatVfs): ChatVfs => vfs ?? VirtualFilesystem.getInstance();

function normalizePath(path: unknown): string {
  const input = typeof path === 'string' && path.trim() ? path.trim() : '.';

  if (isExternalUrl(input)) {
    throw new Error(`Invalid VFS path: "${input}". External URLs are not supported.`);
  }

  return normalizeUserVfsPath(input);
}

function getExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');

  return dotIndex > 0 ? filename.slice(dotIndex).toLowerCase() : '';
}

function isTextMimeType(mimeType: string | undefined): boolean {
  if (!mimeType) return false;

  const normalized = mimeType.split(';', 1)[0].toLowerCase();

  return normalized.startsWith('text/') || TEXT_MIME_TYPES.has(normalized);
}

const isTextEntry = (entry: VFSEntry, mimeType: string | undefined): boolean =>
  isTextMimeType(mimeType) || TEXT_EXTENSIONS.has(getExtension(entry.filename));

const fileMetadata = (path: string, entry: VFSEntry) => ({
  path,
  name: entry.filename,
  kind: 'file' as const,
  provider: entry.provider,
  size: entry.size ?? null,
  mimeType: entry.mimeType ?? guessMimeType(entry.filename) ?? null
});

export async function listVfsFiles(args: Record<string, unknown>, vfs?: ChatVfs) {
  const path = normalizePath(args.path);
  const entries = await getVfs(vfs).listChildren(path);

  return { path, entries, total: entries.length };
}

export async function searchVfsFiles(args: Record<string, unknown>, vfs?: ChatVfs) {
  const query = typeof args.query === 'string' ? args.query.trim() : '';
  const path = normalizePath(args.path);

  if (!query) return { path, query, entries: [], total: 0 };

  const entries = await getVfs(vfs).search(query, path);

  return { path, query, entries, total: entries.length };
}

export function statVfsFile(args: Record<string, unknown>, vfs?: ChatVfs) {
  const path = normalizePath(args.path);
  const filesystem = getVfs(vfs);
  const entry = filesystem.getEntryOrLinkedFile(path);

  if (!entry) return { error: `VFS path not found: ${path}` };
  if (filesystem.isFolder(path)) return { path, name: entry.filename, kind: 'directory' as const };

  return fileMetadata(path, entry);
}

export async function readVfsText(args: Record<string, unknown>, vfs?: ChatVfs) {
  const path = normalizePath(args.path);
  const filesystem = getVfs(vfs);
  const entry = filesystem.getEntryOrLinkedFile(path);

  if (!entry) return { error: `VFS path not found: ${path}` };
  if (filesystem.isFolder(path)) return { error: `VFS path is a directory: ${path}` };

  const metadata = fileMetadata(path, entry);

  if (!isTextEntry(entry, metadata.mimeType ?? undefined)) {
    return { error: `VFS file is not a supported text format: ${path}`, ...metadata };
  }

  const offset = Math.max(0, Math.floor(Number(args.offset) || 0));
  const requestedLength = Math.floor(Number(args.length) || DEFAULT_READ_LENGTH);
  const length = Math.min(Math.max(requestedLength, 1), MAX_VFS_TEXT_READ_LENGTH);
  const file = await filesystem.resolve(path);
  const mimeType = file.type || metadata.mimeType || undefined;

  if (!isTextEntry(entry, mimeType)) {
    return { error: `VFS file is not a supported text format: ${path}`, ...metadata, mimeType };
  }

  const end = Math.min(offset + length, file.size);
  const content = await file.slice(offset, end).text();

  return {
    ...metadata,
    size: file.size,
    mimeType: mimeType || null,
    offset,
    bytesRead: end - offset,
    truncated: end < file.size,
    content
  };
}
