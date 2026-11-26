# 197. Canvas Editor and DOM Islands

Status: Exploration. Nothing is implemented. This file keeps the context of a
design conversation. It is not a committed plan.

## Problem

Adding 1000 buttons to a patch breaks Patchies. Every node is a Svelte component
inside an XYFlow node wrapper. Each node brings handles, DOM event listeners,
reactive subscriptions, and XYFlow measuring. Every edge is an SVG path.

Pure Data draws a box as a few rectangles and a string. Patchies should reach
Pure Data-like editor performance.

WebGPU does not fix this problem. Editor slowness comes from the DOM, not from
WebGL. The WebGPU render core is a separate track, covered at the end of this file.

## Goals

- Smooth pan, zoom, and drag with 100,000 objects.
- A path to 1,000,000 Pd-style primitives, if the runtime gets a data-oriented core.
- Keep rich DOM UI, such as code editors and `dom` or `vue` nodes, where it is
  really needed.

## Layers

The editor has two layers in the same spot:

```
┌─ DOM island layer (top) ───────────────────────────┐
│    CodeMirror, markdown, dom/vue nodes              │  only when DOM is needed
├─ One WebGPU canvas (bottom) ───────────────────────┤
│    1. final patch output, like bg.out today         │
│    2. editor base: node backgrounds, cables         │  drawn in this order
│    3. node video previews as textured quads         │  each presented frame
│    4. editor overlay: borders, handles, labels      │
└─────────────────────────────────────────────────────┘
```

The editor and the final output share one opaque WebGPU canvas. Each presented
frame draws the output first, then the editor passes on top.

This is about merging the editor and the output into one canvas instead of
stacking two. It is separate from which painter draws the editor (see Choosing a
Painter): a small patch without video uses one Canvas 2D canvas, because it has no
output to merge, and the native host always uses WebGPU.

### Why One Canvas

An earlier version used two stacked canvases, one for the output and one for the
editor, so each could update at its own rate. Measurements showed that a
separate canvas costs too much:

- Chrome keeps about 6.5–8 full-screen surfaces per WebGPU canvas: the
  swapchain pool plus compositor and OS buffers. At a 2048×1536 backing size,
  each canvas costs about 85 MB. At 4K it costs about 220 MB, and at 5K about
  450 MB.
- A second canvas doubles that cost.
- The editor canvas had to be transparent to show the output underneath. The
  compositor blended it over the output whenever either changed, so separate
  canvases did not save work.

One canvas costs one set of surfaces. It is opaque, which is cheaper to
composite and easier for Chrome to hand to the OS. While the output is live,
redrawing the editor every frame is cheap, because its static parts are cached.
The spike measured 1–2 ms for a full frame.

The output stays a separate canvas only when it leaves the editor's window,
such as a detached or fullscreen output for projection mapping
([126. Surface Fullscreen Interaction](126-surface-fullscreen-interaction.md)).
In a performance mode that hides the editor, the canvas skips the editor passes.

DOM islands are not GPU surfaces Patchies controls. They stay above the canvas
as real HTML.

### Update Rate

The canvas presents frames only when something needs them. Presenting a frame
costs more than drawing it, so presenting less often saves the most.

- With no live content and no interaction, the canvas presents nothing.
  A static patch of buttons costs 0 renders per second and 0% CPU.
- Only visible live content counts. A preview off-screen, or a node not wired to
  the output, does not keep the canvas presenting.
- The canvas presents at the fastest rate any visible live source needs:
  - previews are capped, like today's 48 fps preview cap;
  - the output runs at the display rate or the patch's render FPS cap;
  - a source can present only when it has a new frame, so a 24 fps video needs
    24 presents per second.
- Pan, zoom, and drag present at the display rate while they last.
  A bang flash presents until its animation ends.
- Message-driven changes, such as a slider receiving 1000 messages per second,
  cause at most one present per display frame.

Presenting and node rendering are separate rates. When the output runs at 60 fps
and a preview source updates at 30 fps, the canvas presents 60 times per second
and draws the preview's last texture again without re-running the node.

WebGPU cannot update part of the screen. `getCurrentTexture()` returns a
swapchain texture whose contents are not kept from the last frame, so each
presented frame draws every pass, from cached textures where possible.

## Editor Canvas

