# 69. Buffer Bridge Service

**Status**: Draft
**Created**: 2026-02-16

## Problem

Patchies needs shared memory buffers for audio DSP — `tabwrite~` writes audio into a named buffer, `tabread~` reads from it by index. These nodes run as AudioWorklet processors on the audio thread and need shared access to the same underlying data.

Additionally, the main thread needs read access for visualization (e.g. waveform display) and the system should work in Web Workers too (future).

`SharedArrayBuffer` enables zero-copy sharing between threads, but it requires cross-origin isolation headers and isn't universally available. We need a service that abstracts over SAB with a transparent fallback.

## Solution

A two-layer architecture:

1. **WorkletBufferRegistry** (worklet-side, `globalThis`) — stores named `Float32Array` buffers. All worklet processors share `AudioWorkletGlobalScope`, so they read/write directly with zero overhead.
2. **BufferBridgeService** (main-thread) — manages buffer lifecycle, feature detection, and cross-thread access. Uses SAB when available for zero-copy main-thread reads; falls back to snapshot copies via MessagePort.

A dedicated **BufferBridgeProcessor** (0 audio in/out) acts as the message conduit between the two layers.

```
Main Thread                         Audio Thread (AudioWorkletGlobalScope)
┌──────────────────────────┐        ┌───────────────────────────────────┐
│  BufferBridgeService     │        │  WorkletBufferRegistry            │
│   - createBuffer(name,n) │  port  │   globalThis.__bufferRegistry     │
│   - deleteBuffer(name)   │◄──────►│   Map<name, BufferEntry>          │
│   - readBuffer(name)     │        │                                   │
│   - listBuffers()        │  SAB?  │  BufferBridgeProcessor            │
│   - onBufferChange(cb)   │◄ ─ ─ ─│   (0 in, 0 out, message conduit) │
│                          │        │                                   │
│  SAB mode:               │        │  tabwrite~ processor              │
│   Float32Array over SAB  │        │   → registry.write(name, samples) │
│   (direct read, no copy) │        │                                   │
│                          │        │  tabread~ processor               │
│  Fallback mode:          │        │   → registry.read(name, index)    │
│   request snapshot copy  │        │                                   │
│   via port.postMessage   │        │  table processor                  │
│                          │        │   → registry.create/resize/clear  │
└──────────────────────────┘        └───────────────────────────────────┘
```

## Design Details

### 1. Cross-Origin Isolation

SharedArrayBuffer requires cross-origin isolation. We use `credentialless` (less restrictive than `require-corp`):

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

**Where to add headers:**

- **Cloudflare Pages**: `ui/static/_headers` file (copied to build output)
- **Vite dev server**: `server.headers` in `vite.config.ts`

```
# ui/static/_headers
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: credentialless
```

```ts
// vite.config.ts — add to defineConfig
server: {
  headers: {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'credentialless',
  },
},
```

**Iframe node**: Add `credentialless` attribute so third-party iframes load in an ephemeral context (no cookies/storage), satisfying COEP without requiring the embedded site to set COEP/CORS headers:

```html
<iframe credentialless src="..." sandbox="allow-scripts ..." />
```

### 2. Feature Detection

```ts
// src/lib/audio/buffer-bridge/feature-detect.ts

export function canUseSharedArrayBuffer(): boolean {
  // crossOriginIsolated is the definitive check —
  // true only when both COOP and COEP are correctly set
  if (typeof crossOriginIsolated !== 'undefined') {
    return crossOriginIsolated;
  }

  // Fallback: direct constructor check
  return typeof SharedArrayBuffer !== 'undefined';
}
```

### 3. WorkletBufferRegistry (Worklet-Side)

Lives in `globalThis.__bufferRegistry` (same pattern as `workletChannel`). All worklet processors access it directly — no message passing needed within the audio thread.

