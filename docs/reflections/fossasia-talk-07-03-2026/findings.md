# FOSSASIA Talk – Technical Findings (07-03-2026)

Deep technical analysis of Patchies' audio and video/rendering engines, intended as source material for a conference talk.

---

## 1. Video / Rendering Engine

### Everything runs in a Web Worker

- `renderWorker.ts` is the entry point — a dedicated Web Worker that owns an `OffscreenCanvas`, a `WebGL2RenderingContext`, and a `regl` instance.
- The main thread sends messages (`buildRenderGraph`, `startAnimation`, `setUniformData`, `setFFTData`, `syncTransportTime`, etc.) and receives `animationFrame` and `previewFrame` ImageBitmaps back via **zero-copy transfer**.

### Render Graph (`graphUtils.ts` + `types.ts`)

- Node types: `glsl`, `hydra`, `swgl`, `canvas`, `textmode`, `three`, `img`, `bg.out`, `send.vdo`, `recv.vdo`.
- `buildRenderGraph()` filters the XYFlow canvas to FBO-compatible nodes, builds `inputs[]` / `outputs[]` / `inletMap` (`Map<inletIndex, sourceNodeId>`), then runs a **DFS topological sort**.
- Circular dependency detection throws an error (returns empty graph as fallback).
- `bg.out` is a special node — the edge connecting into it identifies the "final output node".
- `send.vdo` / `recv.vdo` nodes create **virtual edges** (wireless video routing) merged into the graph at build time — same pattern as audio's `send~` / `recv~`.

### FBO Pipeline (`fboRenderer.ts`)

- Each node gets its own `regl.Texture2D` + `regl.Framebuffer2D` (the FBO).
- On `buildFBOs()`: existing FBOs are **reused if size matches** (prevents black flash on Chrome during graph rebuild), only destroyed for nodes removed from the graph.
- On each frame: nodes are rendered in `sortedNodes` topological order; each node reads from its inputs' textures via `getInputTextureMap()` (uses `node.inletMap` for slot-based routing).
- Final output: `gl.blitFramebuffer()` from the output node's FBO to the OffscreenCanvas's default framebuffer, then `offscreenCanvas.transferToImageBitmap()` for zero-copy transfer to main thread.

### Renderer Types

| Type | Technique |
|------|-----------|
| **GLSL** | `regl` + custom ShaderToy-compatible draw command; uniforms (float, vec2-4, bool, sampler2D) driven by UI controls |
| **Hydra** | Full Hydra synth instance per node; reuses `regl` context from FBORenderer; old instance kept alive 500ms on rebuild for `synth.time` continuity |
| **SwissGL** | User code runs via `new Function()` with a context object; transport time injected as `t` |
| **Canvas/P5** | Runs user JS in worker context; renders to OffscreenCanvas then blits to FBO |
| **Three.js** | User code receives a Three.js scene/camera/renderer context |

### Hydra → FBO Integration

- Hydra renders to its own internal regl framebuffer.
- After each tick, `blitFramebuffer()` copies Hydra's output to the node's FBO with a **Y-flip** (GL is bottom-up, screen is top-down).
- Input textures from connected nodes are injected into Hydra's `s0–s3` sources by checking `param._reglType === 'texture2d'`.

### PBO Async Pixel Readback (`PixelReadbackService` + `PreviewRenderer` + `CaptureRenderer`)

- `PixelReadbackService`: shared infrastructure — PBO pool (`gl.createBuffer()`), OffscreenCanvas cache (keyed by "WxH"), reusable intermediate FBO for blit/scale.
- **Preview flow (PreviewRenderer) — double-buffered async reads:**
  1. Frame N: `gl.readPixels(..., 0)` with PBO bound returns **immediately** (GPU does transfer async); `gl.fenceSync(SYNC_GPU_COMMANDS_COMPLETE)` created.
  2. Frame N+1+: `gl.clientWaitSync(sync, 0, 0)` with **0 timeout** (non-blocking check); if `ALREADY_SIGNALED` → `gl.getBufferSubData()` → `putImageData()` → `canvas.transferToImageBitmap()`.
  3. Bitmaps transferred via `self.postMessage({type:'previewFrame',...}, {transfer:[bitmap]})` — zero-copy.
  4. Rate-limited at ~40fps cap; round-robin batch selection to spread GPU reads across frames; visible-node culling.
