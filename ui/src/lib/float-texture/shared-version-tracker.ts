import {
  isFloatTextureSharedSource,
  isFloatTextureSquareSource,
  isFloatTextureWrappedSource,
  type FloatTextureSharedSource
} from './pack-float-texture';

export class FloatTextureSharedVersionTracker {
  private versions = new WeakMap<SharedArrayBuffer, number>();

  shouldUpload(source: unknown): boolean {
    if (isFloatTextureSharedSource(source)) {
      return this.shouldUploadSharedSource(source);
    }

    const buffers = getSharedChannelBuffers(source);
    const version = getSourceVersion(source);

    if (buffers.length === 0 || version === undefined) return true;

    return this.shouldUploadSharedBuffers(buffers, version);
  }

  private shouldUploadSharedSource(source: FloatTextureSharedSource): boolean {
    return this.shouldUploadSharedBuffers([source.buffer], source.version);
  }

  private shouldUploadSharedBuffers(buffers: SharedArrayBuffer[], version: number): boolean {
    const allBuffersAlreadyUploaded = buffers.every(
      (buffer) => this.versions.get(buffer) === version
    );

    if (allBuffersAlreadyUploaded) return false;

    for (const buffer of buffers) {
      this.versions.set(buffer, version);
    }

    return true;
  }
}

const isSharedArrayBuffer = (value: unknown): value is SharedArrayBuffer =>
  typeof SharedArrayBuffer !== 'undefined' && value instanceof SharedArrayBuffer;

function getSourceVersion(source: unknown): number | undefined {
  if (!source || typeof source !== 'object') return undefined;

  const version = (source as { version?: unknown }).version;

  return typeof version === 'number' ? version : undefined;
}

function getSharedChannelBuffers(source: unknown): SharedArrayBuffer[] {
  if (!isFloatTextureWrappedSource(source) && !isFloatTextureSquareSource(source)) return [];

  const channels = Array.isArray(source.channels) ? source.channels : [source.channels];

  return channels.filter(isSharedArrayBuffer);
}