The editor canvas draws boxes, text, cables, handles, and selection.

- Text comes from a glyph atlas.
- Cables draw in one batch.
- Hit-testing uses a spatial index, such as a grid or quadtree, instead of DOM events.
- Panning and zooming changes one camera transform.

### Glyph Nodes

Glyph nodes are fully canvas-drawn and have no DOM. They cover the Pd-style
primitives: object box, message, bang, toggle, number, slider, knob, and video
previews.

Node modules describe how to be drawn instead of being components. A
schema-driven button declares its shape, state, and hit regions. This builds on
[100. Schema-Driven Handles](100-schema-driven-handles.md) and
[168. Runtime Object Editor Representations](168-runtime-object-editor-representations.md).

### Text Editing

Text editing in an object box works like Figma. Double-clicking mounts one real
`<input>` over the box. The input is removed when editing ends.

### Node Previews

Node previews draw in the editor passes, not on a separate layer.

A preview sits inside its node's draw order: above the node background, below
the border, handles, label, and selection outline. Cables and other nodes can
pass over or under it. A separate layer can only be fully above or below the
editor, so it would cover selection outlines or need transparent holes cut in
the editor.

Previews update every frame, but the static UI does not. Each presented frame draws:

1. Output (live, when enabled): the final patch output, full-screen.
2. Base pass (cached): node backgrounds and cables.
3. Previews (live): one quad per visible preview.
4. Overlay pass (cached): borders, handles, labels, and selection.

The cached passes redraw only when something changes. A frame costs about two
quads plus one per visible preview, plus the output when enabled, regardless of
patch size.

Previews and the output sample node textures on the shared GPU device directly,
with no copies.

Overlapping nodes are the edge case. When node B is dragged over node A's
preview, B's background is in the base pass, so A's preview would draw over it.
Two fixes:

- Depth buffer: each node has a z value. Cached passes save depth, and previews
  are depth-tested. This is the robust general fix.
- Live overlaps: draw nodes that overlap a preview in the live pass. This is
  simpler, and overlaps are rare.

## DOM Islands

A DOM island is a small piece of real HTML placed over the canvas-drawn editor,
used only where the canvas cannot do the job well.

### Positioning

All islands live inside one container `<div>`. Each island has a fixed position
in patch coordinates. Camera movement writes one style per frame:

```ts
container.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
```

That single write moves every island. A `transform` change skips layout and
paint, so the browser only moves an existing GPU layer. XYFlow already moves its
viewport this way. Its cost comes from node count, not from the transform.

Each island uses `contain: strict` so layout inside it stays inside its box.

### Lifecycle

| State                              | On screen                                                    | Cost          |
| ---------------------------------- | ------------------------------------------------------------ | ------------- |
| Off-screen                         | Nothing                                                      | Zero          |
| Visible but small (zoomed out)     | Canvas-drawn stand-in: title, code thumbnail, or last bitmap | One draw call |
| Visible and big enough, or focused | Real DOM island with the live component                      | Full DOM cost |

A patch with 50 `js` nodes might have 2 or 3 live CodeMirror instances.

- Mount a limited number of islands per frame. Show the stand-in until the
  island is ready.
- Use separate mount and unmount zoom thresholds so islands do not flicker.
- Swap to the stand-in below a zoom level. A CodeMirror at 10% scale costs as
  much as a full-size one.
- Node authors can set `keepAlive: true` for islands that must keep running
  off-screen. Lazy mounting is the default.

### Island Nodes

- Code editors: `js`, `glsl`, `hydra`, `strudel`, `python`, and the rest.
- Rich content: `markdown`, `sheet`, `iframe`, and settings panels.
- Interactive DOM renderers: `p5`, `canvas.dom`, and `three.dom`. These are the
  `CULLABLE_DOM_TYPES` from
  [134. Viewport Pause Culling](134-viewport-pause-culling-for-main-thread-nodes.md).
  Islands unmount them instead of pausing them.
- `dom` and `vue` nodes. Their UI is always an island.
- Plugins and third-party objects with their own Svelte or HTML UI.
- Object box text editing, which is a temporary island.

### Island Costs

- Draw order: islands always sit above the canvas, so a canvas-drawn node
  dragged over an open editor looks wrong. Show the stand-in while dragging, or
  hide islands that something passes over.
