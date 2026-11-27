# 210. Performance Transparency

Status: Exploration. This spec records how Patchies V2 shows what each node costs.
Nothing here is implemented.

## Problem

A common complaint about Patchies V1 is that nobody knows what adding a node costs,
or which nodes cause a CPU or GPU slowdown.

V1 has three profilers: `ui/src/objects/video/VideoProfiler.ts`,
`ui/src/workers/rendering/RenderingProfiler.ts`, and
`ui/src/workers/shared/WorkerProfiler.ts`, plus the profiler from
[96. Performance Profiler](96-performance-profiler.md). They time work on the CPU
with `performance.now()`, but there is no GPU timing, and the results do not tell a
person which node to replace.

Patchies V2 should make clear:

- **which node types are fast,** such as `glsl` and `wgsl`;
- **which node types are slow,** such as `p5`, which exists for compatibility, and
  what to use instead, such as `q5` when speed matters;
- **which node in a running patch is slow,** on this machine, right now.

V1 also has a naming problem. The split between `canvas` and `canvas.dom` confuses
people who do not know what a render thread or the DOM is. `canvas` runs in a web
worker with fast video chaining. `canvas.dom` runs on the main thread, with DOM
APIs, mouse input, and keyboard events, but a slow CPU-to-GPU copy for video. The
names describe where the code runs, not what it does.

## Principles

- **Measure, do not guess.** Cost tiers and numbers come from benchmarks and live
  measurement, not from opinion.
- **Show the cost where people look.** On the canvas, next to the node, and when
  choosing a node to add.
- **Name objects by what they do,** not by where they run. Explain where something
  runs only when it changes what it costs.
- **Say what is unknown.** Where a host cannot measure something, such as GPU time
  without timestamp queries, show that it is unknown rather than a guess.

## Measuring Every Instance

[198](198-webgpu-render-core.md#profiling) covers how the render core measures:
GPU time per pass through timestamp queries, CPU time per node, audio time, and
which host measures what. This spec uses those numbers. Per instance, Patchies V2
measures:

| Measure              | How                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| GPU time             | timestamp queries per pass, since each render graph node is its own pass. Precise on the native host      |
| CPU time, per thread | time around each node's work on the UI thread, the render worker, and the audio thread                    |
| GPU memory           | the textures and buffers the instance owns                                                                |
| Message rate         | messages per second in and out, which also feeds the delivery guard in [209](209-routing-beyond-wires.md) |
| Where it runs        | the UI thread, the render worker, or the audio thread                                                     |

Attribution comes from the invariants in [207](207-v2-architecture-invariants.md):

- Resources belong to their instance (invariant 10), so every texture, pipeline, and
  audio node already has an owner to charge.
- Each runtime instance has its own profiler (invariant 1), so every embed and
  subpatch instance reports its own costs.

## Showing It

### Cost View

A view of the canvas editor where each node shows its cost, like TouchDesigner's
Probe, which shows cook times across a network:

- each node is tinted by its share of the frame, as a heat color;
- a badge on each node gives its numbers, such as `2.1 ms GPU · 0.3 ms CPU`;
- a subpatch shows the total of everything inside it.

The canvas editor draws this as extra chrome around each node in the display list
([197](197-canvas-editor-and-dom-islands.md)), so the view costs little even on
large patches.

### Frame Budget Bar

At 120 Hz a frame has 8.3 ms. A bar shows how much of the budget each thread uses,
and which nodes use the most of it. "Why is this slow?" becomes a glance instead of
an investigation.

### Show Check

Before a performance, a report for this machine:

- the slowest nodes, by thread;
- the estimated frame time at the display's refresh rate;
- any experimental objects in the patch
  ([207](207-v2-architecture-invariants.md#live-performance-stable));
- anything that runs on the UI thread, since it competes with the editor.

## Teaching It Before a Node Is Added

### Cost Tiers From Benchmarks

Every object type gets a cost tier, such as fast, moderate, or slow, measured by a
benchmark in CI as part of the performance budgets in
[208](208-v2-testing-strategy.md). A tier is a measurement, so it changes when the
object gets faster or slower, and a regression fails the build.

The benchmark measures a typical use of the object, such as one `glsl` pass at a
fixed resolution, or one `p5` sketch drawing a set number of shapes.

### In the Object Browser

- The object browser shows each object's tier when someone adds a node.
- Where a faster equivalent exists, it says so with a measured number: for example,
  "p5 is for compatibility. q5 runs the same sketch about N times faster."
- Where the conversion is safe, it offers to convert in one step, such as turning a
  `p5` node into `q5` when the sketch only uses APIs q5 supports.

## One Object, Placement From Capabilities

Instead of `canvas` and `canvas.dom`, V2 has one `canvas`. Where it runs follows the
capabilities its code asks for (invariant 7):

- **By default it runs in the render worker,** with fast video chaining.
- **If its code asks for page features,** such as DOM elements or browser-only APIs,
  it runs on the UI thread, and its video is copied to the GPU.

Two things make this simpler in V2 than in V1:

- **Pointer and keyboard input no longer need the DOM.** The canvas controller
  routes input to nodes ([197](197-canvas-editor-and-dom-islands.md)), so a worker
  canvas can be interactive. In V1, input was one of the main reasons to choose
  `canvas.dom`.
- **Placement is visible in the cost view.** When a node runs on the UI thread, the
  cost view says so in plain words, for example: "This canvas uses page features, so
  it runs alongside the editor. Heavy drawing can make dragging stutter."

Placement is decided when the code loads, from what it asked for. A node never moves
between threads while running, because a silent move would be surprising and hard
to debug.

The same rule could merge V1's other `.dom` pairs, such as `three.dom`, `pixi.dom`,
and `textmode.dom`, as they come back to V2.

## Hard Parts

- **Timestamp queries are optional.** Some browsers and devices do not offer them,
  and Chrome rounds them to about 100 µs (198). The cost view must say when GPU time
  is unavailable or coarse.
- **Measuring has a cost.** Timestamp queries and per-node timing add overhead.
  Detailed measurement may need to be on demand, with cheap totals always on.
- **Tiers depend on the machine.** A tier from CI hardware may not match a laptop.
  The show check measures on the performer's machine, and tiers stay relative:
  fast and slow compared with other objects.
- **Detecting page features in user code.** Placement works when code asks for
  capabilities explicitly. Code that reaches for `document` directly would need a
  static check or a clear error in the worker.

## Open Questions

- Which tiers, and what thresholds separate them?
- Is the cost view a mode, an overlay that can stay on, or both?
- Should the show check be able to fail a patch, for example when estimated frame
  time exceeds the budget?
- How does the cost view show audio, where per-node timing exists only on the native
  host?
- Does `p5` stay as an object at all, or only as a conversion path to `q5`?

## Related Specs

- [96. Performance Profiler](96-performance-profiler.md): V1's profiler.
- [197. Canvas Editor and DOM Islands](197-canvas-editor-and-dom-islands.md): the
  display list overlay and input routing.
- [198. WebGPU Render Core](198-webgpu-render-core.md#profiling): how GPU and CPU
  time are measured.
- [207. V2 Architecture Invariants](207-v2-architecture-invariants.md): invariants
  1, 7, and 10, and the live-performance rule.
- [208. V2 Testing Strategy](208-v2-testing-strategy.md): performance budgets.
- [209. Routing Beyond Wires](209-routing-beyond-wires.md): the per-node rate guard.