```ts
// src/lib/audio/buffer-bridge/worklet-buffer-registry.ts

interface BufferEntry {
  /** The underlying storage — SAB-backed or regular */
  data: Float32Array;
  /** Logical length (may be < data.length if pre-allocated) */
  length: number;
  /** Number of channels (default 1, interleaved) */
  channels: number;
  /** Circular write head position (for tabwrite~) */
  writeHead: number;
}

interface WorkletBufferRegistry {
  create(name: string, length: number, channels?: number, sab?: SharedArrayBuffer): void;
  delete(name: string): void;
  get(name: string): BufferEntry | undefined;
  has(name: string): boolean;

  /** Write a single sample at writeHead, advance head (circular) */
  writeSample(name: string, channel: number, value: number): void;

  /** Write a block of samples starting at writeHead */
  writeBlock(name: string, channel: number, samples: Float32Array): void;

  /** Read sample at absolute index (with wrapping) */
  readSample(name: string, channel: number, index: number): number;

  /** Read with 4-point cubic interpolation (for tabread4~) */
  readInterpolated(name: string, channel: number, index: number): number;

  /** Reset write head to 0 */
  resetHead(name: string): void;

  /** List all buffer names */
  list(): string[];
}
```

**Key behaviors:**

- `writeSample` / `writeBlock` advance `writeHead` circularly
- `readSample` uses modular indexing: `index % length`
- `readInterpolated` does 4-point Hermite interpolation for smooth `tabread4~`
- Same allocation-conscious pattern as `workletChannel` — pre-allocate, reuse
- No locks needed: all worklet processors run on the same thread sequentially

### 4. BufferBridgeProcessor (Message Conduit)

A minimal AudioWorkletProcessor with 0 audio I/O. Its only job is to relay buffer-management commands from the main thread to the `WorkletBufferRegistry`.

```ts
// src/lib/audio/buffer-bridge/buffer-bridge.processor.ts

import { workletBufferRegistry } from './worklet-buffer-registry';

class BufferBridgeProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.port.onmessage = (e) => this.handleMessage(e.data);
  }

  handleMessage(msg: { type: string; [key: string]: unknown }) {
    match(msg.type)
      .with('create', () => {
        const { name, length, channels, sab } = msg;
        workletBufferRegistry.create(name, length, channels, sab);
      })
      .with('delete', () => {
        workletBufferRegistry.delete(msg.name);
      })
      .with('resize', () => {
        // Delete and recreate with new size (preserving data up to min length)
        const entry = workletBufferRegistry.get(msg.name);
        if (!entry) return;
        const oldData = new Float32Array(entry.data); // snapshot
        workletBufferRegistry.delete(msg.name);
        workletBufferRegistry.create(msg.name, msg.length, entry.channels, msg.sab);
        const newEntry = workletBufferRegistry.get(msg.name);
        if (newEntry) newEntry.data.set(oldData.subarray(0, Math.min(oldData.length, msg.length)));
      })
      .with('clear', () => {
        const entry = workletBufferRegistry.get(msg.name);
        if (entry) { entry.data.fill(0); entry.writeHead = 0; }
      })
      .with('set', () => {
        // Set individual sample: { name, index, value }
        const entry = workletBufferRegistry.get(msg.name);
        if (entry) entry.data[msg.index % entry.length] = msg.value;
      })
      .with('get-snapshot', () => {
        // Fallback mode: copy buffer data and send back
        const entry = workletBufferRegistry.get(msg.name);
        if (!entry) { this.port.postMessage({ type: 'snapshot', name: msg.name, data: null }); return; }
        const copy = new Float32Array(entry.data);
        this.port.postMessage(
          { type: 'snapshot', name: msg.name, data: copy, length: entry.length },
          [copy.buffer] // Transfer for zero-copy send
        );
      })
      .with('list', () => {
        this.port.postMessage({ type: 'buffer-list', names: workletBufferRegistry.list() });
      });
  }

  process() {
    return true; // Keep alive (no audio processing)
  }
}

registerProcessor('buffer-bridge', BufferBridgeProcessor);
```

### 5. BufferBridgeService (Main Thread)

Singleton that manages the lifecycle and provides the main-thread API.