- State: unmounting a CodeMirror loses scroll, cursor, and undo history unless
  that state lives outside the component.
- Events: clicks on an island must not reach canvas hit-testing. Wheel-to-zoom
  must keep working over an island.
- Text re-rasterization: scaled DOM text looks blurry until zooming stops.

## Painters

Node types never call a drawing API. Each returns a display list: a small set of
shape-level drawing commands plus hit regions. A painter turns the display list
into pixels. This is the same split Flutter uses: widgets produce a display list,
and a backend such as Skia or Impeller draws it.

```
node type ──► display list ──┬──► Canvas 2D painter  (small patches)
 (bang,        circles, rects, │
  slider,      lines, text,    └──► WebGPU painter     (large or video patches)
  toggle)      textures, hit regions
```

- The display list is retained. A node describes itself once and again only when
  it changes. Painters keep the result and redraw from it.
- Immediate-mode libraries such as q5.js and p5.js redraw by calling the API for
  every shape every frame. That costs at least one JavaScript call per shape per
  frame, which is the bottleneck that limits the Canvas 2D painter.
- Hit regions come from the same display list. The controller hit-tests the same
  way whichever painter draws.
- The vocabulary stays small: circle, rect, rounded rect, line, polyline, cubic
  bezier, text, and texture. Two painters for a few commands is a small library,
  not a rendering engine.
- Arbitrary paths are not in the vocabulary. A Canvas 2D-like API would force the
  WebGPU painter to tessellate arbitrary paths with correct joins, caps, and
  antialiasing, which is what Skia and CanvasKit exist for.
- Nodes with free-form drawing, such as a custom visualizer, draw into a texture,
  for example with q5.js, and the display list shows it with its texture command.

### Choosing a Painter

The painter is chosen per patch:

- **Canvas 2D** for patches with no video and up to about 20,000 visible nodes:
  lower memory, browser text through `fillText`, and memory that returns when idle.
- **WebGPU** once a patch has a video node or more visible nodes: previews with no
  copies and flat cost up to 1,000,000 nodes.

The switch point is about 20,000 visible nodes at 120 Hz and about 40,000 at 60 Hz.

Text is the hardest command to match. The WebGPU painter rasterizes labels with
Canvas 2D `fillText` into an atlas, so both painters use the browser's text engine.

### Painter Comparison

Measured in Chrome 131 at a 1024×768 viewport with DPR 2, each scene in a fresh
profile. GPU memory is the Chrome GPU process IOSurface total above an empty page.

| One button                | Canvas 2D           | WebGPU                                   |
| ------------------------- | ------------------- | ---------------------------------------- |
| GPU memory while idle     | +13 MB, one surface | +28–40 MB, plus 16 MB for the text atlas |
| Idle again after clicking | +12 MB              | about +100 MB                            |
| CPU while idle            | 0%                  | 0%                                       |
| CPU while clicking        | about 17%           | about 22–25%                             |

| Panning              | Canvas 2D                                                 | WebGPU                                        |
| -------------------- | --------------------------------------------------------- | --------------------------------------------- |
| Up to 20k visible    | 120 fps, about 0.25–0.3 µs of JavaScript per visible node | 120 fps, about 0.1 ms of JavaScript per frame |
| About 33k visible    | 95 fps                                                    | 120 fps                                       |
| About 80k visible    | 27 fps                                                    | 120 fps                                       |
| CPU with 20k visible | about 90% of a core                                       | about 24% of a core                           |

- WebGPU's swapchain pool grows while animating and is not trimmed when idle.
  Unconfiguring the canvas after a few idle seconds frees it, which narrows the
  memory gap.
- The 16 MB text atlas should grow on demand instead of being allocated up front.
- Chrome keeps a full-screen 2D canvas on the GPU, not in CPU memory.
- Repainting only the dirty rect of a flashed button made no measurable
  difference. Chrome still composites and presents the whole canvas.
- Both painters temporarily used about 320 MB more GPU memory while animating at
  120 Hz. This comes from Chrome presenting at display rate, not from either painter.

### Dual-Painter Results

A spike drew 19 Max/MSP-style node types with one display list and both painters,
and diffed the output over a matrix of DPR 1 and 2, six zoom levels, and two
subpixel offsets. It ran in Chrome for Testing 131 on macOS at a 1024×768 viewport
with DPR 2. Results are in `spikes/dual-painter/FINDINGS.md` on branch
`claude/dual-painter-spike-59da6f`.