- **CaptureRenderer**: sync path (export/Gemini) uses blocking `gl.readPixels`; async path for worker nodes' `onVideoFrame()` API uses same PBO pattern with deduplication (multiple targets sharing a source only read GPU once).

### FFT as GPU Textures

- `fft~` node (main thread `AnalyserNode`) → `AudioAnalysisSystem` polls it → sends `setFFTData` message to worker with a `Float32Array` or `Uint8Array`.
- Worker creates/updates a `regl.texture({ format: 'luminance', type: 'float'/'uint8', width: fftSize, height: 1 })`.
- GLSL nodes: FFT texture is bound as a `sampler2D` uniform — GLSL shaders can **sample audio frequency data directly on the GPU**.
- Hydra / Canvas / Three: FFT data injected into their execution context as a typed array.

### Transport Time Sync

- Main thread sends `syncTransportTime` at 60fps with `{ seconds, ticks, bpm, beat, phase, bar, beatsPerBar, ppq }`.
- Worker's `FBORenderer.transportTime` updated; all renderers read from this for `iTime` / `time` to stay in sync.
- `globalThis.time` is defined as a getter in the worker so Hydra's `() => time` lambda works.
- `createWorkerClock()` exposes a full clock API (read: `time`, `beat`, `phase`, `bpm`, `bar`; schedule: `onBeat`, `every`, `schedule`; control: `play`, `pause`, `setBpm` → postMessage back to main thread).

---

## 2. Audio Engine

### AudioService v2

- Singleton managing a `Map<nodeId, AudioNodeV2>` registry.
- On `updateEdges()`: disconnects all nodes, reconnects `out~` → destination, then re-evaluates all edges via `connectByEdge()`.
- **Late-arriving nodes**: edges stored in `currentEdges`; when a node is created, `connectPendingEdges()` retries all edges involving it — handles async creation race conditions.
- Connection logic: source's `connect()` → target's `connectFrom()` → default `audioNode.connect(audioNode)` — each node can override.
- AudioParam connections detected via inlet metadata (`isAudioParam: true`) OR by checking `audioNode.parameters.get(name)`.
- Virtual edges from `AudioChannelRegistry` (for `send~` / `recv~`) merged with real edges at `updateEdges()` time.

### AudioNodeV2 Interface

- Optional methods: `create(params[])`, `send(key, message)`, `connect(...)`, `connectFrom(...)`, `destroy()`, `getAudioParam(name)`, `getIcon()`.
- Node class static metadata: `type`, `group` ('sources' / 'processors' / 'destinations'), `inlets[]`, `outlets[]`, `aliases[]`.

### Native DSP (`defineDSP` + `createWorkletDspNode`)

Two-file pattern per DSP node: `*.processor.ts` (AudioWorklet side) + `*.node.ts` (main thread side).

**`defineDSP(options)` — processor side:**
- `state()`: factory for per-instance state (called once).
- `recv(state, data, inlet, send)`: message handler (outside hot path).
- `process(state, inputs, outputs, send, parameters)`: 128-sample hot path.
- `inletDefaults`: constant values for disconnected audio inlets.
- `normalizeInputs()`: **zero-allocation in steady state** — pre-allocates the `Float32Array[][]` structure once, then only swaps references each call.
- `p(param, i)` helper: handles k-rate (length=1) vs a-rate (length=128) AudioParam arrays uniformly.
- `send(message, outlet)`: delivers to `workletChannel` (in-worklet direct delivery) first, then `port.postMessage` for main thread forwarding.

