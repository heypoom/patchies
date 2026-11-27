# 198. WebGPU Render Core

Status: Exploration. Nothing is implemented. This file keeps the context of a
design conversation and a proof-of-concept spike. It is not a committed plan.

## Problem

The WebGL2 renderer limits what Patchies can do:

- No compute shaders. Particles need float FBO ping-pong, which is clunky.
- `wgpu.compute` is isolated. Its results cross WebGPU and WebGL2 through
  copies ([116. WebGPU Render Bridge](116-webgpu-render-bridge.md)).
- Every WebGL-based DOM node owns its own WebGL context. Browsers allow about
  16 active contexts per page. With 30 `three.dom` nodes, 14 lost their context
  and showed a broken canvas.
- Multi-pass graphs pay for WebGL state changes on every pass.

Breaking changes are acceptable. Patchies is still in development.

## Goals

- One WebGPU device renders the video graph, the editor, previews, and the
  final output.
- GLSL keeps working, including Shadertoy shaders pasted as-is.
- WGSL is a full peer of GLSL.
- TouchDesigner-style POPs (particle operators) run as GPU compute.
- Video-heavy patches with 200 chained shader nodes stay smooth.

## One Device, One Canvas

The editor and the final output share one opaque WebGPU canvas, as described in
[197. Canvas Editor and DOM Islands](197-canvas-editor-and-dom-islands.md).
Node outputs are textures on the shared device. The editor draws them as
preview quads and the output draws them full-screen, with no copies.

A device and its textures belong to one thread. Sharing the device means
choosing which thread owns it.

### Devices and Canvases

A WebGPU device is an app's own connection to a GPU adapter. It owns every
buffer, texture, shader, and pipeline it creates, enforces the features and
limits requested in `requestDevice()`, submits work through its queue, and can be
lost on a driver reset or sleep. Resources never cross devices.

In WebGL, the context is both the GPU connection and the canvas, so every canvas
has its own resources. That is why 30 `three.dom` nodes hit the browser's limit of
about 16 WebGL contexts. In WebGPU, a canvas is a surface configured with a device
through `context.configure({ device })`, so one device draws to any number of
canvases. The editor, previews, output, q5 sketches, and every embed on a page
can share one device.

## Threads

Patchies follows the split that Android, iOS, and Chrome use. The thread that
handles input never does heavy GPU work.

| Main thread (UI thread)                  | Render worker (render thread)                     |
| ---------------------------------------- | ------------------------------------------------- |
| Input: mouse, keyboard, touch            | Owns the one canvas as an OffscreenCanvas         |
| Hit-testing against the spatial index    | Owns the shared GPU device                        |
| Editor state: positions, values, camera  | The video graph: shader chains, POPs, q5 sketches |
| DOM islands                              | Draws the editor from the state it receives       |
| Message routing and message-node user JS | Draws previews and the output with no copies      |

The main thread sends small state updates to the worker, such as "camera moved",
"node 42 flashed", or "node 7 moved". It does not draw the editor.

When the page is cross-origin isolated, the camera is shared through a
`SharedArrayBuffer`, so the worker reads the latest camera when each frame
starts. Otherwise camera updates go through `postMessage`, with up to one frame
of extra lag. WebGPU itself never needs `SharedArrayBuffer`. See Shared Memory
in [200. Patchies V2 Primitives](200-patchies-v2-primitives.md).

### Why Not the Main Thread

A spike put everything on the main thread and it worked for small scenes. A
200-node shader chain does not fit there:

- Recording commands costs roughly 10–30 µs of JavaScript per node, so 200
  nodes take about 2–6 ms per frame from the UI thread. This is an estimate.
- `createRenderPipeline` blocks the thread on every shader recompile.
- q5 sketches run user JavaScript in `draw()`. A heavy sketch blocks input.

Render bundles reduce recording cost by replaying a chain's commands, but the
problem returns as patches grow.

### Keeping the Editor Smooth

WebGPU has one queue per device. Editor commands submitted after a heavy video
pass wait behind it, whichever thread submits them. Each frame:

