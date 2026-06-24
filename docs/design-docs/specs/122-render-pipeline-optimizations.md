# 122. Render Pipeline Optimizations

Epic spec for performance optimizations inspired by TouchDesigner's cooking model. These are independent improvements that can be implemented incrementally. Each addresses a different bottleneck.

## Context

Today, every visual node re-renders at full resolution every frame, regardless of whether anything changed. Previews render for all visible nodes. All FBOs are RGBA (4 channels). These defaults are correct for simplicity but leave significant performance on the table.

A moderately complex patch (10-20 nodes) runs comfortably at 60fps on an M1 Pro. These optimizations extend that to 30-50+ nodes, or allow heavier shaders per node at the same frame rate.

## 1. Per-Node Resolution

### Problem

A noise generator at 1080p produces 2 million pixels per frame. The noise is smooth and low-frequency — 256×256 looks identical when upscaled by bilinear filtering. But it costs the same as the final output node.

### Solution

Set FBO resolution from code — no UI dropdown. Two mechanisms depending on node type:

**GLSL directive** (same pattern as `@format`):

```glsl
// @resolution 256
// @format rgba32f

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  fragColor = vec4(uv, 0.5, 1.0);
}
```

**JS API** (for Three.js, REGL, P5, SwissGL, Canvas, etc.):

```javascript
setResolution(256); // fixed square: 256×256
setResolution(512, 256); // fixed rectangular: 512×256
setResolution("1/2"); // relative to output: half in each dimension
setResolution("1/4"); // quarter resolution
setResolution("1/8"); // any 1/n divisor works
// default (no call): full output resolution
```

Both mechanisms write to `node.data.resolution`, which the FBO pipeline reads.

| Resolution | FBO size (at 1080p output) | Pixel count | Relative cost |
| ---------- | -------------------------- | ----------- | ------------- |
| full       | 1920×1080                  | 2.07M       | 1×            |
| `'1/2'`    | 960×540                    | 0.52M       | 0.25×         |
| `'1/4'`    | 480×270                    | 0.13M       | 0.06×         |
| `'1/n'`    | output ÷ n                 | varies      | 1/n²×         |
| `256`      | 256×256                    | 0.07M       | 0.03×         |
| `512`      | 512×512                    | 0.26M       | 0.13×         |
| `512, 256` | 512×256                    | 0.13M       | 0.06×         |

Downstream nodes read the texture via `texture(iChannel0, uv)` — WebGL's bilinear sampling upscales automatically, no extra code needed.

### Implementation

**Directive parsing** (GLSL): parse `// @resolution <value>` alongside `@format`, store to `node.data.resolution`. Supports a single number (square) or `w x h`.

**JS API**: `setResolution()` writes to `node.data.resolution` and signals the FBO pipeline to recreate.

**FBO creation** in `fboRenderer.ts`:

```typescript
const resolutionMatchers = {
  full: schema(Type.Literal("full")),
  half: schema(Type.Literal("1/2")),
  quarter: schema(Type.Literal("1/4")),
  customSize: schema(Type.String()),
  squareSize: schema(Type.Number()),
  tupleSize: schema(Type.Array(Type.Number())),
};

const [width, height] = match(node.data.resolution ?? "full")
  .with(resolutionMatchers.full, () => [outputWidth, outputHeight])
  .with(resolutionMatchers.half, () => [outputWidth / 2, outputHeight / 2])
  .with(resolutionMatchers.quarter, () => [outputWidth / 4, outputHeight / 4])
  .with(resolutionMatchers.customSize, (s) => s.split("x").map(Number)) // e.g. '512x256'
  .with(resolutionMatchers.squareSize, (size) => [size, size])
  .with(resolutionMatchers.tupleSize, ([w, h]) => [w, h])
  .exhaustive();
```

FBO fingerprint must include resolution so FBOs are recreated when it changes.

## 2. Cook-on-Demand Caching

### Problem

Every node re-renders every frame. A static noise generator with fixed parameters renders identical pixels 60 times per second. In a typical patch, 30-50% of nodes have no time-dependent inputs and could be skipped.

### Solution

Track whether a node's inputs changed since last frame. If nothing changed, skip the render and keep serving the cached FBO texture from the previous cook.

This should be implemented as a reusable render-worker abstraction, not as GLSL-specific state in `FBORenderer`. GLSL is the first consumer because its dependencies are explicit, but the model should let Hydra, REGL, Three.js, SwissGL, Canvas, Textmode, and future renderers opt in later.

Use TouchDesigner-style language in the implementation:

