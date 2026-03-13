# 95. Performance Profiler

**Status**: Brainstorm / Draft
**Inspiration**: TouchDesigner cook-time profiler

---

## Overview

A per-object performance profiler that measures execution time and memory across all of Patchies' execution environments. Like TouchDesigner's cook-time panel, this surfaces which objects are slow, how much of the frame budget is consumed, and which thread is the bottleneck — all in real time.

---

## What Gets Measured

### 1. Main Thread — Text Objects (`ObjectService`)

- `onMessage()` handler execution time per object
- Parameter change processing time
- Clock callbacks (`clock.every`, `clock.onBeat`) per object

**Where to instrument**: `ObjectService.dispatchMessage()` wraps the `object.onMessage()` call. A thin wrapper records `performance.now()` before/after.

---

### 2. Main Thread — Message Routing (`MessageSystem`)

- `sendMessage()` total dispatch time (includes routing + all target callbacks)
- Per-edge latency (source → target delivery time)
- Messages-per-second per node

**Where to instrument**: `MessageSystem.sendMessage()` and `MessageQueue.sendMessage()`.

---

### 3. Render Worker — Per-Node FBO Render Time

- `renderFboNode()` execution time per node
- Node types: GLSL, P5, Hydra, Canvas, Three.js, Textmode
- Total frame time, frame drops, GPU readback time
- `RenderingProfiler` already tracks global frame stats — extend it with per-node breakdown.

**Where to instrument**: `fboRenderer.ts` `renderFboNode()` already has the node ID. Add per-node timers.

---

### 4. Audio Worklet — DSP Processing (`defineDSP`)

- `process()` execution time per processor (128-sample block, ~344 calls/sec)
- Inlet message handling time (`handleMessage()`)
- **Sampling strategy**: Measure every Nth block (e.g., N=10) to keep overhead negligible. At 344 Hz, measuring every 10th = 34 measurements/sec per processor. At `performance.now()` cost of ~0.5µs, overhead ≈ 17µs/sec per processor — acceptable.

**Where to instrument**: `defineDSP()` wraps the processor class — add sampling wrapper around `process()`.

---

### 5. Audio Worklet — V2 Audio Nodes

- `send()` method execution time per node
- `onMessage()` callback execution time
- Audio graph rebuild time (`AudioService.updateEdges()`)
- `TimeScheduler` message processing time

**Where to instrument**: `AudioService.dispatchToNode()` and `TimeScheduler.processMessage()`.

---

### 6. JS Worker Thread (`jsWorker`)

- Code execution time (`executeCode` → completion)
- `onMessage()` callback execution time per worker node
- `setInterval()` callback execution time
- Video frame callback execution time
- FFT forwarding overhead (main → worker)

**Where to instrument**: `jsWorker.ts` message handler for `incomingMessage` and `setInterval`.

---

### 7. Main Thread — JS Nodes (`JSRunner`)

- `onMessage()` callback execution time (for non-worker JS nodes)
- `requestAnimationFrame()` callback execution time
- `setInterval()` callback execution time

---

### 8. Render Worker — Clock Scheduler

- `tick()` execution time
- Per-callback execution time for `onBeat` / `every` registered in render worker

---

## Execution Environments

| Environment | Thread Type | Notes |
|---|---|---|
| Main thread | Browser main | ObjectService, MessageSystem, JSRunner (non-worker), AudioService |
| Render worker | Dedicated Worker | FBORenderer, P5/Hydra/GLSL renderers, render-clock callbacks |
| Audio worklet | AudioWorkletGlobalScope | All `defineDSP` processors, AudioWorkletNode message handling |
| JS worker(s) | Dedicated Worker (one per worker node) | `jsWorker.ts`, user code execution |
| DSP expr~/fexpr~ | AudioWorkletGlobalScope | Expression evaluator processors |

---

## Data Model

