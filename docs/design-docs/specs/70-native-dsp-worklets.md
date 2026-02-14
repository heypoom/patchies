# 70. Native DSP Worklets

## Motivation

Currently, sample-level DSP objects (like `line~`) are implemented as user code running inside the generic `dsp~` processor. This works but has DX gaps compared to text objects:

1. **No help docs** — no schema-driven inlet descriptions, no hover tooltips, no markdown docs
2. **No visible parameters** — users see a code editor, not labeled inlets with defaults
3. **Opaque UX** — looks like "a box with code" rather than a purpose-built tool

Native DSP worklets give built-in objects the same discoverability as text objects (schemas, docs, visual params) while running sample-level code in an AudioWorklet.

## Design

Two layers:

1. **Worklet side** — `defineDSP()` helper that eliminates AudioWorkletProcessor boilerplate
2. **Main thread side** — `createWorkletDspNode()` factory that generates an AudioNodeV2 class with full schema metadata

### Worklet Side: `defineDSP()`

Lives in the worklet module file. Handles the processor class, message protocol, state management, and `registerProcessor` call.

```typescript
// src/lib/audio/native-dsp/processors/line.processor.ts
import { defineDSP } from '../define-dsp';

defineDSP({
  name: 'line~',
  audioOutlets: 1,

  state: () => ({
    currentValue: 0,
    targetValue: 0,
    stepSize: 0,
    samplesRemaining: 0,
    queuedRampTime: 0,
  }),

  recv(state, data, inlet) {
    if (inlet === 1) {
      const time = parseFloat(data);
      if (!isNaN(time)) state.queuedRampTime = Math.max(0, time);
      return;
    }

    if (data === 'stop') {
      state.samplesRemaining = 0;
      state.targetValue = state.currentValue;
      state.stepSize = 0;
      return;
    }

    let target = 0;
    let time = state.queuedRampTime;

    if (Array.isArray(data)) {
      target = parseFloat(data[0]);
      if (data.length > 1) time = parseFloat(data[1]);
    } else {
      target = parseFloat(data);
    }

    if (isNaN(target)) return;
    state.targetValue = target;

    if (time <= 0) {
      state.currentValue = state.targetValue;
      state.samplesRemaining = 0;
      state.stepSize = 0;
    } else {
      const totalSamples = (time / 1000) * sampleRate;
      state.samplesRemaining = Math.max(1, Math.round(totalSamples));
      state.stepSize = (state.targetValue - state.currentValue) / state.samplesRemaining;
    }

    state.queuedRampTime = 0;
  },

  process(state, inputs, outputs) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;

    for (let i = 0; i < len; i++) {
      if (state.samplesRemaining > 0) {
        state.currentValue += state.stepSize;
        if (--state.samplesRemaining <= 0) {
          state.currentValue = state.targetValue;
          state.stepSize = 0;
        }
      }
      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = state.currentValue;
      }
    }
  },
});
```

#### `defineDSP` Options

```typescript
type SendFn = (message: unknown, outlet?: number) => void;

interface DefineDSPOptions<S> {
  /** Node type — used as processor name (e.g. 'line~' → registerProcessor('line~', ...)) */
  name: string;

  /** Number of audio input ports (default: 0) */
  audioInlets?: number;

  /** Number of audio output ports (default: 1) */
  audioOutlets?: number;

  /** Factory function that creates initial state. Called once per processor instance. */
  state: () => S;

  /**
   * Handle incoming messages from message inlets.
   * Called outside the process() loop (on the audio thread, but not in the hot path).
   *
   * @param send - Send a message to a message outlet (forwarded to main thread → MessageSystem)
   */
  recv?: (state: S, data: unknown, inlet: number, send: SendFn) => void;

  /**
   * Process one audio block (128 samples).
   * This is the hot path — runs ~344 times/sec.
   *
   * @param send - Send a message to a message outlet (use sparingly in process — throttle if needed)
   *
   * inputs/outputs are pre-normalized (missing channels get silent buffers).
   */
  process: (state: S, inputs: Float32Array[][], outputs: Float32Array[][], send: SendFn) => void;
}
```

#### What `defineDSP` generates

