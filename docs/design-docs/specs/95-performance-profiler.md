# 95. Performance Profiler

**Status**: Draft
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

**Sampling strategy**: Measure every Nth block (default N=16) to keep overhead negligible. At 344 Hz, measuring every 16th = ~21 measurements/sec per processor. At `performance.now()` cost of ~0.5µs, overhead ≈ 10µs/sec per processor — well below audible impact. N is a compile-time constant, not runtime-configurable, to avoid a branch in the hot path.

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
| --- | --- | --- |
| Main thread | Browser main | ObjectService, MessageSystem, JSRunner (non-worker), AudioService |
| Render worker | Dedicated Worker | FBORenderer, P5/Hydra/GLSL renderers, render-clock callbacks |
| Audio worklet | AudioWorkletGlobalScope | All `defineDSP` processors, AudioWorkletNode message handling |
| JS worker(s) | Dedicated Worker (one per worker node) | `jsWorker.ts`, user code execution |
| DSP expr~/fexpr~ | AudioWorkletGlobalScope | Expression evaluator processors |

---

## Data Model

```typescript
// Rolling stats computed over a 2-second sliding window of samples
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
  isHot: boolean;   // exceeds user-configured threshold (default: avg > 2ms)
  isSampled: boolean; // true if using sampled measurement (e.g., DSP)
}

interface ThreadProfileData {
  id: ThreadId;
  label: string;               // 'Main Thread', 'Render Worker', 'Audio Worklet', 'Worker: name'
  totalTime: TimingStats;      // total busy time per frame
  frameBudgetPercent: number;  // for non-audio threads (vs 16.7ms / 60fps)
  nodes: NodeProfileData[];
}

// A single aggregated snapshot — produced every 500ms from batched samples
interface ProfilerSnapshot {
  timestamp: number;
  threads: ThreadProfileData[];
  totalNodes: number;
  bottleneckNodeId: string | null;  // node with highest avg processingTime
}

// 60-second history: ring buffer of snapshots at 500ms intervals = 120 entries max
// Stored in ProfilerCoordinator, not in the Svelte store (avoid reactive overhead)
// UI reads a slice on demand (e.g., for a sparkline or scrubbing)
interface ProfilerHistory {
  snapshots: ProfilerSnapshot[];  // ring buffer, max 120 entries
  push(snapshot: ProfilerSnapshot): void;
  getRange(fromMs: number, toMs: number): ProfilerSnapshot[];
  getLatest(): ProfilerSnapshot | null;
}

type ThreadId = 'main' | 'render' | 'audio-worklet' | `worker-${string}`;
```

### History Ring Buffer

- 120 snapshots × 500ms = 60 seconds of history
- Each snapshot is a full `ProfilerSnapshot`. At ~50 nodes, a snapshot is roughly 50 × ~100 bytes = ~5 KB. 120 snapshots ≈ **600 KB** peak — acceptable.
- Snapshots are plain objects (no `$state` wrappers) stored in `ProfilerCoordinator`. The Svelte store only holds the latest snapshot for live display.
- History is cleared when profiling is disabled or the patch is reloaded.

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

A dockable panel (same pattern as AI chat, object browser, etc.) focused on a single **Overview** view.

#### Overview Panel

```
┌──────────────────────────────────────────────────────────────────┐
│ PROFILER                              [Memory ▼]  [● Recording]  │
├──────────────────────────────────────────────────────────────────┤
│ Frame Budget  ████████████████████░░░░░░░   12.4ms / 16.7ms  74% │
│                                                                   │
│ THREADS                     AVG     MAX     P95    MSGS/S        │
│ ● Main Thread               3.2ms   8.1ms   5.4ms   240         │
│ ● Render Worker             6.8ms  12.3ms   9.1ms    —          │
│ ◆ Audio Worklet ~           0.4ms   0.9ms   0.6ms    —          │
│ □ Worker: my-worker         2.1ms   5.2ms   3.8ms    18         │
├──────────────────────────────────────────────────────────────────┤
│ [Sort: avg ▼]  [Thread: all ▼]  [⚠ Hot only]  [Threshold: 2ms ▼]│
│                                                                   │
│ NAME              TYPE    THREAD    AVG    MAX    SPARKLINE       │
│ ⚠ hydra-23        hydra   render   4.2ms  8.1ms  ╱╲_╱╲╱╲_╱      │
│ ⚠ glsl-45         glsl    render   2.6ms  4.2ms  _╱╲__╱╲__      │
│   metro-12        metro   main     0.8ms  2.3ms  ___╱____       │
│   my-worker       worker  worker   0.6ms  1.4ms  ___╱╲___       │
│   add~-03 ~       add~    audio    0.1ms  0.2ms  ___________     │
│   …                                                               │
└──────────────────────────────────────────────────────────────────┘
```

