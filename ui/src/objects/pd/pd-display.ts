import type { PdNodeData, PdRuntimeStatus } from './PdAudioNode';

const filenameFromSource = (source: string): string => {
  const path = source.split(/[?#]/, 1)[0];

  return path.split('/').at(-1) ?? '';
};

export function getPdDisplayFilename(data: PdNodeData, status: PdRuntimeStatus): string {
  const persistedSource = data.sourceUrl || data.vfsPath || '';
  const runtimeSource = status.state === 'idle' ? '' : status.path;
  const runtimeIsInline = runtimeSource === 'inline Pd code';
  const externalFilename = filenameFromSource(
    persistedSource || (runtimeIsInline ? '' : runtimeSource)
  );

  if (data.sourceCode != null) {
    return externalFilename || 'Inline patch';
  }

  if (runtimeIsInline) return 'Inline patch';

  return externalFilename || 'Choose a patch';
}