```typescript
function defineDSP<S>(options: DefineDSPOptions<S>): void {
  class NativeDSPProcessor extends AudioWorkletProcessor {
    private state: S;
    private shouldStop = false;

    // Pre-allocated normalized buffers (same optimization as dsp-processor)
    private silentBuffer: Float32Array | null = null;
    private normalizedInputs: Float32Array[][] = [];
    private normalizedInletCount = 0;
    private normalizedChannelCount = 0;

    // Bound send function (forwards messages to main thread)
    private send: SendFn = (message, outlet = 0) => {
      this.port.postMessage({ type: 'send-message', message, outlet });
    };

    constructor() {
      super();
      this.state = options.state();

      this.port.onmessage = (event) => {
        if (event.data.type === 'message-inlet' && options.recv) {
          options.recv(this.state, event.data.message, event.data.inlet, this.send);
        } else if (event.data.type === 'stop') {
          this.shouldStop = true;
        }
      };
    }

    process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
      if (this.shouldStop) return false;

      const normalized = this.normalizeInputs(inputs, outputs);
      options.process(this.state, normalized, outputs, this.send);

      return true;
    }

    // Same pre-allocated normalizeInputs as dsp-processor (zero allocation in steady state)
    private normalizeInputs(inputs: Float32Array[][], outputs: Float32Array[][]): Float32Array[][] {
      // ... (identical to dsp-processor.ts optimization)
    }
  }

  registerProcessor(options.name, NativeDSPProcessor);
}
```

Key differences from `dsp-processor.ts`:
- **No `new Function()` compilation** — process/recv are statically compiled
- **No `$1`-`$9` variable assignments** — not needed
- **No try/catch in hot path** — errors caught during development, not at runtime
- **No console forwarding** — not user-editable code
- **No dynamic port count changes** — fixed at definition time
- **Same `normalizeInputs` optimization** — pre-allocated, zero allocation

### Main Thread Side: `createWorkletDspNode()`

Factory that generates an AudioNodeV2 class from a config. Handles worklet loading, message forwarding, and schema metadata.

```typescript
// src/lib/audio/native-dsp/nodes/line.node.ts
import { Type } from '@sinclair/typebox';
import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/line.processor?worker&url';

export const LineNode = createWorkletDspNode({
  type: 'line~',
  group: 'processors',
  description: 'Signal ramp generator (like Pd line~)',

  workletUrl,

  audioInlets: 0,
  audioOutlets: 1,

  inlets: [
    {
      name: 'target',
      type: 'message',
      description: 'Target value (or [value, time] pair)',
      hot: true,
      messages: [
        { schema: Type.Number(), description: 'Jump to value immediately' },
        {
          schema: Type.Tuple([Type.Number(), Type.Number()]),
          description: 'Ramp to [target, time_ms]'
        },
        { schema: Type.Literal('stop'), description: 'Stop current ramp' },
      ],
    },
    {
      name: 'time',
      type: 'float',
      description: 'Ramp time in ms (used by next target)',
      defaultValue: 0,
      minNumber: 0,
      precision: 0,
      messages: [
        { schema: Type.Number(), description: 'Ramp duration in milliseconds' },
      ],
    },
  ],

  outlets: [
    { name: 'out', type: 'signal', description: 'Ramped signal output' },
  ],
});
```

#### What `createWorkletDspNode` returns

An `AudioNodeClass` (constructor + static metadata) that:

1. **Loads the worklet module** via `ensureModule()` (same pattern as `DspNode`)
2. **Creates `AudioWorkletNode`** with correct `numberOfInputs` / `numberOfOutputs`
3. **Forwards messages** — `send(key, message)` maps inlet names to inlet indices, posts to worklet port
4. **Exposes schemas** — static `inlets`, `outlets`, `description`, `tags` for UI/docs/autocomplete

```typescript
function createWorkletDspNode(config: WorkletDspNodeConfig): AudioNodeClass {
  return class implements AudioNodeV2 {
    static type = config.type;
    static group = config.group;
    static description = config.description;
    static tags = config.tags;
    static inlets = config.inlets;
    static outlets = config.outlets;

    // Shared across all instances of this node type
    private static moduleReady = false;
    private static modulePromise: Promise<void> | null = null;

    readonly nodeId: string;
    audioNode: AudioWorkletNode | null = null;

    constructor(nodeId: string, private audioContext: AudioContext) {
      this.nodeId = nodeId;
    }

    async create(params: unknown[]): Promise<void> {
      await ensureModule(config, this.audioContext);

      this.audioNode = new AudioWorkletNode(this.audioContext, config.type, {
        numberOfInputs: config.audioInlets ?? 0,
        numberOfOutputs: config.audioOutlets ?? 1,
        // outputChannelCount derived from config if needed
      });
    }

    send(key: string, message: unknown): void {
      const inletIndex = config.inlets.findIndex(i => i.name === key);
      if (inletIndex === -1) return;

      this.audioNode?.port.postMessage({
        type: 'message-inlet',
        message,
        inlet: inletIndex,
      });
    }

    destroy(): void {
      this.audioNode?.port.postMessage({ type: 'stop' });
      this.audioNode?.disconnect();
      this.audioNode = null;
    }
  } as unknown as AudioNodeClass;
}
```

