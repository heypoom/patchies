# FOSSASIA Talk Outline

**Title**: Building a Browser-Native Audio-Visual Programming Environment
**Duration**: 15 minutes
**Audience**: Web developers, broadly familiar with the Web platform

---

## Slide 1 — What is Patchies? (1 min)

- Visual node-based programming environment in the browser
- Connect nodes: GLSL shaders, Hydra, P5.js, Three.js, Web Audio DSP, ChucK, Csound, Bytebeat, JavaScript
- Demo: show a live patch — a GLSL shader fed by FFT data from an audio node
- **Hook**: "Every node you see is running on a different piece of the Web platform — and they all talk to each other in real time"

---

## Slide 2 — The Architecture Challenge (1 min)

- We need to run: WebGL rendering, audio DSP, JS user code, live coding runtimes — all at the same time, without dropping frames
- Naive approach: everything on the main thread → jank
- Our answer: **push everything off the main thread**
  - Rendering → Web Worker + OffscreenCanvas
  - Audio DSP → AudioWorklet
  - Assembly VM → Web Worker
- Main thread just orchestrates

---

## Slide 3 — The Rendering Pipeline: Web Worker + OffscreenCanvas (3 min)

### The render graph

- User's visual patch is a DAG (directed acyclic graph)
- We filter nodes to "FBO-compatible" ones, then run a **DFS topological sort**
- Nodes rendered in dependency order — outputs become textures for downstream nodes

### FBO chaining

- Each node owns a `regl.Texture2D` + `regl.Framebuffer2D`
- On every frame: node reads its input textures, renders into its own FBO
- Final node blits to the OffscreenCanvas

### FBO reuse trick

- Graph rebuilds happen often (user drags a connection)
- Naively destroying + recreating FBOs causes a **black flash** on Chrome
- Solution: reuse FBOs if size matches; only destroy what was removed
- One-liner fix for a jarring UX problem

### Wireless video routing

- `send.vdo` / `recv.vdo` nodes create **virtual edges** in the graph
- No physical connection on the canvas, but the graph builder injects them before topological sort
- Same pattern used for `send~` / `recv~` in audio

---

## Slide 4 — FFT as a GPU Texture (2 min)

- `fft~` node wraps an `AnalyserNode` on the main thread
- `AudioAnalysisSystem` polls it each frame → sends a `Float32Array` to the render worker via `postMessage`
- Worker creates a `regl.texture({ format: 'luminance', type: 'float', width: fftSize, height: 1 })`
- GLSL nodes bind this texture as a `sampler2D` uniform

```glsl
uniform sampler2D fft;
// sample frequency bin 0.5 (mid frequencies)
float energy = texture2D(fft, vec2(0.5, 0.0)).r;
```

- **Effect**: audio data drives visuals entirely on the GPU — no JS per-pixel work

---

## Slide 5 — Zero-Copy Previews: PBO Async Readback (2 min)

- Each node shows a live thumbnail in the patch editor
- Naive approach: `gl.readPixels()` blocks the GPU pipeline → destroys performance
- Our approach: **Pixel Buffer Objects (PBOs) + fenceSync**

### The two-frame trick

1. **Frame N**: `gl.readPixels(..., 0)` with PBO bound → returns immediately; GPU transfers async; create `gl.fenceSync()`
2. **Frame N+1**: `gl.clientWaitSync(sync, 0, 0)` with **0 timeout** (non-blocking); if ready → `gl.getBufferSubData()` → `ImageBitmap`
3. Transfer bitmap to main thread: `postMessage({...}, { transfer: [bitmap] })` — **zero-copy**

### Extra optimizations

- Rate-limited to ~40fps (thumbnails don't need 60fps)
- Round-robin batch selection: spread GPU reads across frames
- Visible-node culling: skip thumbnails for off-screen nodes
- Multiple targets sharing a source → deduplicated: one GPU read, fan out

---

## Slide 6 — The Audio Engine: AudioWorklet + Direct Worklet Channels (3 min)

### defineDSP() — eliminating AudioWorkletProcessor boilerplate

- Every DSP node is two files: a `*.processor.ts` (worklet thread) and a `*.node.ts` (main thread)
- `defineDSP()` wraps `AudioWorkletProcessor`, provides:
  - `state()`: per-instance state factory
  - `recv()`: message handler
  - `process()`: 128-sample hot path
- Key optimization: `normalizeInputs()` — **zero-allocation in steady state**
  - Pre-allocates `Float32Array[][]` structure once
  - On each call, only swaps array references (no `new`)

### k-rate vs a-rate AudioParams

- `p(param, i)` helper: if `param.length === 1` (k-rate), always reads index 0; otherwise reads index `i`
- Handles Web Audio's dual automation rates transparently

### The worklet channel — inter-worklet messaging without the main thread

- All AudioWorklet processors on the same `AudioContext` share one `AudioWorkletGlobalScope`
- We exploit this with `globalThis.__workletChannel`: a singleton `Map<nodeId, recvFn>`
- `send~` to `recv~`: message goes worklet → worklet **directly**, never touching the main thread
- Pool of reusable arrays indexed by call depth handles recursive `recv→send` chains without allocation

---

## Slide 7 — Handling Async Node Creation (1 min)

- Some nodes (ChucK, Csound, AudioWorklets) are async to initialize
- Edges can arrive before the target node exists
- Solution: **late-arriving node pattern**
  - `AudioService` stores all edges in `currentEdges`
  - When a node finishes `create()`, call `connectPendingEdges()` — retry all edges involving it
- No special-casing per node type; the framework handles it generically

---

## Slide 8 — VASM: A Custom VM in WebAssembly (1 min)

- `asm` object: a visual assembly canvas inside Patchies
- Rust VM compiled via `wasm-pack --target web`
- Stack-based machine: registers (PC, SP, FP), inbox/outbox message queues, sleep/wake
- Runs in its own Web Worker
- Key trick: `get_snapshot()` batches inspect + side-effects + messages into **one WASM call** — minimizes JS↔WASM boundary crossings

---

## Slide 9 — Lessons Learned (1 min)

| Problem | Solution |
|---------|----------|
| Main thread jank from rendering | OffscreenCanvas Web Worker |
| `gl.readPixels` blocking GPU | PBO + fenceSync double-buffering |
| FBO rebuild flicker | Reuse FBOs if size matches |
| AudioWorklet ↔ AudioWorklet latency | `globalThis.__workletChannel` direct delivery |
| Async node creation race conditions | `connectPendingEdges()` on node ready |
| JS↔WASM overhead | Batch calls in `get_snapshot()` |
| Audio data in shaders | FFT as 1D `sampler2D` texture |

---

## Slide 10 — What's Next / Demo (30 sec)

- Live collaborative patches (Y.js)
- More DSP nodes (currently 45+ processors)
- AI-assisted patch generation
- **Demo**: build a patch live — connect `osc~` → `fft~` → GLSL shader, see FFT texture drive the visual in real time

---

## Speaker Notes

- Keep demo node count small (2–3 nodes) — complexity distracts
- The PBO slide is the most "wow" moment for web devs unfamiliar with WebGL
- The worklet channel trick is the most "clever" moment — emphasize that the Web platform gives you shared scope for free
- For time overruns: cut Slide 8 (VASM) — it's interesting but non-essential
