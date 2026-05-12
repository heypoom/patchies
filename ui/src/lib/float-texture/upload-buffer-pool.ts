export class FloatTextureUploadBufferPool {
  private available = new Map<number, ArrayBuffer[]>();

  constructor(private options: { maxBuffersPerByteLength?: number } = {}) {}

  acquire(source: Float32Array): Float32Array {
    const byteLength = source.byteLength;
    const buffers = this.available.get(byteLength);
    const buffer = buffers?.pop() ?? new ArrayBuffer(byteLength);
    const target = new Float32Array(buffer);

    target.set(source);

    return target;
  }

  release(buffer: ArrayBufferLike): void {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength === 0) return;

    const buffers = this.available.get(buffer.byteLength) ?? [];
    const maxBuffers = this.options.maxBuffersPerByteLength ?? 3;

    if (buffers.length >= maxBuffers) return;

    buffers.push(buffer);
    this.available.set(buffer.byteLength, buffers);
  }
}