1. Draw the output from the last finished video texture, plus the editor, and
   present it.
2. Submit the next video frame's passes.

The editor stays smooth when the video graph is slow. Video gains one frame of
latency, and its frame rate drops on its own when it runs over budget.

### Frame Budgets

A frame budget is the time limit for one frame: 16.7 ms at 60 fps. The render
worker measures its work and decides what to give up when it runs over:

- Draw the editor first and always.
- Drop video frames instead of delaying the editor.
- Render video at a lower resolution or rate during pan, zoom, and drag.
- Skip nodes whose output nobody uses. The render worker already has cooking
  concepts (`CookStateManager`).

TouchDesigner's Realtime mode drops frames to stay on wall-clock time, and it
only cooks operators whose output is needed.

### Costs

- Up to one frame of input latency: a click is hit-tested on the main thread,
  sent to the worker, and drawn in the next worker frame.
- DOM islands move on the main thread and the canvas catches up in the worker.
  The shared camera limits drift. Islands can show stand-ins during fast pans.

## Wire Types

| TouchDesigner | Patchies wire              | GPU resource                                |
| ------------- | -------------------------- | ------------------------------------------- |
| TOP           | `video` (exists)           | texture                                     |
| POP           | `points` (new)             | storage buffer with an attribute schema     |
| SOP           | `geometry` (spec 115)      | vertex and index buffers                    |
| CHOP          | messages and audio (exist) | small uniform or storage buffers on the GPU |

A `volume` wire for 3D textures could follow, for fluids and SDF fields.

## Shader Languages

GLSL and WGSL share one shader node contract:

- `@title`, `@param`, and `@noinlet` directives
  ([125. GLSL Metadata Directives](125-glsl-metadata-directives.md)), plus
  `@format` and `@resolution`.
- Uniforms as inlets, video inputs, MRT outputs, and feedback.
- `#include` ([118. GLSL Include Preprocessor](118-glsl-include-preprocessor.md)).
  lygia ships WGSL versions of its functions.
- Presets, completions, AI generation, and error mapping.

GLSL is translated to WGSL. WGSL is native and also gets compute, storage
buffers, and atomics.

### GLSL Translation

