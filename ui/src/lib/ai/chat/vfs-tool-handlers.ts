import { VirtualFilesystem } from '$lib/vfs';
import { guessMimeType } from '$lib/vfs/path-utils';
import { isExternalUrl, normalizeUserVfsPath } from '$lib/vfs/user-api-paths';
import type { VFSEntry, VFSListPage, VFSSearchPage } from '$lib/vfs/types';

const DEFAULT_READ_LENGTH = 16 * 1024;
export const MAX_VFS_TEXT_READ_LENGTH = 32 * 1024;
const DEFAULT_VFS_PAGE_LIMIT = 50;
const MAX_VFS_PAGE_LIMIT = 100;

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
  listChildrenPage(path: string, options: { offset: number; limit: number }): Promise<VFSListPage>;
  searchPage(
    query: string,
    path: string,
    options: { offset: number; limit: number }
  ): Promise<VFSSearchPage>;
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

function getBoundedInteger(value: unknown, defaultValue: number): number {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? Math.max(0, Math.floor(numericValue)) : defaultValue;
}

function isUtf8ContinuationByte(byte: number | undefined): boolean {
  return byte !== undefined && (byte & 0b11000000) === 0b10000000;
}

async function readUtf8Range(file: File | Blob, offset: number, length: number) {
  const windowStart = Math.max(0, offset - 3);
  const requestedEnd = Math.min(offset + length, file.size);
  const windowEnd = Math.min(file.size, requestedEnd + 3);
  const bytes = new Uint8Array(await file.slice(windowStart, windowEnd).arrayBuffer());
  let start = offset - windowStart;
  let end = requestedEnd - windowStart;

  while (start > 0 && isUtf8ContinuationByte(bytes[start])) start--;
  while (end > start && isUtf8ContinuationByte(bytes[end])) end--;

  return {
    offset: windowStart + start,
    end: windowStart + end,
    content: new TextDecoder().decode(bytes.slice(start, end))
  };
}

export async function listVfsFiles(args: Record<string, unknown>, vfs?: ChatVfs) {
  const path = normalizePath(args.path);
  const offset = getBoundedInteger(args.offset, 0);
  const requestedLimit = getBoundedInteger(args.limit, DEFAULT_VFS_PAGE_LIMIT);
  const limit = Math.min(Math.max(requestedLimit, 1), MAX_VFS_PAGE_LIMIT);
  const page = await getVfs(vfs).listChildrenPage(path, { offset, limit });

  return { path, ...page };
}

export async function searchVfsFiles(args: Record<string, unknown>, vfs?: ChatVfs) {
  const query = typeof args.query === 'string' ? args.query.trim() : '';
  const path = normalizePath(args.path);
  const offset = getBoundedInteger(args.offset, 0);
  const requestedLimit = getBoundedInteger(args.limit, DEFAULT_VFS_PAGE_LIMIT);
  const limit = Math.min(Math.max(requestedLimit, 1), MAX_VFS_PAGE_LIMIT);

  if (!query) return { path, query, entries: [], offset, limit, truncated: false };

  const page = await getVfs(vfs).searchPage(query, path, { offset, limit });

  return { path, query, ...page };
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

  const requestedOffset = getBoundedInteger(args.offset, 0);
  const requestedLength = getBoundedInteger(args.length, DEFAULT_READ_LENGTH);
  const length = Math.min(Math.max(requestedLength, 1), MAX_VFS_TEXT_READ_LENGTH);
  const file = await filesystem.resolve(path);
  const mimeType = file.type || metadata.mimeType || undefined;

  if (!isTextEntry(entry, mimeType)) {
    return { error: `VFS file is not a supported text format: ${path}`, ...metadata, mimeType };
  }

  const offset = Math.min(requestedOffset, file.size);
  const range = await readUtf8Range(file, offset, length);

  return {
    ...metadata,
    size: file.size,
    mimeType: mimeType || null,
    offset: range.offset,
    bytesRead: range.end - range.offset,
    truncated: range.end < file.size,
    content: range.content
  };
}