```typescript
// Rolling stats computed over a sliding window (e.g., last 300 frames or 2s)
interface TimingStats {
  avg: number;   // milliseconds
  max: number;
  p95: number;
  last: number;
  callsPerSecond: number;
}

interface NodeProfileData {
  nodeId: string;
  nodeType: string;     // 'hydra', 'metro', 'osc~', 'worker', etc.
  nodeLabel: string;    // human-readable label from node data
  thread: ThreadId;

  processingTime: TimingStats;    // onMessage / renderFboNode / process()
  messageCount: number;           // messages received per second

  // Video nodes only
  renderTime?: TimingStats;

  // Memory (where measurable)
  heapUsedBytes?: number;         // JS workers via performance.memory
  textureBytes?: number;          // Render worker, estimated from FBO size

  // Flags
  isHot: boolean;   // exceeds configurable threshold (e.g., >2ms avg)
  isSampled: boolean; // true if using sampled measurement (e.g., DSP)
}

interface ThreadProfileData {
  id: ThreadId;
  label: string;               // 'Main Thread', 'Render Worker', 'Audio Worklet', 'Worker: name'
  totalTime: TimingStats;      // total busy time per frame
  frameBudgetPercent: number;  // for non-audio threads (vs 16.7ms / 60fps)
  nodes: NodeProfileData[];
}

interface ProfilerSnapshot {
  timestamp: number;
  threads: ThreadProfileData[];
  totalNodes: number;
  bottleneckNodeId: string | null;  // node with highest avg processingTime
}

type ThreadId = 'main' | 'render' | 'audio-worklet' | `worker-${string}`;
```

---

## Architecture

### Data Collection Per Thread

Each thread runs a lightweight `ProfilerCollector` that:
1. Accumulates timing samples in a circular buffer (no allocation during measurement)
2. Batches stats and sends to main thread every **500ms** (not per measurement)
3. Can be enabled/disabled via a message without reloading

```
Main Thread ProfilerCoordinator
├── Collects from: ObjectService wrapper, MessageSystem wrapper, JSRunner wrapper
├── Receives from: Render Worker (postMessage), Audio Worklet (workletChannel), JS Workers (postMessage)
├── Aggregates every 500ms → ProfilerStore (Svelte store)
└── Provides: ProfilerStore.subscribe() for UI components

Render Worker ProfilerCollector
├── Per-node timers in renderFboNode()
├── Extends existing RenderingProfiler
└── Sends: `profilerStats` message → GLSystem → ProfilerCoordinator

Audio Worklet ProfilerCollector
├── Sampling wrapper around process() in defineDSP
├── Uses workletChannel for stats reporting
└── Reports every ~1000 blocks (~3s interval, low priority)

JS Worker ProfilerCollector (per worker)
├── Wraps onMessage callbacks
└── Uses worker postMessage for stats reporting
```

### Enabling / Disabling Profiling

The profiler is **off by default** — zero overhead when disabled. Enabled state is stored in a Svelte store and propagates to all threads via their existing message channels:

- Render worker: `GLSystem.postMessage({ type: 'enableProfiling', ... })`
- Audio worklet: `workletChannel.send('profiler:enable', ...)`
- JS workers: `worker.postMessage({ type: 'profiler:enable' })`

---

## UI Design

### Profiler Panel

A dockable panel (alongside the existing AI chat, node inspector, etc.) with three views:

#### View 1: Overview (default)

```
┌──────────────────────────────────────────────────────────────────┐
│ PROFILER              [Overview] [Timeline] [Memory]  [■ Active] │
├────────────────────────────────────────────────────────────────── │
│ Frame Budget (60fps = 16.7ms)                                     │
│ ████████████████████░░░░░░░░░░░░░  12.4ms / 16.7ms  74%          │
│                                                                   │
│ THREADS                      AVG     MAX    P95   MSGS/S         │
│ ● Main Thread               3.2ms   8.1ms  5.4ms   240          │
│ ● Render Worker             6.8ms  12.3ms  9.1ms    —           │
│ ◆ Audio Worklet (sampled)   0.4ms   0.9ms  0.6ms    —           │
│ □ Worker: my-worker         2.1ms   5.2ms  3.8ms    18          │
├────────────────────────────────────────────────────────────────── │
│ [Sort: avg ▼]  [Filter: all ▼]  [Threshold: 0.5ms]               │
│                                                                   │
│ NAME             TYPE     THREAD     AVG    MAX    BAR            │
│ ▲ hydra-23       hydra    render    4.2ms  8.1ms  ████████░░     │
│   glsl-45        glsl     render    2.6ms  4.2ms  █████░░░░░     │
│   metro-12       metro    main      1.1ms  2.3ms  ██░░░░░░░░     │
│   my-worker      worker   worker    0.8ms  1.4ms  █░░░░░░░░░     │
│   add~-03        add~     audio     0.1ms  0.2ms  ░░░░░░░░░░     │
│   …                                                               │
└──────────────────────────────────────────────────────────────────┘
```