**Pixel-identical output is not a realistic goal.** Chrome's own Canvas 2D is not
identical to itself: its GPU raster path and CPU raster path differ by up to 139
out of 255 on about 5% of pixels. The WebGPU painter is about as close to Chrome's
on-screen 2D output as the two 2D paths are to each other. Chrome can switch a 2D
canvas from GPU to CPU raster after repeated `getImageData` calls, so the reference
itself moves.

The painter contract is visual equivalence within a measured tolerance:

- per node type, a mean per-pixel difference under 1.5, and under 4% of pixels
  differing by more than 16, averaged over the DPR, zoom, and offset matrix;
- geometry positions, text layout, and hit regions must match exactly.

Every node type passed. Differences are worst at small device scales and subpixel
positions, where most pixels are edge pixels. Only device scale matters: DPR 2 at
zoom z equals DPR 1 at zoom 2z.

| Command                       | Max diff | Cause                                                                     | Verdict                                     |
| ----------------------------- | -------- | ------------------------------------------------------------------------- | ------------------------------------------- |
| circle fill                   | 3        | The SDF coverage matches Skia's GPU circle operation.                     | Matches the GPU raster path                 |
| rect fill                     | 46       | Edge pixels round by ±1. Skia's corner antialiasing is not area coverage. | Fixable to ±1–2 per raster path, not both   |
| rounded rect                  | 85       | Skia's rounded-rect corner antialiasing                                   | Inevitable without reimplementing it        |
| stroked circle, arc           | 77–89    | Skia strokes these through its path renderer                              | Fixable at a cost                           |
| polyline joins                | 126      | Overlapping capsule segments blend twice at joins, visibly with alpha     | Fixable at a cost with real stroke geometry |
| bezier cables                 | 170–204  | Flattening into 24 straight segments leaves notches at zoom 3             | Fixable at a cost with adaptive flattening  |
| text                          | 54–94    | Identical in 12–20 of 24 configurations                                   | Fixable at a cost                           |
| gradient                      | 53       | Skia's interpolation or dithering, ±1–2 across the gradient               | Inevitable, visually equal                  |
| far coordinates (x = 100,000) | 83       | No worse than near the origin                                             | Solved by chunk-relative coordinates        |

What both painters must do the same way:

- Blend sRGB-encoded values. Use an `rgba8unorm` target, not a `-srgb` one.
- Blend premultiplied alpha, and upload the text atlas premultiplied.
- Rasterize text in its final color. A white glyph mask tinted in the shader does
  not match, because Skia's text contrast depends on the paint color.

The final display list vocabulary:

- `rect`, with an optional corner radius and an optional vertical gradient;
- `circle`, `arc` (stroke only, butt caps), and `line` with a cap style;
- `poly` with round joins and caps only;
- `bezier`, with optional dashes for signal cables;
- `text` with a fixed font family, `image`, and hit regions.

Shadows, clipping, transforms, radial gradients, miter and bevel joins, and
per-command opacity were left out. Each costs a WebGPU implementation and a diff
case. Clipping would break the one-draw-per-chunk batching.

Text is the one place to pay for exactness, because people notice blurry labels:

- An exact atlas rasterized at device scale and subpixel phase was identical in
  12 of 24 configurations for 11 px text and within ±1 in 7 more.
- The exact atlas re-rasterizes every visible label on every zoom step, and needs
  the camera snapped to device pixels so panning does not re-rasterize.
- A fixed atlas rasterized once at 4× is cheap but blurrier at fractional zoom.
- Use the exact atlas when the camera rests and the fixed atlas during zoom
  gestures, accepting a visible change when the zoom settles.

Performance, mixed node grid, JavaScript time per frame:

| Nodes     | Scenario                  | Canvas 2D        | WebGPU                         |
| --------- | ------------------------- | ---------------- | ------------------------------ |
| 1,000     | pan                       | 120 fps, 0.44 ms | 120 fps, 0.10 ms               |
| 100,000   | pan, whole grid on screen | 35 fps, 27.9 ms  | 120 fps, 0.22 ms               |
| 1,000,000 | pan, zoom 1               | 120 fps, 0.91 ms | 120 fps, 0.36 ms               |
| 1,000,000 | pan, whole grid on screen | 1 fps, 666 ms    | 117 fps, 0.86 ms               |
| 1,000,000 | slider drag               | 120 fps, 0.89 ms | 120 fps, 0.79 ms, 298 KB/frame |

