import { VirtualFilesystem } from '$lib/vfs';

export type PdFileBundle = {
  files: Record<string, string>;
  entry: string;
  source: string;
};

export function loadPdCodeBundle(source: string, entry = 'inline.pd'): PdFileBundle {
  if (!source.trim()) throw new Error('Pd code cannot be empty.');

  return { files: { [entry]: source }, entry, source };
}

export async function loadPdUrlBundle(url: string): Promise<PdFileBundle> {
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('Pd URLs must use http or https.');
  }

  const response = await fetch(parsedUrl);
  if (!response.ok) throw new Error(`Unable to fetch Pd patch: ${response.status}.`);

  const source = await response.text();
  const filename = decodeURIComponent(parsedUrl.pathname.split('/').at(-1) || 'remote.pd');
  const entry = filename.toLowerCase().endsWith('.pd') ? filename : 'remote.pd';

  return loadPdCodeBundle(source, entry);
}

const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1);
function dirname(path: string): string {
  const namespaceEnd = path.indexOf('://') + 3;
  const separator = path.lastIndexOf('/');

  return separator < namespaceEnd ? path.slice(0, namespaceEnd) : path.slice(0, separator);
}

async function collectPdFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  const pending = [directory];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;

    for (const child of await VirtualFilesystem.getInstance().listChildren(current)) {
      if (child.kind === 'directory') {
        pending.push(child.path);
      } else if (child.path.toLowerCase().endsWith('.pd')) {
        files.push(child.path);
      }
    }
  }

  return files;
}

export async function loadPdFileBundle(vfsPath: string): Promise<PdFileBundle> {
  const path = vfsPath.trim();
  if (!path.toLowerCase().endsWith('.pd')) throw new Error('Choose a .pd patch file.');

  const directory = dirname(path);
  const entry = basename(path);
  const paths = await collectPdFiles(directory);
  if (!paths.includes(path)) paths.push(path);

  const files: Record<string, string> = {};
  for (const filePath of paths) {
    const relativePath = filePath.slice(directory.length + (directory.endsWith('/') ? 0 : 1));
    files[relativePath] = await (await VirtualFilesystem.getInstance().resolve(filePath)).text();
  }

  const source = files[entry];
  if (source === undefined) throw new Error(`Pd patch not found: ${path}`);

  return { files, entry, source };
}
