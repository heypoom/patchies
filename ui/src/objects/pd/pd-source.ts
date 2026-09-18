import type { PdNodeData } from './PdAudioNode';

export type PdEditorMode = 'inline' | 'patch' | 'readonly';

export const getPdMountedSource = (data: PdNodeData): string =>
  data.sourceUrl || data.vfsPath || '';

export function getPdEditorMode(data: PdNodeData): PdEditorMode {
  // edit the persisted object's code
  if (data.sourceCode !== null && data.sourceCode !== undefined) return 'inline';

  // update a file in the "patch" VFS namespace
  if (data.vfsPath?.startsWith('patch://')) return 'patch';

  // read-only view of a file, usually for the "user" VFS namespace
  if (getPdMountedSource(data)) return 'readonly';

  return 'inline';
}

export const getDetachedPdData = (sourceCode: string) => ({
  vfsPath: '',
  sourceUrl: '',
  sourceCode,
  hasConfiguredPorts: false
});