- **Cook**: execute a node's render function and write a fresh FBO.
- **Cached**: reuse the node's previous FBO output.
- **Dirty**: the node must cook before its output is considered current.
- **Cook reason**: the reason a node became dirty, used for debugging and profiling.

### What "changed" means

A node needs to re-render if ANY of these are true:

- A uniform value changed (slider moved, message received)
- An input FBO was rewritten this frame (upstream node re-rendered)
- The shader uses time-dependent builtins (`iTime`, `iFrame`, `iTimeDelta`, `iDate`)
- The node receives mouse input (`iMouse` active)
- The node uses FFT data
- The node participates in a feedback loop that needs the previous frame to advance
- The graph, output size, FBO format, resolution, or renderer configuration changed
- It is the node's first frame after creation or rebuild

If none are true, the FBO from last frame is still valid. Skip the render.

### Reusable Cook Abstraction

Add a small cook state layer under `ui/src/workers/rendering/`, owned by the render worker. Suggested shape:

```typescript
type CookReason =
  | "first-frame"
  | "force"
  | "config"
  | "uniform"
  | "input"
  | "time"
  | "mouse"
  | "fft"
  | "bitmap"
  | "feedback"
  | "output-size"
  | "renderer-policy";

type CookMode = "always" | "on-demand";

interface CookPolicy {
  mode: CookMode;
  timeDependent: boolean;
  frameDependent?: boolean;
  dateDependent?: boolean;
  mouseDependent: boolean;
  fftDependent: boolean;
  feedbackDependent: boolean;
}

interface CookDecision {
  shouldCook: boolean;
  reasons: CookReason[];
}
```

`CookStateManager` should be responsible for:

- Registering nodes and their `CookPolicy`
- Marking nodes dirty with one or more `CookReason`s
- Marking downstream nodes dirty when an upstream node cooks
- Tracking which nodes cooked in the current frame
- Clearing one-frame dirty reasons after a successful cook
- Reporting cook/cached decisions to the profiler/debug tooling

`FBORenderer` should ask the manager whether to cook each node inside the existing topological render loop:

```typescript
const frameContext = {
  time,
  timeDelta,
  frame,
  mouse,
  transportRunning,
};

cookState.beginFrame(frameContext);

for (const nodeId of sortedNodes) {
  const decision = cookState.shouldCook(nodeId);
  if (!decision.shouldCook) continue;

  const cookStart = performance.now();
  renderFboNode(node, fboNode);
  const cookTimeMs = performance.now() - cookStart;
  cookState.markCooked(nodeId, decision.reasons, cookTimeMs);
}
```

This keeps cooking policy separate from renderer execution. Individual renderers can stay focused on "how to render" and expose only their dependencies.

### Renderer Cook Policies

The first implementation should be conservative:

| Type                             | Initial cook mode                                     | Notes                                                        |
| -------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| `glsl`                           | `on-demand` when no dynamic dependencies are detected | First supported node type                                    |
| `shaderpark`                     | `always` initially                                    | Can opt in after uniform/time/mouse handling is audited      |
| `hydra`                          | `always` initially                                    | Hydra code is stateful and time-oriented                     |
| `three`                          | `always` initially                                    | JS code can access time and mutate scenes implicitly         |
| `regl`                           | `always` initially                                    | JS code can hide dependencies                                |
| `swgl`                           | `always` initially                                    | JS code can hide dependencies                                |
| `canvas`                         | `always` initially                                    | User code may draw from timers, messages, or internal state  |
| `textmode`                       | `always` initially                                    | Stateful runtime                                             |
| `img`, `float.tex`               | externally dirty                                      | Cook only when uploaded bitmap/texture data changes          |
| `send.vdo`, `recv.vdo`, `bg.out` | passthrough/empty                                     | No expensive cook, but downstream invalidation still matters |

Later, JS-based renderers can opt into `on-demand` through explicit APIs or directives such as `setCookMode('on-demand')`, `setStatic(true)`, or `// @static`. Until a renderer declares that it is safe to cache, keep it in `always` mode.

### Time-Dependence Detection

For GLSL, statically detect whether the shader uses time builtins by scanning source after stripping comments and string-like metadata:

- `iTime`: cook while transport time changes. When transport is paused and time is stable, this alone should not force cooking.
- `iTimeDelta`: cook while transport time changes. When paused, it can be cached after a frame with zero delta.
- `iFrame`: cook while the render loop is active because the value increments per rendered frame.
- `iDate`: cook while the render loop is active because wall-clock time changes independently of transport.

