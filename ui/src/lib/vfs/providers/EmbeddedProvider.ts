import { isEmbeddedVFSEntry, type VFSEntry, type VFSProvider } from '../types';

/** Resolves text embedded in a patch without any external storage dependency. */
export class EmbeddedProvider implements VFSProvider {
  readonly type = 'embedded' as const;

  async resolve(entry: VFSEntry, _path: string): Promise<File | Blob> {
    if (!isEmbeddedVFSEntry(entry)) {
      throw new Error('EmbeddedProvider: Entry is not embedded');
    }

    return new File([entry.content], entry.filename, {
      type: entry.mimeType || 'text/plain;charset=utf-8'
    });
  }
}
