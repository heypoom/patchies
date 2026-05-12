import { isFloatTextureSharedSource, type FloatTextureSharedSource } from './pack-float-texture';

export class FloatTextureSharedVersionTracker {
  private versions = new WeakMap<SharedArrayBuffer, number>();

  shouldUpload(source: unknown): boolean {
    if (!isFloatTextureSharedSource(source)) return true;

    return this.shouldUploadSharedSource(source);
  }

  private shouldUploadSharedSource(source: FloatTextureSharedSource): boolean {
    const previousVersion = this.versions.get(source.buffer);

    if (previousVersion === source.version) return false;

    this.versions.set(source.buffer, source.version);

    return true;
  }
}