Do not scan for generic `time`; it creates false positives and would make innocuous variable names disable caching. JS-based nodes should not use static source scanning for correctness.

### Dirty Propagation

When a node cooks, mark all downstream render nodes dirty with the `input` reason. When a node is clean and all upstream nodes are clean, skip it.

```typescript
// In the render loop
const frameContext = {
  time,
  timeDelta,
  frame,
  mouse,
  transportRunning,
};

cookState.beginFrame(frameContext);

for (const nodeId of sortedNodes) {
  const decision = cookState.shouldCook(nodeId);
  if (!decision.shouldCook) continue;

  const cookStart = performance.now();
  renderNode(nodeId);
  const cookTimeMs = performance.now() - cookStart;
  cookState.markCooked(nodeId, decision.reasons, cookTimeMs);
}
```

Uniform, mouse, FFT, bitmap, and float texture updates should mark the affected node dirty immediately when the worker receives the update message. Graph rebuilds and FBO reallocations should mark affected nodes dirty with `config`, `output-size`, or `first-frame`.

Preview readback should follow the same freshness signal. A node preview may harvest an already-started async read, but it should only initiate a new GPU readback for nodes that cooked in the current frame. Newly enabled previews should also get one initial read so previews do not stay blank if the node cooked before the preview canvas was ready. After that, cached nodes keep displaying the previous preview bitmap until their FBO changes again.

### Feedback Loops

Feedback nodes need special handling. A feedback loop can evolve even when the shader does not use `iTime`, because the previous-frame texture is itself state. If a node reads a back-edge input, mark it dirty when the source feedback texture advanced on the previous frame.

Conservatively, nodes in `renderGraph.feedbackNodes` and nodes with `backEdgeInlets` should cook while the graph is running unless a later pass proves the feedback chain is stable. This preserves existing feedback behavior before trying to optimize it.

### Implementation Phases

1. Add the reusable cook state classes and wire them into `FBORenderer.renderFrame()`.
2. Register all render nodes with conservative policies; most nodes start as `always`.
3. Implement GLSL policy detection and dirty triggers for uniforms, sampler inputs, mouse, FFT, time, code/config, and first frame.
4. Add downstream dirty propagation using the existing render graph outputs.
5. Add debug/profiler counters: cooked frame count, cached frame count, and last cook reasons per node.
6. Add opt-in support for another renderer only after its dependency model is explicit.

### Preview Debug Overlay

`CanvasPreviewLayout.svelte` should support an optional cook-debug overlay at the bottom of the preview area. It is hidden by default and can be toggled on from the preview UI for video nodes that opt into cook diagnostics.

The overlay should show:

- Current status: `cooked`, `cached`, or `paused`
- Last cook time in milliseconds when the node cooked
- Last cook reason list, such as `uniform`, `input`, `time`, `feedback`, or `first-frame`
- A compact cooked/cached frame count when profiling data is available

Cook status must come from the render worker's cook state, not from the Svelte component guessing based on local UI events. `FBORenderer` should emit cook-status messages only while the debug overlay/profiling path is enabled, and then only when a node's displayed status changes or at a throttled interval. This keeps the overlay cheap when hidden by making status signature checks and worker messages opt-in.

### Testing

Test behavior through render-worker state and observable render calls, not source-text guardrails:

- Static GLSL cooks once, then serves the cached FBO on later frames.
- A GLSL uniform change cooks that node and downstream consumers exactly once.
- A clean upstream node does not dirty downstream consumers.
- A shader using `iTime` cooks while transport time advances and can cache while paused.
- A shader using `iFrame` or `iDate` keeps cooking while the render loop is active.
- Mouse and FFT updates dirty the target GLSL node.
- Feedback graphs continue cooking and do not freeze.
- Graph rebuilds preserve existing renderer reuse from spec 107 while forcing the first cook after rebuild.
- The preview cook-debug overlay renders worker-reported status without enabling global profiling.

## 3. Texture Channel Format

### Problem

Every FBO is RGBA (4 channels). A grayscale noise generator writes the same value to all 4 channels — 4× the bandwidth for 1 channel of useful data.

### Solution

Per-node channel format setting. Default: `rgba` (current behavior). Users can reduce to `r`, `rg`, or `rgb` as an optimization when their patch starts to lag.

| Format | Channels | Bandwidth (1080p) | Use case                                |
| ------ | -------- | ----------------- | --------------------------------------- |
| `rgba` | 4        | ~8 MB/frame       | Default. Color + alpha.                 |
| `rgb`  | 3        | ~6 MB/frame       | Color without alpha                     |
| `rg`   | 2        | ~4 MB/frame       | Two-channel data (e.g. UV displacement) |
| `r`    | 1        | ~2 MB/frame       | Grayscale, height maps, masks           |