- WebGPU's advantage is static geometry. With every visible `scope~` animating,
  both painters cost the same, because the cost is generating display lists in
  JavaScript, about 5 µs per scope.
- Choose the painter by visible node count and how much of the screen is static,
  not by total node count. The 2D limit is about 10,000 visible nodes per frame at
  120 fps with these node types.
- Hit-testing took 1.2–1.4 µs at 1,000,000 nodes. Input-to-render latency was
  about one frame for both painters.
- A slider drag in WebGPU re-encodes its whole chunk, about 300 KB. A fixed
  instance slot per node would make it a few hundred bytes.
- Both painters draw chunk by chunk, so z-order holds within a chunk, not across
  chunks, unless chunks are sorted or overlapping nodes move.
- At 1,000,000 nodes, the per-chunk instance buffers take about 133 MB at
  64 bytes per instance. 32 bytes is enough for most kinds.

### Fixed Cost for Tiny Patches

A one-button patch is the worst case for a WebGPU editor canvas. It does almost
nothing but pays for a full-screen surface pool. Ways to shrink the fixed cost:

- Use the Canvas 2D painter, as above.
- Size the canvas to the content instead of the screen, growing it as the patch grows.
- Use an opaque canvas and fewer frames in flight.

The gap matters on phones and 8 GB laptops, where the GPU shares system memory.

## Lines and Curves

Lines rarely match Canvas 2D pixel for pixel. Canvas 2D strokes go through Skia,
which computes exact pixel coverage with its own join and hairline rules. GPU
techniques approximate the same edges differently, so edge pixels differ by a few
levels. The goal is visually equivalent output, as the Dual-Painter Results
section measured.

| Case                       | GPU technique                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Cables (cubic beziers)     | One instance per cable holding 4 control points. The vertex shader evaluates the curve and widens it into a strip.            |
| Scopes and FFT displays    | Upload only the samples each frame to a buffer or 1D texture. A vertex shader builds the line, or a fragment shader draws it. |
| Function and curve editors | Flatten the curve on the CPU only when a point is dragged, then extrude it.                                                   |

- Drawing each segment as a capsule gives round joins and caps for free. With a
  semi-transparent stroke, overlapping joins draw twice and look darker. Opaque
  Max-style lines are fine.
- To match lines exactly, the WebGPU painter can draw a curve into an
  OffscreenCanvas with Canvas 2D `stroke()` and copy it in as a texture. This
  suits rarely changing curves, not hundreds of live scopes.

Prior art, from reading source code only:

- **q5.js** (`src/q5-webgpu.js`) draws thick polylines with round joins as capsules
  (rounded rects with an SDF), thin strokes as plain quads, and circles as an
  enlarged hexagon clipped by an SDF in the fragment shader. It uses 4× MSAA, only
  square caps, and a miter clamp of about 3 half-widths, where Canvas 2D's default
  miter limit is 10. It flattens beziers on the CPU, 20 segments per span, and
  rebuilds and uploads every shape every frame. Its readme says performance comes
  before replicating Canvas 2D.
- **avTools** (`packages/power2d/core/stroke_mesh_generator.ts`) extrudes polylines
  on the CPU with two vertices per point, miter joins clamped to 4×, and no caps.
  Width is applied in a shader.

Neither library aims for Canvas 2D parity.

## Thread Ownership

WebGPU textures cannot cross devices or workers. The render worker owns the GPU
device and the one canvas. The main thread handles input, hit-testing, editor
state, and DOM islands, and sends small state updates to the worker. The worker
draws the editor, previews, and output with no copies.

This follows the UI thread and render thread split that Android, iOS, and Chrome
use. [198. WebGPU Render Core](198-webgpu-render-core.md) covers the split, frame
budgets, and how the editor stays smooth when the video graph is slow.

The cost is that DOM islands move on the main thread while the canvas catches up
in the worker. A camera shared through a `SharedArrayBuffer` limits drift, and
islands can show stand-ins during fast pans.