- **Sort** by: avg time, max time, p95, messages/sec, node type
- **Filter** by thread, node type, or "hot only" (above threshold)
- **Threshold** slider: hides nodes below N ms (reduces noise)
- Click a row → select node in the patch editor + show detail popover
- Color-coded thread indicators: render=orange, main=white, audio=blue, worker=green

#### View 2: Node Overlay (in-patch)

When the profiler is active, each node in the canvas gets a small badge:

```
┌─────────────────────┐
│  hydra              │
│  ═══════════════    │  ← code editor
│                     │
│  ▶ ○               │
└─────────────────────┘
  [4.2ms ████]         ← profiler badge below node

```

Badge color:
- Green: `avg < 1ms`
- Yellow: `1ms ≤ avg < 5ms`
- Red: `avg ≥ 5ms`
- Gray: not yet measured / no data

Clicking the badge opens a detail popover.

#### View 3: Timeline (advanced)

A flame-chart style view showing activity across threads over the last ~2 seconds:

```
ms  0    4    8   12   16   20   24   28   32
    │    │    │    │    │    │    │    │    │
Main│▓▓▒░░░▓▓░░░░░▓░░░░░░░░░░░░░░░░░░░░░░░ │
Rndr│░░░░░▓▓▓▓▓▓▓▓░░░░░▓▓▓▓▓▓▓▓░░░░░░░░░ │
Wkr │░░░░░░░░░░░░░▓▓▓▓░░░░░░░░░░▓▓▓▓▓░░░ │
    └────────────────────────────────────┘
         ↑ click to zoom into a frame
```

- Shows per-thread activity bars
- Hover to see which node was active at that moment
- Zoom into a single frame to see within-frame breakdown
- Useful for identifying blocking patterns (e.g., message chain causing frame stutter)

#### Node Detail Popover

Clicking a node in the list or its badge opens:

```
┌────────────────────────────────┐
│ hydra-23  [hydra]  render      │
├────────────────────────────────┤
│ Processing Time                │
│  avg   4.2ms  ████████████     │
│  p95   7.1ms  █████████████    │
│  max   8.1ms  ████████████████ │
│  last  3.9ms                   │
├────────────────────────────────┤
│ Render Time     4.2ms avg      │
│ Texture         1920×1080 8MB  │
│ FBO Reads       12/sec         │
├────────────────────────────────┤
│ Messages In     0/sec          │
│ Messages Out    0/sec          │
├────────────────────────────────┤
│ [Jump to node →]               │
└────────────────────────────────┘
```

---

## Memory Profiling

### Per-Thread Heap (where available)

- JS Workers: `performance.memory.usedJSHeapSize` (Chrome only)
- Main thread: `performance.memory.usedJSHeapSize`
- Audio worklet: Not exposed (can only track message overhead)

### Video Texture Memory

Estimated from FBO dimensions:
- `width × height × 4 bytes × (FBO count)` per video node
- Render worker knows all FBO sizes and can compute this

### Memory View

```
MEMORY
─────────────────────────────────────
Main Thread heap      48 MB  ████░░░░
Render Worker heap    22 MB  ██░░░░░░
Worker: my-worker     12 MB  █░░░░░░░

Texture Memory
  hydra-23  1920×1080  8.3 MB
  glsl-45   1920×1080  8.3 MB
  p5-11     800×600    1.8 MB
  Total                18.4 MB
─────────────────────────────────────
```

