import { match } from 'ts-pattern';
import {
  getObjectCodeFiles,
  type CodeObject,
  type ObjectCodeFile
} from '$lib/objects/object-code-files';
import { VfsEntryIndex } from './VfsEntryIndex';
import { VfsDirectoryReader } from './VfsDirectoryReader';

export const isObjectPath = (path: string) => path.startsWith('obj://');

export const assertMutableVfsPath = (path: string) => {
  if (isObjectPath(path)) throw new Error('VFS: Objects only allows editing existing code');
};

const getObjectCodeMimeType = (language: ObjectCodeFile['language']) =>
  match(language)
    .with('javascript', () => 'application/javascript')
    .with('puredata', () => 'text/x-puredata')
    .otherwise(() => 'text/plain');

export interface ObjectFileWriteOptions {
  recordHistory?: boolean;
  previousContent?: string;
  previousValue?: unknown;
}

/** Live graph projection; contains no persisted files or editor ownership. */
export class ObjectFileProjection {
  readonly entries = new VfsEntryIndex();
  readonly reader = new VfsDirectoryReader(this.entries, () => undefined);

  private files = new Map<string, ObjectCodeFile>();
  private editOrigins = new Map<string, unknown>();
  private runtimeContents = new Map<string, { source: string; content: string }>();
  private revision = 0;
  private runSource?: (file: ObjectCodeFile) => void | Promise<void>;
  private writeSource?: (
    file: ObjectCodeFile,
    content: string,
    options?: ObjectFileWriteOptions
  ) => void;

  constructor(private changed: (path: string, revision: number) => void) {}

  connect(
    write: (file: ObjectCodeFile, content: string, options?: ObjectFileWriteOptions) => void,
    run?: (file: ObjectCodeFile) => void | Promise<void>
  ): () => void {
    this.writeSource = write;
    this.runSource = run;

    return () => {
      if (this.writeSource !== write) return;

      this.writeSource = undefined;
      this.runSource = undefined;
      this.sync([]);
    };
  }

  sync(objects: readonly CodeObject[]): void {
    const next = new Map<string, ObjectCodeFile>(
      objects.flatMap((object) =>
        getObjectCodeFiles(object).map((file) => {
          const path = `obj://${file.objectId}/${file.filename}`;
          const runtimeContent = this.runtimeContents.get(path);
          const content =
            file.runtimeSource !== undefined && runtimeContent?.source === file.runtimeSource
              ? runtimeContent.content
              : file.content;

          return [path, { ...file, content }] as const;
        })
      )
    );

    const paths = new Set([...this.files.keys(), ...next.keys()]);

    const changes = [...paths].filter(
      (path) => this.files.get(path)?.content !== next.get(path)?.content
    );

    if (changes.length === 0) {
      this.files = next;
      return;
    }

    const revisions = new Map(changes.map((path) => [path, ++this.revision]));
    const removedFolders = new Set<string>();

    for (const path of changes) {
      const file = next.get(path);

      if (!file) {
        const previous = this.files.get(path)!;
        removedFolders.add(`obj://${previous.objectId}`);
        this.editOrigins.delete(path);
        this.runtimeContents.delete(path);
        this.entries.delete(path);
        continue;
      }

      const folderPath = `obj://${file.objectId}`;
      if (!this.entries.has(folderPath)) {
        this.entries.set(folderPath, { provider: 'folder', filename: file.objectId });
      }

      this.entries.set(path, {
        provider: 'object',
        filename: file.filename,
        mimeType: getObjectCodeMimeType(file.language),
        size: new TextEncoder().encode(file.content).byteLength,
        revision: revisions.get(path)
      });
    }

    this.files = next;

    for (const folder of removedFolders) {
      if (!this.entries.hasDescendant(folder)) this.entries.delete(folder);
    }

    for (const [path, revision] of revisions) this.changed(path, revision);
  }

  setRuntimeContent(objectId: string, filename: string, source: string, content: string): void {
    const path = `obj://${objectId}/${filename}`;
    this.runtimeContents.set(path, { source, content });

    const file = this.files.get(path);
    if (!file || file.runtimeSource !== source || file.content === content) return;

    const nextFile = { ...file, content };
    const revision = ++this.revision;
    this.files.set(path, nextFile);
    this.entries.set(path, {
      provider: 'object',
      filename: nextFile.filename,
      mimeType: getObjectCodeMimeType(nextFile.language),
      size: new TextEncoder().encode(content).byteLength,
      revision
    });
    this.changed(path, revision);
  }

  get(path: string): ObjectCodeFile {
    const file = this.files.get(path);
    if (!file) throw new Error(`VFS: Object code file not found: ${path}`);

    return file;
  }

  async run(path: string): Promise<void> {
    const file = this.get(path);
    if (!this.runSource) throw new Error('VFS: Object execution is unavailable');

    await this.runSource(file);
  }

  write(path: string, content: string, options?: ObjectFileWriteOptions): void {
    const file = this.get(path);
    if (!this.writeSource) throw new Error('VFS: Object editor is unavailable');
    if (file.content === content && options?.previousContent === undefined) return;

    if (options?.recordHistory === false && !this.editOrigins.has(path)) {
      this.editOrigins.set(path, file.runtimeSource === undefined ? file.content : null);
    }

    const shouldCommit = options?.previousContent !== undefined;
    const nextOptions = shouldCommit
      ? {
          ...options,
          previousValue: this.editOrigins.has(path)
            ? this.editOrigins.get(path)
            : options.previousContent
        }
      : options;

    this.writeSource(file, content, nextOptions);
    if (shouldCommit) this.editOrigins.delete(path);
  }
}