```ts
// src/lib/audio/buffer-bridge/BufferBridgeService.ts

export class BufferBridgeService {
  private static instance: BufferBridgeService | null = null;
  private bridgeNode: AudioWorkletNode | null = null;
  private useSAB: boolean;

  /** SAB mode: direct Float32Array views keyed by buffer name */
  private bufferViews = new Map<string, { sab: SharedArrayBuffer; view: Float32Array }>();

  /** Pending snapshot requests (fallback mode) */
  private snapshotCallbacks = new Map<string, (data: Float32Array | null) => void>();

  /** Event listeners for buffer changes */
  private changeListeners = new Set<(name: string, event: 'create' | 'delete' | 'resize') => void>();

  private constructor() {
    this.useSAB = canUseSharedArrayBuffer();
  }

  static getInstance(): BufferBridgeService { ... }

  /** Initialize the bridge processor on the AudioContext */
  async init(audioContext: AudioContext): Promise<void> {
    await audioContext.audioWorklet.addModule(bridgeProcessorUrl);
    this.bridgeNode = new AudioWorkletNode(audioContext, 'buffer-bridge', {
      numberOfInputs: 0,
      numberOfOutputs: 0,
    });
    this.bridgeNode.port.onmessage = (e) => this.handleWorkletMessage(e.data);
  }

  /** Create a named buffer */
  createBuffer(name: string, length: number, channels = 1): void {
    if (this.useSAB) {
      const sab = new SharedArrayBuffer(length * channels * Float32Array.BYTES_PER_ELEMENT);
      const view = new Float32Array(sab);
      this.bufferViews.set(name, { sab, view });
      this.bridgeNode!.port.postMessage({ type: 'create', name, length, channels, sab });
    } else {
      this.bridgeNode!.port.postMessage({ type: 'create', name, length, channels });
    }
    this.notifyChange(name, 'create');
  }

  /** Delete a named buffer */
  deleteBuffer(name: string): void {
    this.bufferViews.delete(name);
    this.bridgeNode!.port.postMessage({ type: 'delete', name });
    this.notifyChange(name, 'delete');
  }

  /**
   * Read buffer data from the main thread.
   *
   * SAB mode: returns the live Float32Array view (zero-copy, real-time).
   * Fallback mode: requests a snapshot copy from the worklet (async).
   */
  readBuffer(name: string): Float32Array | null {
    if (this.useSAB) {
      return this.bufferViews.get(name)?.view ?? null;
    }
    return null; // Use readBufferAsync in fallback mode
  }

  /** Async read — works in both modes */
  readBufferAsync(name: string): Promise<Float32Array | null> {
    if (this.useSAB) {
      return Promise.resolve(this.readBuffer(name));
    }
    return new Promise((resolve) => {
      this.snapshotCallbacks.set(name, resolve);
      this.bridgeNode!.port.postMessage({ type: 'get-snapshot', name });
    });
  }

  /** Subscribe to buffer lifecycle changes */
  onBufferChange(cb: (name: string, event: 'create' | 'delete' | 'resize') => void): () => void {
    this.changeListeners.add(cb);
    return () => this.changeListeners.delete(cb);
  }

  /** Whether SAB is available */
  get isSharedMemory(): boolean { return this.useSAB; }

  destroy(): void {
    this.bridgeNode?.port.postMessage({ type: 'stop' });
    this.bridgeNode?.disconnect();
    this.bridgeNode = null;
    this.bufferViews.clear();
  }
}
```

### 6. Thread Safety

**Within the audio thread**: All worklet processors execute sequentially on the same thread (the audio rendering thread). No concurrent access — no locks needed. This is the same guarantee that makes `workletChannel` safe.