**Thread summary row** (top section):

- One row per active thread
- Clicking a thread row filters the node list to that thread
- `~` suffix indicates sampled measurement

**Node list** (bottom section):

- Default sort: avg time descending
- **`⚠ Hot` indicator**: shown when `avg > threshold`. The `⚠ Hot only` toggle hides everything below threshold — the fastest way to see problem nodes
- **Threshold picker**: 0.5 / 1 / 2 / 5ms presets (default 2ms)
- **Sparkline**: shows avg time over the last 60 seconds (sampled from history ring buffer, drawn as a tiny 60px canvas). Gives instant visual of "is this node consistently slow, or was it a spike?"
- **Sort** by: avg, max, p95, messages/sec
- **Thread filter** dropdown: All / Main / Render / Audio / Workers
- Click a row → **selects the node in the patch** + opens detail popover

**Color coding**:

- Thread dot color: render=amber, main=zinc-200, audio=blue, worker=emerald
- Hot rows: amber background tint (`bg-amber-950/30`) + `⚠` icon
- Severely hot rows (avg > 5× threshold): red background tint (`bg-red-950/30`)

#### Node Detail Popover

Clicking a row opens a popover anchored to the row:

```text
┌─────────────────────────────────────┐
│ hydra-23              [hydra]        │
│ render worker                    ⚠  │
├─────────────────────────────────────┤
│ Processing Time                     │
│  avg   4.2ms  ██████████████        │
│  p95   7.1ms  ████████████████      │
│  max   8.1ms  ██████████████████    │
│  last  3.9ms                        │
│                                     │
│  60s history ╱╲_╱╲╱╲╱╲__╱╲___╱╲   │
├─────────────────────────────────────┤
│ Texture         1920×1080  8.3 MB   │
│ FBO Reads       12/sec              │
│ Messages In     —                   │
│ Messages Out    —                   │
├─────────────────────────────────────┤
│           [Jump to node →]          │
└─────────────────────────────────────┘
```

- The 60s history sparkline in the popover is larger (full width, ~80px tall) for easier reading
- "Jump to node" selects + scrolls the patch canvas to the node

#### Node Overlay (in-patch)

When the profiler is recording, each node gets a small indicator in its bottom bar:

```
┌─────────────────────┐
│  hydra              │
│  ═══════════════    │
│                     │
│  ▶ ○        4.2ms ⚠ │  ← profiler badge in node footer
└─────────────────────┘
```

- Shows avg time only (to keep it compact)
- `⚠` icon if hot, no icon otherwise
- Color: zinc-400 (normal) / amber-400 (hot) / red-400 (severely hot)
- Clicking the badge opens the same detail popover as the panel list

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
| --- | --- |
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

## Settled Decisions

| Decision | Resolution |
| --- | --- |
| Measurement approach | Sampling everywhere — low overhead is the priority |
| DSP sample rate | Every 16th block (compile-time constant) |
| History | 60-second ring buffer (120 snapshots × 500ms), ~600 KB peak |
| "Hot" alerting | Visual highlighting in the panel + node overlay badge; configurable threshold (default 2ms avg) |
| Timeline / flame chart | Deferred — not in initial scope |
| Profiler-off overhead | Strict zero — single boolean guard, no store subscriptions in hot paths |

## Open Questions

1. **Export / share profiler data?** JSON export of a snapshot for bug reports. Low effort, high utility.

2. **`expr~` / `fexpr~` profiling?** These are AudioWorklet processors running user-supplied math expressions. Same sampling approach as native-dsp applies.

3. **Canvas/P5 GPU timing?** `EXT_disjoint_timer_query_webgl2` allows GPU-side timing but is stripped in most browsers for fingerprinting. We likely rely on CPU-side `performance.now()` around WebGL calls — which measures CPU wait, not actual GPU time.

4. **Python/Ruby worker profiling?** These run in Pyodide/WASM workers. Can measure outer `postMessage` round-trip latency but not internal execution without changes to the worker bridge.

---

## Related Specs

- `68-undo-redo-system.md` — state tracking patterns
- `71-worklet-direct-channel.md` — audio worklet messaging
- `RenderingProfiler.ts` — existing render frame profiler (foundation for Phase 2)
