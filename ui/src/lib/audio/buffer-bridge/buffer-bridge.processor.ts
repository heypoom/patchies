/**
 * BufferBridgeProcessor — message conduit between main thread and WorkletBufferRegistry.
 *
 * Has 0 audio inputs and 0 audio outputs. Its only job is to relay
 * buffer management commands from the main thread to the shared registry.
 */

import { workletBufferRegistry } from './worklet-buffer-registry';

interface BridgeMessage {
  type: string;
  name?: string;
  length?: number;
  channels?: number;
  sab?: SharedArrayBuffer;
  index?: number;
  value?: number;
}

class BufferBridgeProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<BridgeMessage>) => this.handleMessage(e.data);
  }

  private handleMessage(msg: BridgeMessage): void {
    const { type, name } = msg;
    if (!name && type !== 'list') return;

    if (type === 'create') {
      workletBufferRegistry.create(name!, msg.length ?? 512, msg.channels ?? 1, msg.sab);
    } else if (type === 'delete') {
      workletBufferRegistry.delete(name!);
    } else if (type === 'resize') {
      const entry = workletBufferRegistry.get(name!);
      if (!entry) return;

      const newLength = msg.length ?? entry.length;
      const oldData = new Float32Array(entry.data);
      const oldLength = entry.length;

      workletBufferRegistry.delete(name!);
      workletBufferRegistry.create(name!, newLength, entry.channels, msg.sab);

      const newEntry = workletBufferRegistry.get(name!);
      if (newEntry) {
        const copyLen = Math.min(oldLength * entry.channels, newLength * newEntry.channels);
        newEntry.data.set(oldData.subarray(0, copyLen));
      }
    } else if (type === 'clear') {
      const entry = workletBufferRegistry.get(name!);
      if (entry) {
        entry.data.fill(0);
        entry.writeHead = 0;
      }
    } else if (type === 'set') {
      const entry = workletBufferRegistry.get(name!);
      if (entry && msg.index !== undefined && msg.value !== undefined) {
        const idx = ((msg.index % entry.length) + entry.length) % entry.length;
        entry.data[idx] = msg.value;
      }
    } else if (type === 'get-snapshot') {
      const entry = workletBufferRegistry.get(name!);
      if (!entry) {
        this.port.postMessage({ type: 'snapshot', name, data: null });
        return;
      }

      const copy = new Float32Array(entry.data);
      this.port.postMessage(
        { type: 'snapshot', name, data: copy, length: entry.length, channels: entry.channels },
        [copy.buffer]
      );
    } else if (type === 'list') {
      this.port.postMessage({ type: 'buffer-list', names: workletBufferRegistry.list() });
    }
  }

  process(): boolean {
    return true; // Keep alive
  }
}

registerProcessor('buffer-bridge', BufferBridgeProcessor);