---

## Implementation Phases

### Phase 0: Foundation

- `ProfilerCoordinator` singleton on main thread
- `ProfilerStore` Svelte store
- Enable/disable message propagation to all threads
- Profiler panel skeleton (Overview only, no data yet)

### Phase 1: Main Thread Object Profiling

- Instrument `ObjectService.dispatchMessage()`
- Instrument `MessageSystem.sendMessage()` (opt-in, expensive)
- Show text objects in profiler panel

### Phase 2: Render Worker Per-Node Timing

- Extend `RenderingProfiler` with per-node FBO timing
- Report via existing `flushFrameStats` → `profilerStats` message
- Show video nodes in profiler panel with texture memory

### Phase 3: Node Overlay in Patch

- Add profiler badge component to base node wrapper
- Subscribe to `ProfilerStore` per-node data
- Color-coded badges, click to open detail popover

### Phase 4: JS Worker Profiling

- Add `ProfilerCollector` to `jsWorker.ts`
- Instrument `incomingMessage` and `setInterval` handlers
- Report via worker postMessage

### Phase 5: Audio Worklet Profiling

- Add sampled `process()` timer in `defineDSP`
- Report via `workletChannel` (low priority, infrequent)
- Show DSP nodes in profiler panel

### Phase 6: Timeline View

- Ring-buffer based event recording (opt-in, heavier mode)
- Flame chart canvas renderer
- Zoom/pan interaction

### Phase 7: Memory View

- JS heap polling per thread
- Texture memory calculation in render worker
- Memory view tab in profiler panel

---

## Technical Constraints & Decisions

### Measurement Overhead Budget

| Thread | Target overhead |
|---|---|
| Main thread | < 0.1ms/frame total |
| Render worker | < 0.2ms/frame total |
| Audio worklet | < 0.01ms/block (sampled every 10th block) |
| JS worker | < 0.5ms/execution |

### No Allocation in Hot Paths

Use pre-allocated ring buffers for timing samples. `performance.now()` is the only allocation-free timing API available across all contexts.

### Cross-Thread Stats Reporting

All threads batch stats and send **every 500ms** — not per measurement. This means profiler data has a 500ms lag but causes zero per-frame overhead for IPC.

For the audio worklet, stats are sent every ~3 seconds due to the high call frequency of `process()`.

### Profiler-Off Overhead

When disabled: **zero overhead** — all measurement code is behind `if (profilerEnabled)` guards. The `profilerEnabled` flag is a simple boolean, not a store subscription, to avoid reactivity overhead in hot paths.

### Node Name Resolution

Workers and the render worker only know `nodeId`. The main `ProfilerCoordinator` maintains a `nodeId → { label, type }` map derived from the current `nodes` store and resolves names before exposing data to the UI.

---

## Open Questions

1. **Should the profiler record history?** E.g., last 60 seconds of per-node stats, so you can scrub back to see what happened during a stutter. Would require a write-once circular buffer with some memory cost (~few MB).

2. **Export / share profiler data?** JSON export of a snapshot for bug reports. Low effort, high utility.

3. **Alert system?** Configurable alerts when a node exceeds a threshold (e.g., red flash + notification). Useful for catching runaway `setInterval` callbacks.

4. **`expr~` / `fexpr~` profiling?** These are AudioWorklet processors running user-supplied math expressions. The expression is JIT-compiled — it would be useful to see their `process()` overhead. Same approach as native-dsp.

5. **Canvas/P5 GPU timing?** `EXT_disjoint_timer_query_webgl2` allows GPU-side timing but is stripped in most browsers for fingerprinting concerns. We likely have to rely on CPU-side `performance.now()` around the WebGL calls.

6. **Python/Ruby worker profiling?** These run in Pyodide/WASM workers. Can measure the outer `postMessage` round-trip but not internal execution time without changes to the worker bridge.

---

## Related Specs

- `68-undo-redo-system.md` — state tracking patterns
- `71-worklet-direct-channel.md` — audio worklet messaging
- `RenderingProfiler.ts` — existing render frame profiler (foundation for Phase 2)