An earlier lean kept the editor on the main thread. A 200-node shader chain and
heavy q5 sketches would then compete with input on the UI thread.

## Scale Limits

Drawing 1,000,000 instanced quads is easy for the GPU. Most are culled or
smaller than a pixel. The harder limits are elsewhere:

| Limit             | Why it matters                                                | What it takes                                               |
| ----------------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| Memory per object | 1M JavaScript objects at about 200 bytes each is about 200MB. | Store common primitives in typed arrays (struct of arrays). |
| Hit-testing       | Looping over 1M nodes per mouse move is too slow.             | A spatial index.                                            |
| Message routing   | One bang fanned out to 1M receivers is real work.             | Same as Pd: it costs what you patch.                        |
| Save, load, undo  | A 1M-node patch file is tens of MB of JSON.                   | Compact serialization, and undo that records changes.       |
| Text              | 1M labels means many glyphs.                                  | Batch from one glyph atlas. Skip labels when zoomed out.    |

The canvas editor with ordinary JavaScript objects targets about 100,000
objects. 1,000,000 needs a data-oriented runtime core for primitives. The editor
design does not change for it.

## GPU Memory Compared With Today

Measured in Chrome's GPU process (IOSurface totals from `footprint`) at a
1024×768 viewport with DPR 2, a 2048×1536 backing size:

| Scene                                   | GPU memory                                    |
| --------------------------------------- | --------------------------------------------- |
| Empty Patchies patch today              | 26 MB                                         |
| 30 `canvas.dom` nodes at 1280×720 today | 661–719 MB, about 21 MB per node              |
| Same patch, 12 of 30 on screen          | 600 MB                                        |
| 30 `three.dom` nodes today              | 456 MB, with 14 of 30 WebGL contexts lost     |
| One full-screen WebGPU canvas (spike)   | about 118 MB, about 85 MB above an empty page |

- Today, each DOM canvas keeps its full backing size at every zoom level, and
  off-screen canvases still hold most of their memory.
- Browsers cap active WebGL contexts at about 16 per page. Past that, today's
  `three.dom` nodes break instead of slowing down.
- One full-screen canvas costs about the same as 4 `canvas.dom` nodes at this
  backing size. On a 4K screen it costs about as much as 10.

So the canvas has a fixed overhead for tiny patches with no canvas nodes. It
uses far less memory once a patch has several canvas nodes, if those nodes
render into textures on the shared GPU device. Nodes that stay as DOM islands
with their own canvases keep today's cost.

The IOSurface measure may undercount Chrome's raster tiles for DOM content, so
today's editor-only cost may be higher than 26 MB.

## Dependencies

- [40. Headless Patcher System](40-headless-patcher-system.md) must move object
  behavior out of Svelte components before a canvas can draw them. This is the
  real migration, across about 178 objects.
- [27. Decouple XYFlow With Graph](27-decouple-xyflow-with-graph.md) already
  split out the graph model. XYFlow itself would likely go, because it is
  DOM-based throughout.

## Trade-offs

- Accessibility: needs a hidden accessibility tree for screen readers.
- Browser features: IME, text selection, devtools inspection, and Tailwind
  styling are lost for canvas-drawn content.
- E2E tests: tests that click DOM elements break.
- Plugins and custom UI: still possible through islands, but no longer the default.

## Spike Results

Two throwaway spikes measured the editor, both uncommitted in their worktrees:

- Canvas and WebGPU spike: `spikes/canvas-webgpu/FINDINGS.md` on branch
  `claude/canvas-webgpu-spike-1ebcec`.
- XYFlow stress test: `spikes/xyflow-stress/FINDINGS.md` on branch
  `claude/xyflow-stress-test-32545b`.

Both ran on Apple Silicon at DPR 2 with a 120 Hz display. The methods differ, so
compare them roughly.

| Measure                | Canvas and WebGPU spike                         | XYFlow, fully optimized                                  |
| ---------------------- | ----------------------------------------------- | -------------------------------------------------------- |
| Pan zoomed in          | about 1.5 ms per frame up to 100k, 3.8 ms at 1M | 120 fps at every count up to 300k                        |
| Many buttons on screen | 1M on screen: 5.2 ms per frame                  | below 30 fps at 4–5k on screen, unusable at 12k          |
| Memory per node        | 64 bytes on the CPU and on the GPU              | about 20 KB per mounted node                             |
| Idle static patch      | 0% CPU with redraw on demand                    | about zero                                               |
| Hacks needed           | none                                            | userland culling and a private `handleBounds` workaround |