**Main thread ↔ audio thread (SAB mode)**: The main thread reads while the audio thread writes. This can cause _tearing_ — a read might see a partially-written block. For audio visualization this is acceptable (identical to Pure Data's behavior). For cases requiring consistency, use `Atomics.load` / `Atomics.store` on a shared status flag, but this is unnecessary for `tabwrite~` / `tabread~`.

**Main thread ↔ audio thread (fallback mode)**: Snapshot copies are always consistent — the worklet copies the buffer atomically (single-threaded) before transferring.

### 7. Consumer Nodes

#### `table` (Text Object)

Creates and owns a named buffer. First argument is the name, second is the size.

```
table mybuf 1024
```

- On create: calls `workletBufferRegistry.create('mybuf', 1024)`
- On destroy: calls `workletBufferRegistry.delete('mybuf')`
- Message inlet: `set <idx> <val>`, `get <idx>`, `resize <n>`, `clear`, `normalize`
- Outlet: responds to `get` with the value

The `table` object also sends a `create-buffer` message through the BufferBridgeProcessor so the main-thread service is aware of the buffer (for visualization, etc.).

#### `tabwrite~` (Native DSP Node)

Writes audio signal into a named buffer continuously (circular).

```
tabwrite~ mybuf
```

- Audio inlet 0: signal to write
- Message inlet 1: `bang` resets write head, `stop` / `start` toggle writing
- In `process()`: writes 128 samples per block into `workletBufferRegistry.writeBlock()`

#### `tabread~` (Native DSP Node)

Reads from a named buffer using an index signal.

```
tabread~ mybuf
```

- Audio inlet 0: index signal (0 to buffer-length)
- Audio outlet 0: output signal
- In `process()`: for each sample, reads `workletBufferRegistry.readSample(name, ch, index)`

#### `tabread4~` (Native DSP Node)

Same as `tabread~` but with 4-point interpolation for smooth playback:

```
tabread4~ mybuf
```

- Uses `workletBufferRegistry.readInterpolated()` for Hermite interpolation

### 8. Integration with AudioService

`BufferBridgeService.init()` is called alongside AudioContext creation in `AudioService`:

```ts
// In AudioService.createContext() or similar
const bufferBridge = BufferBridgeService.getInstance();
await bufferBridge.init(this.audioContext);
```

The bridge processor stays alive for the lifetime of the AudioContext.

### 9. Web Worker Support (Future)

The same pattern extends to Web Workers:

- **SAB mode**: Main thread creates SAB, sends to worker via `postMessage` (SAB is shareable). Worker creates `Float32Array` view over the same memory.
- **Fallback mode**: Use `MessagePort` with transferables (same as worklet fallback).

Workers would get their own `WorkerBufferBridge` class that wraps a `MessagePort`. Not in scope for initial implementation.

## File Plan

```
ui/src/lib/audio/buffer-bridge/
├── feature-detect.ts              # canUseSharedArrayBuffer()
├── worklet-buffer-registry.ts     # WorkletBufferRegistry (worklet-side, globalThis)
├── buffer-bridge.processor.ts     # BufferBridgeProcessor (message conduit)
├── BufferBridgeService.ts         # Main-thread singleton
└── index.ts                       # Re-exports

ui/src/lib/audio/native-dsp/processors/
├── tabwrite.processor.ts          # tabwrite~ processor
├── tabread.processor.ts           # tabread~ processor
└── tabread4.processor.ts          # tabread4~ processor

ui/src/lib/audio/native-dsp/nodes/
├── tabwrite.node.ts               # tabwrite~ node definition
├── tabread.node.ts                # tabread~ node definition
└── tabread4.node.ts               # tabread4~ node definition

ui/src/lib/objects/v2/nodes/
└── TableObject.ts                 # table text object

ui/static/_headers                 # Cloudflare Pages COOP/COEP headers
ui/static/content/objects/
├── table.md                       # table docs
├── tabwrite~.md                   # tabwrite~ docs
├── tabread~.md                    # tabread~ docs
└── tabread4~.md                   # tabread4~ docs
```

## Changes to Existing Files

- `ui/vite.config.ts` — add `server.headers` for dev COOP/COEP
- `ui/src/lib/components/nodes/IframeNode.svelte` — add `credentialless` attribute to `<iframe>`
- `ui/src/lib/audio/v2/AudioService.ts` — init `BufferBridgeService` on context creation
- `ui/src/lib/audio/v2/nodes/index.ts` — register tabwrite~/tabread~/tabread4~ nodes
- `ui/src/lib/objects/v2/nodes/index.ts` — register table text object
- `ui/src/lib/extensions/object-packs.ts` — add to Audio pack

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| COEP breaks third-party resources (CDN scripts, images) | Use `credentialless` (not `require-corp`) — allows no-cors loads without credentials |
| COEP breaks iframe embeds | Add `credentialless` attribute on `<iframe>` — loads in ephemeral context |
| SAB not available (old browsers, missing headers) | Transparent fallback to snapshot copies; worklet-to-worklet access always works |
| Bridge processor garbage collected | Keep `AudioWorkletNode` reference alive in `BufferBridgeService` |
| Buffer name collisions between patches | Buffers are scoped to the AudioContext (one per patch) |
| Tearing on main-thread reads (SAB mode) | Acceptable for audio visualization; document this trade-off |