**`createWorkletDspNode(config)` — main thread side:**
- Factory that generates an `AudioNodeV2` class.
- Lazy worklet module loading with dedup (Map of `url → {ready, promise}`).
- Forwards initial params to worklet via `port.postMessage({type:'message-inlet'})`.
- AudioParam inlets set directly on `AudioWorkletNode.parameters`.
- `resolveWorkletInlet()`: "hidden float inlet" pattern — a message inlet can control the constant value of a signal inlet (e.g., `*~ 0.5` routes the float to audio inlet 1's constant buffer).

### Worklet Direct Channel (`worklet-channel.ts`)

- All AudioWorklet processors on the same AudioContext share one `AudioWorkletGlobalScope`.
- `globalThis.__workletChannel` singleton registry: `Map<nodeId, recvFn>` + `Map<nodeId, Map<outlet, connections[]>>`.
- `send()` delivers messages **directly between worklets without touching the main thread** — bypasses `port.postMessage` latency.
- Pool of reusable `string[]` arrays indexed by call depth (handles recursive `recv → send` chains without allocation).
- Multiple Vite-bundled IIFE modules all share this via the `globalThis` trick.

### Specific DSP Processors (sample)

| Processor | Interesting detail |
|-----------|-------------------|
| `phasor~` | Uses AudioParam for a-rate frequency automation; phase wraps [0,1) |
| `line~` | Ramp generator; `[value, time]` list messages (PureData-compatible); `stop` freezes immediately |
| `adsr~` | Full ADSR; `bang` = percussive trigger; times in ms → per-sample rates |
| `delwrite~/delread~` | Shared delay buffer via worklet channel or shared memory |
| `tabwrite~/tabread~/tabosc4~` | Wavetable synthesis and reading |
| `vcf~` | Voltage-controlled filter |

### Specialized Audio Nodes

- **`ChuckNode`**: WebChucK integration; `chuck.runCode()` returns shred IDs; `adc` accessible via `source.audioNode.connect(chuck)`; `chuck.chuckPrint` redirected to MessageSystem; event listener management with `startListeningForEvent`.
- **`CsoundNode`**: `@csound/browser`; lazy init (defers to first `send()`); **protection gain** pattern — starts at 0, ramps to 1 only after audio starts to suppress init noise; SharedArrayBuffer detection for performance mode; transport sync subscription.
- **`BytebeatNode`**: Custom bytebeat.js worklet; async RPC pattern (msgId → Promise map) for `callAsync`; supports bytebeat/floatbeat/signedBytebeat types and infix/postfix/glitch/function syntaxes; transport sync via Svelte store subscription.
- **`FFTNode`**: Thin wrapper around `AnalyserNode`; outlets typed as `ANALYSIS_KEY` special type for graph connection routing.
- **`SamplerNode`**: Uses `MediaStreamAudioDestinationNode` + `MediaRecorder` for recording; `AudioBufferSourceNode` for playback; accepts `Float32Array` directly to set buffer.

---

## 3. VASM (Visual Assembly Module)

- Rust codebase compiled to WebAssembly via `wasm-pack --target web`.
- Custom virtual machine: registers (PC, SP, FP), stack-based memory, inbox/outbox message queues, sleep/wake, debug mode.
- `Controller` WASM-bindgen struct wraps a `Sequencer` (multiple machines).
- `get_snapshot()` batches inspect + consume_side_effects + consume_messages into **one WASM call** to minimize JS↔WASM round-trip overhead.
- Runs in a Web Worker to avoid blocking main thread.
- Used for the `asm` object in Patchies (visual assembly canvas).

---

## 4. Key Files

```
ui/src/
  lib/
    audio/
      native-dsp/
        define-dsp.ts                 # defineDSP() worklet boilerplate eliminator
        create-worklet-dsp-node.ts    # Main-thread node factory
        worklet-channel.ts            # In-worklet direct message routing
        types.ts
        nodes/                        # 44 main-thread node definitions
        processors/                   # 45 AudioWorklet processor implementations
      v2/
        AudioService.ts               # Core audio graph manager singleton
        interfaces/audio-nodes.ts     # AudioNodeV2 interface
        nodes/                        # 42 audio node implementations (Chuck, Csound, Bytebeat, ...)
    rendering/
      types.ts                        # RenderNode, RenderGraph, FBONode, RenderParams
      graphUtils.ts                   # buildRenderGraph(), topologicalSort()
  workers/rendering/
    renderWorker.ts                   # Web Worker entry point / message router
    fboRenderer.ts                    # Core FBO pipeline orchestrator
    PixelReadbackService.ts           # Shared PBO pool + canvas cache
    PreviewRenderer.ts                # Async PBO preview thumbnails
    CaptureRenderer.ts                # On-demand capture (sync + async)
    hydraRenderer.ts                  # Hydra synth + blitFramebuffer bridge
modules/
  vasm/src/
    lib.rs
    controller.rs                     # WASM-bindgen API surface
    machine/mod.rs                    # VM core
```