### Downstream Compatibility — Auto-Swizzle

Without correction, reading an R-format texture returns `vec4(r, 0, 0, 1)` — a red image, not grayscale. Users would need to manually write `vec4(val.r, val.r, val.r, 1.0)` everywhere. That's a footgun.

Fix: when binding a reduced-channel texture to a downstream node's input, apply WebGL2 texture swizzle parameters so it reads naturally:

```typescript
// For R-format textures: broadcast R to all channels
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_SWIZZLE_G, gl.RED);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_SWIZZLE_B, gl.RED);
// Result: texture() returns vec4(r, r, r, 1) — grayscale as expected

// For RG-format textures: R and G pass through, B = 0, A = 1
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_SWIZZLE_B, gl.ZERO);
// Result: texture() returns vec4(r, g, 0, 1)

// For RGB-format textures: A = 1 (already the default)
// Result: texture() returns vec4(r, g, b, 1)
```

This is set once when binding the texture in `fboRenderer.ts`'s texture routing. The format optimization becomes invisible to the user — downstream nodes read the texture normally without knowing it's a reduced format. No shader changes, no user-facing behavior difference.

### Settings UI

Add a "Channels" dropdown to node settings, next to the resolution and FBO format (spec 112) dropdowns. Default: `rgba`. This is an advanced optimization — don't promote it in the UI. It's there for users who need it.

Combined with spec 112, the full FBO format options are:

```
Channels:  rgba | rgb | rg | r
Precision: uint8 | float16 | float32
```

## 4. Preview Optimizations

### Problem

Every visible node renders a preview by reading back pixels from the FBO via PixelReadbackService. This is a GPU→CPU transfer — expensive and serialized. At high zoom levels with many small nodes visible, most previews are barely perceptible but still cost readback time.

### 4a. Zoom-Based Preview LOD ✓

Reduce or skip previews based on canvas zoom level:

| Zoom level                       | Preview behavior                                       |
| -------------------------------- | ------------------------------------------------------ |
| > 80% (few nodes visible, large) | Full preview at full FBO resolution                    |
| 40-80% (moderate view)           | Half-res preview readback                              |
| < 40% (zoomed out, many nodes)   | Skip preview — show last captured thumbnail or nothing |

The FBO pipeline runs at full resolution regardless — only the preview readback changes.

### 4b. Global Preview Toggle ✓

A keyboard shortcut (e.g. `Shift+P`) or toolbar button to disable ALL node previews. During live performance, the audience sees the output — node previews are for the coder's reference. Turning them off saves all readback overhead.

### 4c. Preview Frame Rate Reduction Preview Frame Rate Reduction

Decouple preview readback from the render loop. The FBO pipeline runs at 60fps. Preview readback runs at a lower rate:

| Context          | Preview FPS        |
| ---------------- | ------------------ |
| Selected node    | 60 (full rate)     |
| Visible nodes    | 15-30              |
| Off-screen nodes | 0 (already culled) |

### Implementation

Most of these are changes to `GLSystem.ts` and the preview rendering path, not the core render loop:

- Zoom-based: read zoom level from the xyflow viewport, adjust `setPreviewEnabled` and readback resolution
- Global toggle: `GLSystem.setAllPreviewsEnabled(false)`
- Frame rate: add a frame counter to `PixelReadbackService`, skip readbacks based on target FPS

## Priority

| Optimization               | Impact                         | Effort | Do when                                       |
| -------------------------- | ------------------------------ | ------ | --------------------------------------------- |
| Preview toggle (4b)        | Quick win                      | Tiny   | ✓ Done                                        |
| Preview zoom LOD (4a)      | Moderate                       | Small  | ✓ Done                                        |
| Per-node resolution (1)    | Large for heavy nodes          | Small  | ✓ Done                                        |
| Cook-on-demand caching (2) | Large for static-heavy patches | Medium | Phase 2 — biggest architectural change        |
| Preview frame rate (4c)    | Moderate                       | Small  | Phase 2                                       |
| Channel format (3)         | Small-moderate                 | Small  | Phase 3 — advanced optimization, low priority |

## Dependencies

- Per-node resolution and channel format modify FBO creation — coordinate with specs 105 (MRT) and 106 (float FBOs) to avoid conflicting changes
- Cook-on-demand caching requires spec 107 (render graph diffing) as a foundation — diffing tracks what changed, caching decides whether to re-render
- Preview optimizations are independent of all other specs
