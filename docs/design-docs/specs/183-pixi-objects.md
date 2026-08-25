# 183. PixiJS 8 Objects

## Goal

Add `pixi` as a worker-side, render-graph-compatible PixiJS 8 object and
`pixi.dom` as its interactive main-thread counterpart.

## First version

`pixi` owns a Pixi WebGL renderer that shares the render worker's WebGL2
context. It renders the user's `stage` into a Pixi RenderTexture, blits that
texture into its Patchies FBO, calls `resetState()` before Pixi work, and
refreshes regl state afterward. The Patchies render loop calls `draw(time)`;
Pixi's ticker is not used.

`pixi.dom` owns an HTML canvas and uses Pixi's native event system. It is kept
separate from the worker context so Pixi can receive browser pointer events.
It exposes `setCanvasSize()`, `setFluidSize()`, and `onCanvasResize()` with the
same sizing semantics as `canvas.dom`; a resize updates Pixi's renderer and
the copied video-output bitmap. Its preview uses the shared capped preview
dimensions so main-thread and render-worker nodes have the same default size.

The first DOM version exposes Pixi's normal canvas, stage, renderer, optional
`draw(time)` callback, and sizing APIs. It supports one copied video output;
Patchies message APIs, settings, keyboard helpers, and dynamic ports can be
added once the core event and lifecycle path has settled.

`pixi.dom` uses a shared Pixi application with Pixi's `multiView` renderer
option. The application owns one off-DOM WebGL context; every `pixi.dom` node
registers a separate stage and display canvas, and the manager renders those
stages sequentially into their respective canvases. This prevents a patch with
many DOM nodes from exhausting the browser's WebGL-context budget.

The shared manager owns Pixi's event system as well. Before it forwards an
event from a node canvas, it sets that node's stage as the renderer's current
event root and temporarily targets the node canvas for coordinate conversion.
This preserves Pixi's normal scene-graph events while keeping pointer routing
isolated to the relevant node. `resetState()` is not used to multiplex Pixi
stages; it is only necessary when foreign WebGL renderers share a context.
`pixi.dom` participates in DOM viewport culling: offscreen and user-paused
nodes skip their draw and render work, and resume without recreating their
stage or shared context.

Running code again clears and destroys the previous children of that node's
stage, then evaluates the new code in the same shared application. It must not
recreate a WebGL context as part of a code rerun.

The initial worker object has one video output and no video-texture input.
Resource cleanup must destroy the Pixi renderer, stage, and RenderTexture.