The translator runs in the browser with no server. V2 uses
[`glsl-to-wgsl`](https://github.com/heypoom/glsl-to-wgsl), a small TypeScript
library (see Chosen Translator below). Babylon.js uses glslang and Tint compiled to
WASM instead: GLSL to SPIR-V to WGSL. Naga is another WASM option.

A Shadertoy-aware preprocessor runs before translation:

- Wrap `mainImage`. Put `iTime`, `iResolution`, `iMouse`, and `iChannelN` in a
  uniform block.
- Split combined `sampler2D` into a texture and a sampler. WGSL has no combined
  samplers.
- Map Buffer A–D to graph-level feedback
  ([113. Graph-Level Feedback](113-graph-level-feedback.md)).
- Map WGSL errors back to GLSL line numbers.

Expect very high Shadertoy compatibility but not 100%. Failures come from shaders
that rely on precision tricks, odd integer division, or driver leniency.
Translation adds latency to every recompile, so it runs off the UI thread.

GLSL compute shaders can use the same toolchain, so POP authors can skip WGSL.

### Translator Options

GLSL reaches WGSL through one of two WASM pipelines, or the TypeScript library
below:

```
glslang + Tint:  GLSL ──glslang──► SPIR-V ──Tint──► WGSL
Naga:            GLSL ──────────Naga───────────► WGSL
```

- **glslang** is Khronos's reference GLSL compiler. It compiles Vulkan-style GLSL.
- **Tint** is the WGSL compiler in Dawn, the WebGPU implementation inside Chrome.
  Babylon.js ships a trimmed Tint, `twgsl`, that reads SPIR-V and writes WGSL. It
  cannot read GLSL by itself.
- **Naga** is wgpu's translator, used by Firefox and Deno. It reads GLSL directly.

A spike translated a self-written corpus of 36 Shadertoy-style shaders, including
3 multipass programs with feedback, in Chrome 131 on an Apple GPU. Results are in
`spikes/glsl-webgpu/FINDINGS.md` on branch `claude/glsl-webgpu-spike-36d5a4`.

| Measure                               | glslang + Tint                               | Naga               |
| ------------------------------------- | -------------------------------------------- | ------------------ |
| Pass rate with all fixes              | 36 of 36                                     | 32 of 36           |
| Pass rate with required rewrites only | 20 of 36 (Chrome 131), 28 of 36 (Chrome 156) | 18 of 36, 27 of 36 |
| Translation, median / p95             | 9.1 / 14.1 ms                                | 1.0 / 1.6 ms       |
| First compile in a fresh browser      | about 150–250 ms                             | about 20 ms        |
| Download, raw / gzip                  | 2,738 / 925 KB                               | 1,071 / 364 KB     |

- 32 of 33 single-pass shaders were pixel-identical to a WebGL2 render of the same
  GLSL. The exception samples a mipmapped texture inside divergent control flow,
  which is undefined in GLSL too. Real Shadertoy shaders do this often, so expect
  small visual differences there, not failures.
- Naga's remaining failures are `switch` fallthrough, implicitly sized `const`
  arrays, `outerProduct`, and `highp` on function parameters.
- Both are fast enough to recompile on every keystroke with a 250 ms debounce.
- A trimmed Naga built with only GLSL in and WGSL out is 971 KB raw and 290 KB gzip.
- The corpus was self-written because shadertoy.com could not be fetched. The
  pass rate on real Shadertoy code is still unmeasured.

### Chosen Translator: glsl-to-wgsl

[`glsl-to-wgsl`](https://github.com/heypoom/glsl-to-wgsl) is a TypeScript library
Poom built for this, published on npm as `glsl-to-wgsl@0.1.0` and MIT-licensed. It
translates a Shadertoy pass, GLSL ES 3.00 with `mainImage`, into a WGSL fragment
module, with no WASM and no dependencies. Its README reports:

| Measure                                     | glsl-to-wgsl                     | Tint                 | Naga       |
| ------------------------------------------- | -------------------------------- | -------------------- | ---------- |
| Real Shadertoy Image passes that translate  | 19,969 of 19,994                 |                      |            |
| Renders matching WebGL2, of 800             | 752                              | 727                  | 662        |
| Download, gzip                              | 16 KB                            | 925 KB, with glslang | 290–364 KB |
| Translation time                            | about 1 ms, up to 250 ms         |                      |            |
| GPU compile and draw time, relative to Tint | median 0.99×, p90 1.2×, max 2.4× | 1×                   |            |

Its output validates in both Tint and Naga. The comparison renders in headless
Chromium on SwiftShader, with WebGL2 as the ground truth, which matches the
baselines in spec 208.

What it gains:

- No lazy-loaded WASM. It ships inside `@patchies/shader`, so the first compile does
  not wait for a download.
- It runs wherever JavaScript runs: browsers, the native host, workers, and build
  tools (spec 202).
- It type-checks GLSL and throws a `GLSLError` with a GLSL line number, so editors
  show errors on the right line without a WGSL-to-GLSL map.
- It keeps GLSL behavior that Naga and Tint get wrong in places: `switch`
  fallthrough, `out` and `inout` copies, short-circuiting with side effects,
  left-to-right evaluation, and constant expressions that WGSL would reject at
  creation.

What Patchies still needs from it, because `glsl` in Patchies is a superset of
Shadertoy (`ui/static/content/objects/glsl.md`):

- **Custom uniforms as inlets,** such as `uniform float iMix;`. The library's
  uniform buffer has a fixed 144-byte Shadertoy layout.
- **Named textures as video inlets,** such as `uniform sampler2D image;`. The
  library maps an unbound sampler to `iChannel0`, as WebGL does.
- **Reflection:** the name, type, and offset of each custom uniform, and the binding
  of each named texture, so the object can create its inlets. Figma's translator
  extracts the same layouts. A result such as `{ wgsl, uniforms, textures }`, with
  the extra resources in a second bind group, keeps the Shadertoy layout unchanged.
- **Patchies' `uv`,** which V1 shaders use without declaring it: a preamble or an
  option.
- **Off the UI thread.** The largest macro-heavy shaders take up to 250 ms, so
  translation runs in the render worker or another worker.

It does not support sound shaders, shadow, array, or integer samplers, or Hydra,
which has its own path below.

### Preprocessor Rewrites

Required for either pipeline:

1. Add `#version 450`. Wrap `mainImage` in `main()` with a
   `layout(location = 0) out vec4` output initialized to `vec4(0, 0, 0, 1)`.
2. Put the Shadertoy uniforms in one `std140` uniform block with explicit bindings.
3. Split each `iChannelN` into a `texture2D` and a `sampler`. Tint's SPIR-V reader
   rejects combined image samplers: 0 of 36 passed without the split. A macro
   rebuilds `sampler2D(texture, sampler)` at each use.
4. Rewrite `sampler2D` function parameters and their call sites into texture and
   sampler pairs. glslang only accepts the sampler constructor at the point of use.
5. Rename identifiers that are keywords in GLSL 450 but not in GLSL ES 3.00, such
   as `precise`, `buffer`, and `sampler`.

Shadertoy compatibility fixes:

6. Rename WGSL reserved words that are legal GLSL identifiers, such as `target`,
   `ref`, and `meta`.
7. Polyfill `smoothstep` for reversed edges. Chrome 131 rejects them and Chrome
   156 accepts them.
8. Strip `precision` statements.
9. Prepend `diagnostic(off, derivative_uniformity);` to the WGSL. 5 of 36 shaders
   sample textures or take derivatives in non-uniform control flow.

Other findings:

- twgsl returns truncated WGSL as if it succeeded when it fails. Callers must
  check for an `@fragment` entry point.
- Keep Shadertoy's y-up convention by rendering each pass to an offscreen texture
  and flipping once in the final blit. Flipping `fragCoord` instead breaks buffer
  reads in multipass programs.
- glslang errors map back to the user's GLSL lines by subtracting the preamble
  length: 5 of 6 broken shaders map exactly, and a missing semicolon reports the
  next line, as WebGL does. Errors from Tint or `createShaderModule` carry only
  WGSL line numbers, which cannot be mapped back.

### Server-Side Translation

The Patchies server is written in Go. It can translate GLSL too:

| Approach          | How                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| Command-line tool | Run `naga` from `cargo install naga-cli`, or glslang then Tint, as a subprocess. Easiest.                  |
| WASM inside Go    | Run glslang and Tint compiled for WASI with wazero, a pure-Go WASM runtime. Sandboxed by default.          |
| cgo bindings      | Link the C++ libraries into the Go binary. A C++ toolchain in the build, and crashes take down the server. |

Translating in the browser stays the default:

- A server round trip of roughly 50–200 ms per recompile hurts live coding.
- Offline use and embeds on other sites cannot depend on the server.
- Compiling untrusted shaders needs time and memory limits, isolation, and rate limiting.
- The server's Tint version may differ from the user's Chrome.

The server helps as a supplement: translating a patch's shaders while the WASM is
still loading, caching popular shaders by hash, and serving weak devices.

Pre-translate built-in presets and example patches at build time and ship the WGSL
with them. Patches that use only built-in shaders then never load the translator.

### Hydra

1. Keep Hydra producing GLSL and translate it. Replace only the regl output layer.
2. Later, add a WGSL backend. Hydra's transforms are small snippet functions,
   so a hand port is bounded.

## Node Tiers

| Tier                | How                                                                               | Cost per frame           | Examples                                              |
| ------------------- | --------------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------- |
| 1. Native           | Renders into a texture on the shared device                                       | none                     | `wgsl`, `glsl`, `q5`, maybe Three's WebGPU renderer   |
| 2. Same-thread copy | Draws into its own 2D or WebGL OffscreenCanvas, then `copyExternalImageToTexture` | one GPU copy             | `canvas`, `textmode`, `pixi` on WebGL, Three on WebGL |
| 3. Cross-thread     | Main-thread DOM renderer sends a bitmap                                           | a copy plus a thread hop | `p5`, `canvas.dom`, `three.dom`                       |

Three's WebGPU backend may accept an existing device and render into a target
whose texture can be read through backend internals. This is unverified. Pixi v8
has a WebGPU renderer, but device sharing is unknown.

### WebGL2 Islands

WebGL2 nodes share one WebGL2 context on an OffscreenCanvas in the render worker.
When the graph reaches a WebGL2 node, the worker submits WebGPU work, the WebGL2
node renders, and `copyExternalImageToTexture` brings the result back.

- The copy is a GPU blit, about 0.1–0.3 ms at 1080p.
- The real cost is synchronization: WebGPU waits for WebGL2, splitting the frame.
  Run adjacent WebGL2 nodes in one segment to limit crossings.
- WebGL canvases are usually 8-bit, so float precision is lost at the boundary.
- How each browser performs the copy varies. Measure in Chrome, Safari, and Firefox.

### Video Sources

`device.importExternalTexture()` wraps a `<video>` element or `VideoFrame` as a
texture with no copy. Webcam, video playback, and screen capture get cheaper than
today. The texture is valid for one frame and uses a `texture_external` type that
GLSL translation must handle.

## q5.js

q5.js is a p5-style library with a WebGPU renderer. It is the main path for
p5-style sketches. p5.js stays as the documented slow route for compatibility.

Two modes, following the `canvas` / `canvas.dom` naming:

- `q5`: worker mode. No DOM features. Renders on the shared device with no copies.
- `q5.dom`: main-thread mode. DOM features such as `createSlider` and
  `createCapture` work. Pays a copy per frame.

### Spike Results (q5 4.10.1)

- Device sharing works with two lines and no patch, but through internals:
  set `Q5.device` and `Q5._gpuTask = Promise.resolve(true)`. This skips q5's
  device-limit clamping and its device-loss handler.
- After each frame, `q._texture` is a `GPUTexture` on the shared device. It can be
  sampled with no copy. q5 ping-pongs two textures, so read `q._texture` every frame.
- q5 still blits to its own canvas every frame, which is wasted work.
- q5 runs its own rAF loop. Engine-driven frames need `noLoop()` and `redraw()`.
- q5 does not run in a worker. Its WebGPU core does not need the DOM, but its
  canvas, display, and input modules do.

### What Worker Mode Needs

- Leave out q5's DOM modules.
- Render to an OffscreenCanvas or an engine-provided texture instead of
  `document.createElement('canvas')`.
- A public API to pass in a device and a render target.
- Input forwarded from the main thread into `mouseX`, keys, and so on. Patchies
  already forwards mouse data to worker canvas nodes (`mouseData.ts`).
- Engine-driven frames.

q5 is LGPL, so a modified q5 must be published under the LGPL. Prefer an
upstream issue or pull request first.

## POPs

A `points` wire is a GPU array of records. Its attribute schema is a hybrid, like
Houdini:

- Standard names have fixed types: `P` is `vec3f`, `Cd` is `vec4f`, and also `v`,
  `N`, `age`, and `id`.
- Nodes declare which attributes they read and write. Custom attributes are allowed.
- Patchies merges declarations along the graph and generates the struct and
  binding code.

```wgsl
// @title Heat Diffuse
// @attr read  P vec3f
// @attr write temperature f32

fn update(i: u32) {
  points[i].temperature *= 0.98;
}
```

Node families:

- `pop.compute`: a compute kernel over `points`. Presets cover emitters, forces,
  noise, attractors, collisions, sorting, and trails.
- `render`: draws `points` or `geometry` with a camera and lights into `video`.

## Profiling

The goal is cook-time profiling like TouchDesigner's: CPU time and GPU time per
node, visible on the canvas.

### GPU Time Through Timestamp Queries

WebGPU measures GPU time with the optional `timestamp-query` feature:

1. Request it when creating the device: `requiredFeatures: ['timestamp-query']`.
2. Create a timestamp query set, and give each render or compute pass a
   `timestampWrites` entry. The GPU writes a timestamp when the pass starts and ends.
3. Copy the results into a buffer with `resolveQuerySet`, then read them with
   `mapAsync`, in nanoseconds.

Timestamps measure whole passes. Timestamps written inside a pass were removed from
the standard and exist only as an experimental Chrome extension. Each render graph
node is its own pass, so GPU time per pass is GPU time per node.

Caveats:

- Browsers round timestamps to prevent timing attacks. Chrome rounds them to coarse
  steps, about 100 µs unless a developer flag is on. The canvas spike saw
  quantization of about 65 µs on Metal.
- Apple GPUs overlap and reorder passes, so a pass can report an end before its
  start. The canvas spike discarded about 60–80% of samples for this reason.
- Readback finishes one or more frames after the work, so a node's GPU time is a
  rolling average, not the current frame's.
- Reserve query slots only for passes that are actually encoded. A slot reserved for
  a pass that never runs reads as 0 and corrupts totals.
- The native host can turn off Dawn's timestamp rounding, so it gets precise GPU
  times. This is another advantage of the Dawn-based native host
  ([201](201-rust-native-host.md)).

### Per-Host Coverage

| Measure                                                  | Browser host                                                                                                           | Native host                                                                                                               |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| CPU time per node: user JavaScript and command recording | `performance.now()` around each node's work. The profiler already records per node ([96](96-performance-profiler.md)). | the same                                                                                                                  |
| GPU time per node                                        | rounded, behind the optional feature, and late                                                                         | precise                                                                                                                   |
| Audio time per node                                      | only the whole graph's load through `AudioRenderCapacity`, plus worklets timing their own `process()`                  | each node timed in Rust through web-audio-api-rs. The native host spike timed its JavaScript worklet at 2.6 µs per block. |
| GPU memory per node                                      | estimated from the textures and buffers each node allocates                                                            | the same, plus OS-level totals                                                                                            |

### Showing It

- Cook time drawn on each node as a number or heat color, through a display list
  overlay on the canvas editor ([197](197-canvas-editor-and-dom-islands.md)).
- A profiler panel that sorts nodes by cost.
- How people see these numbers, the cost view, the frame budget bar, the show
  check, and cost tiers per object, is in
  [210. Performance Transparency](210-performance-transparency.md).

### One Profiler per Runtime Instance

Today's profiler is a singleton (`$lib/profiler`). The V2 prototype already had to
inject it instead. Under the no-singletons invariant
([207](207-v2-architecture-invariants.md)), each runtime instance has its own
profiler, so every embed and subpatch instance reports its own costs.

## Lessons From Figma's WebGPU Renderer

Figma moved its C++ renderer from WebGL to WebGPU in 2025
([Figma rendering, powered by WebGPU](https://www.figma.com/blog/figma-rendering-powered-by-webgpu)).
It published no benchmark numbers, but its patterns apply here:

- **Explicit draw state.** Its old interface bound vertex buffers, textures,
  materials, and framebuffers, then called `draw()`, and leftover bound state caused
  bugs. Each draw now names everything it uses:
  `draw(vertexBuffer, framebuffer, textures, material)`. The render graph and the
  painters take this shape from the start, and WebGL2 islands translate it to bound
  state lazily.
- **One uniform buffer per submit.** Writing a buffer for every uniform update is
  slow. Figma records draws with their uniform data, then uploads all of it into one
  buffer at submit, and each draw reads at its own offset. The render core uses a
  per-frame uniform arena with dynamic offsets. It also prevents the V2 prototype's
  bug, where two render passes shared one uniform buffer and cropped the preview.
- **Cache bind groups and merge render passes.** Those were Figma's largest
  remaining wins after the uniform arena.
- **The same GLSL to WGSL route.** Figma rewrites its old GLSL into newer GLSL with
  uniform blocks, then runs Naga, as the preprocessor rewrites above do. Its
  processor also extracts input types and data layouts for the app. Patchies needs
  the same reflection to turn a shader's uniforms into inlets and controls.
- **No synchronous readback, and errors arrive later.** WebGL readback and error
  checks are synchronous. WebGPU's are asynchronous, so captures, exports, and AI
  frame grabs are asynchronous too. Figma rejected blocking compatibility tests at
  startup because they added hundreds of milliseconds.
- **Render bundles,** which Figma lists as future work to cut the CPU cost of
  submitting draws. For Patchies, they fit the editor's cached passes and long
  shader chains (open question below).
- **One renderer, two builds.** Figma builds the same C++ for the browser through
  WebAssembly and natively with Dawn, for server-side rendering, tests, and
  debugging. That matches the two hosts here.

### Device Loss

Figma found that load-time tests cannot catch everything: on Windows, devices were
lost mid-session. Its answer is a fallback that swaps from WebGPU to WebGL during a
session, plus a blocklist by device based on how often the fallback fires.

Patchies has no WebGL fallback for the whole render graph, so the plan is recovery:

- Every GPU resource can be rebuilt from runtime state. Resources belong to their
  instance (invariant 10 in [207](207-v2-architecture-invariants.md)), so a lost
  device means each instance recreates its pipelines and textures on a new device.
  GPU-only state, such as feedback buffers, starts empty again.
- Audio and messages keep running while video recovers, and the editor switches to
  the Canvas 2D painter until the new device is ready
  ([197](197-canvas-editor-and-dom-islands.md#painters)).
- Device loss is tested on purpose with `device.destroy()`, as a fault test in the
  core bar ([208](208-v2-testing-strategy.md#definition-of-done)).
- Startup checks never block loading. They run after the first frame.

## Extras

- Async GPU-to-message readback with `mapAsync`, such as particle count or average
  color, a frame later without stalling.

## Risks

Verify browser support before committing. It may have changed:

- Chrome and Edge desktop are solid. Android depends on the device. Linux has
  historically been partial.
- Safari added WebGPU in Safari 26. Older macOS and iOS have none.
- Firefox gated WebGPU in workers behind `dom.webgpu.workers.enabled`. The render
  worker design depends on workers.
- GPU blocklists, virtual machines, and remote desktops get no WebGPU.
- Headless CI runners usually have no GPU.
- Device loss on sleep or driver reset requires rebuilding every resource.
- Mobile storage buffer and texture limits are much lower than desktop.
- WGSL validation differs between Chrome versions. The spike hit
  `smoothstep(1.2, 0.2, r)` rejected in Chrome 131 but accepted in a newer Chrome.

## Open Questions

- Keep a WebGL2 fallback for the whole render graph, or require WebGPU and keep
  WebGL2 only as islands?
- Can Three's WebGPU renderer and Pixi share the device without internals?
- How much do render bundles cut recording cost for long chains and for the
  editor's cached passes?
- How long does recovery from device loss take with a large patch, and is it fast
  enough during a live performance?

## Related Specs

- [197. Canvas Editor and DOM Islands](197-canvas-editor-and-dom-islands.md): the
  editor drawn on the one canvas.
- [199. Portable Patchies Runtime](199-portable-patchies-runtime.md): running
  the renderer outside the browser.
- [200. Patchies V2 Primitives](200-patchies-v2-primitives.md): the render core
  becomes the `@patchies/renderer` primitive.

## Suggested Order

1. Spike GLSL to WGSL: translate 50 popular Shadertoy shaders and the Hydra output
   with glslang and Tint in WASM. Measure pass rate, compile time, and error mapping.
2. Spike the thread split: the same scene with a heavy q5 sketch and a 200-node
   WGSL chain, with the device on the main thread versus in the render worker.
   Compare UI frame times while panning.
3. Patch q5 for worker mode, or work with upstream.
4. Move the render graph to WebGPU with WebGL2 islands.
5. Add POPs.