### Message Protocol

Reuses a subset of the existing `dsp-processor` protocol:

```typescript
// Main thread → Worklet
type NativeDspMessage =
  | { type: 'message-inlet'; message: unknown; inlet: number }
  | { type: 'stop' };

// Worklet → Main thread
type NativeDspResponse =
  | { type: 'send-message'; message: unknown; outlet: number };
```

Much simpler than `dsp-processor`'s protocol — no `set-code`, no `sync-audio-ports`, no `set-inlet-values`, no `console-output`, no `code-error`.

On the main thread, `createWorkletDspNode` listens for `send-message` responses and forwards them through the MessageSystem (same pattern as `dsp-processor`'s `send-message` handling in `DSPNode.svelte`).

### File Structure

```
src/lib/audio/native-dsp/
  define-dsp.ts                    # defineDSP() — worklet-side helper
  create-worklet-dsp-node.ts       # createWorkletDspNode() — main-thread factory
  processors/
    line.processor.ts              # line~ worklet (uses defineDSP)
    noise.processor.ts             # noise~ worklet
    phasor.processor.ts            # phasor~ worklet
    snapshot.processor.ts          # snapshot~ worklet
    bang.processor.ts              # bang~ worklet
  nodes/
    line.node.ts                   # line~ AudioNodeV2 (uses createWorkletDspNode)
    noise.node.ts                  # noise~ AudioNodeV2
    phasor.node.ts                 # phasor~ AudioNodeV2
    snapshot.node.ts               # snapshot~ AudioNodeV2
    bang.node.ts                   # bang~ AudioNodeV2
```

Each node = 2 files:
- **`*.processor.ts`** — worklet-side `defineDSP()` call (~20-60 lines of pure DSP logic)
- **`*.node.ts`** — main-thread `createWorkletDspNode()` call (~20-40 lines of schema config)

Each worklet is its own module (one `?worker&url` import per node). Follows the existing `dsp~`/`expr~` pattern — lazy loaded, only registered when the node type is first used.

### Registration

Same as existing V2 audio nodes:

```typescript
// src/lib/audio/v2/nodes/index.ts
import { LineNode } from '$lib/audio/native-dsp/nodes/line.node';

const AUDIO_NODES = [
  // ... existing nodes
  LineNode,
];
```

```typescript
// src/lib/objects/schemas/index.ts
import { LineNode } from '$lib/audio/native-dsp/nodes/line.node';

schemasFromNodes([/* ... */, LineNode], 'audio');
```

```markdown
<!-- static/content/objects/line~.md -->
Signal ramp generator. Attempt to reach a target value over time...
```

## Decisions

- **One worklet module per node** — lazy loaded via `?worker&url`, follows existing `dsp~`/`expr~` pattern
- **`defineDSP` supports `send()`** — needed for `snapshot~`, `bang~`, and future analysis nodes
- **All inlet data via `message-inlet`** — no separate `set-inlet-values`. Unified path like text objects
- **Rename conflicting dsp~ presets** — if a native node shares a name with a dsp~ preset, rename the preset to avoid conflict

## First Batch

| Node | Type | Audio In | Audio Out | Message Out | Notes |
|------|------|----------|-----------|-------------|-------|
| `line~` | processor | 0 | 1 | no | Signal ramp generator |
| `noise~` | source | 0 | 1 | no | White noise generator |
| `phasor~` | source | 0 | 1 | no | Raw sawtooth/ramp oscillator |
| `snapshot~` | processor | 1 | 0 | yes | Sample audio signal → message (uses `send()`) |
| `bang~` | processor | 1 | 0 | yes | Emit bang on each audio block (uses `send()`) |

## Implementation Order

1. **Infrastructure** — `define-dsp.ts` + `create-worklet-dsp-node.ts`
2. **`line~`** — simplest case (no audio in, no send, just recv + process)
3. **`noise~`** — even simpler (no recv, just process)
4. **`phasor~`** — source with recv (frequency control)
5. **`snapshot~`** — first node using `send()` from process
6. **`bang~`** — similar to snapshot but emits on every block