- XYFlow scales with the number of nodes on screen, not the total. Its own
  `onlyRenderVisibleElements` scans every node on every viewport change. Userland
  culling breaks `fitView`, off-screen selection, the minimap, and edges to
  off-screen nodes.
- With 15–17 textarea islands on screen, the canvas spike panned at 120 fps with
  no dropped frames. CodeMirror islands will cost more.
- One live preview at 120 Hz cost 25–40% of a core, mostly from presenting a
  full-screen canvas. Patchies caps previews at 48 fps today, and the update rate
  rules above present only when needed.
- Profiling the real Patchies editor at 1k, 3k, and 10k buttons found its cost in
  paint, not JavaScript. Chrome repaints every mounted node on every pan frame.
  Patchies also hashes every node on every `nodes` change and stringifies the
  whole patch for autosave every 2.5 s, even when nothing changed: 35 ms at 1k
  buttons and 350 ms at 10k. 1,000 buttons panned at 120 fps on an M3 Max and at
  about 40 fps with 4× CPU throttling. Results are on branch
  `claude/nice-volhard-303b5b`, uncommitted.
- The dual-painter spike found pixel-identical output unrealistic and visual
  equivalence achievable. See Dual-Painter Results.

## Near-Term Fixes for Today's Editor

Profiling the real Patchies editor found fixes that help before any canvas editor
exists. Two are safe and are in branch `claude/nice-volhard-303b5b`, uncommitted:

- **Reconciler memo:** remember each node's runtime spec by node object, and reuse
  the graph key when the spec object is identical. This assumes node objects are
  never mutated in place, which holds for `$state.raw` and XYFlow updates. With
  culling, 10,000 buttons pan at 118 fps instead of 43. Without culling, about
  10–15% on drag and click.
- **Autosave skip:** skip autosaves when nodes, edges, files, patch ID, and
  settings are unchanged. This removes a 35 ms stall at 1,000 buttons and 350 ms
  at 10,000, every 2.5 s, while idle or panning.

Measured but not applied:

- **Culling** (`onlyRenderVisibleElements`) unmounts node components, which
  destroys resources views own in `onMount`, such as p5, Hydra, and audio views.
  It needs the headless runtime first. It also hurts zoomed-out panning with edges:
  1,000 buttons and 999 edges at zoom 0.5 fell from 112 to 35 fps.
- **Seeding `handleBounds`** before assigning `nodes` cut mount time at 10,000
  buttons from 2.0 s to 0.33 s, but only matters with culling.
- **`contain: paint` on nodes** doubled pan fps at 3,000 buttons, but clips handles
  and selection glows. Moving handles and glows inside the node box first would
  make it safe, which touches every node type's layout.
- **Explicit node sizes** and **lighter handles** made no measurable difference.
  Patchies already uses `$state.raw` node arrays and saves `measured` sizes.

Follow-ups: defer autosave during an active drag or pan, and reduce the other
O(N) effects on `nodes`, which matter once culling makes `nodes` change often.

## Related Specs

- [198. WebGPU Render Core](198-webgpu-render-core.md): the render graph on
  WebGPU, GLSL translation, WGSL, q5, POPs, and the thread split.
- [199. Portable Patchies Runtime](199-portable-patchies-runtime.md): running
  patches outside the browser. The editor and DOM islands stay in the browser host.
- [200. Patchies V2 Primitives](200-patchies-v2-primitives.md): the canvas
  editor becomes the `@patchies/canvas` primitive.
- [201. Rust Native Host](201-rust-native-host.md): the canvas runs natively
  with the WebGPU painter only.

## Suggested Order

1. Done: profile the 1000-button case. The cost is paint and O(N) effects. See
   Spike Results.
2. Done: spike a canvas editor and an optimized XYFlow. See Spike Results.
3. Done: measure a Canvas 2D variant of the editor canvas. See Painter Comparison.
4. Done: measure divergence between painters per command. See Dual-Painter
   Results.
5. Measure a CodeMirror island layout.
6. Finish the headless runtime.
7. Build the canvas editor with glyph nodes and DOM islands.
