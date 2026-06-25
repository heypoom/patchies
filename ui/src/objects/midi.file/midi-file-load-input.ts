import { isVFSPath } from '$lib/vfs/types';

export type MidiFileLoadInput =
  | { type: 'url'; url: string }
  | { type: 'vfsPath'; vfsPath: string }
  | { type: 'bytes'; fileName: string; bytes: Uint8Array };

type NumericArrayBufferView = ArrayBufferView & ArrayLike<number>;

export function parseMidiFileLoadInput(
  value: unknown,
  fileName = 'midi file'
): MidiFileLoadInput | null {
  if (typeof value === 'string') {
    if (isHttpUrl(value)) return { type: 'url', url: value };
    if (isVFSPath(value)) return { type: 'vfsPath', vfsPath: value };
    return null;
  }

  if (value instanceof ArrayBuffer) {
    return { type: 'bytes', fileName, bytes: new Uint8Array(value) };
  }

  if (value instanceof Uint8Array) {
    return { type: 'bytes', fileName, bytes: value };
  }

  if (ArrayBuffer.isView(value)) {
    if ('length' in value && typeof value.length === 'number') {
      const numericView = value as unknown as NumericArrayBufferView;
      return {
        type: 'bytes',
        fileName,
        bytes: new Uint8Array(Array.from(numericView))
      };
    }

    return {
      type: 'bytes',
      fileName,
      bytes: new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    };
  }

  if (Array.isArray(value)) {
    return { type: 'bytes', fileName, bytes: new Uint8Array(value as ArrayLike<number>) };
  }

  return null;
}

function isHttpUrl(value: string): boolean {
  return value.startsWith('https://') || value.startsWith('http://');
}
