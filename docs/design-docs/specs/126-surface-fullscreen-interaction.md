# 126. Surface — Fullscreen Interaction Node

## Overview

`surface` is a fullscreen transparent canvas overlay for mouse and touch interactivity in Patchies.
It enables live performance scenarios where the user draws, paints, or interacts with the canvas
in fullscreen — while the FBO video pipeline continues rendering underneath.

## Problem

Patchies has no way to capture pointer/touch input at fullscreen scale today. DOM-renderer nodes
(P5, canvas.dom, textmode.dom, three.dom) render to small preview canvases inside the node editor.
There is no mechanism to paint/draw/select across the full screen during a performance.

## Design

### Core Concept

`surface` is a fullscreen `canvas.dom` variant:

- Creates a **fullscreen transparent canvas** fixed to the browser viewport (no node-editor chrome)
- Captures all pointer and touch events from the full screen
- Runs user code on the **main thread** using the Canvas 2D API — zero interaction lag
- **Auto-freezes all DOM-renderer nodes** on activation (they are now invisible behind the overlay)
- **FBO pipeline keeps running** — renders to the background canvas, visible through the transparent overlay

### DOM-Renderer Nodes (auto-frozen on surface activation)

These render to their own canvas elements and are occluded by the fullscreen overlay:

- `p5`
- `canvas.dom`
- `textmode.dom`
- `three.dom`

FBO-renderer nodes (`hydra`, `regl`, `glsl`, `swgl`, `canvas`, `three`, `textmode`) are unaffected.

### Three States

| State        | Canvas                           | XYFlow                  | Description                                             |
| ------------ | -------------------------------- | ----------------------- | ------------------------------------------------------- |
| `preview`    | inline in node (like canvas.dom) | visible                 | **Default.** Interactive canvas inside the node editor. |
| `fullscreen` | fullscreen overlay               | hidden (`display:none`) | Full interaction mode. DOM-renderer nodes frozen.       |
| `stopped`    | none                             | visible                 | Paused/stopped. Performance optimization, not default.  |

**State transitions:**

- `preview` → `fullscreen`: click **Go Live** button on node / send `bang` / call `activate()`
- `fullscreen` → `preview`: press **Escape** / click floating exit badge / send `{type: 'exit'}` / call `deactivate()`
- `preview` ↔ `stopped`: click **Stop/Play** button on node (pause canvas to save CPU)

Escape always returns to `preview`, never to `stopped`.

---

## User-Facing API

Available globals inside the code editor (same as `canvas.dom`):

```js
canvas // HTMLCanvasElement — always at fullscreen resolution (window.innerWidth × window.innerHeight)
ctx    // CanvasRenderingContext2D
width  // = window.innerWidth  (constant regardless of preview vs fullscreen mode)
height // = window.innerHeight (constant regardless of preview vs fullscreen mode)
mouse  // { x, y, down, buttons } — normalized 0–1 coords
```

In `preview` mode the canvas is CSS-scaled down to fit the node (same `PREVIEW_SCALE_FACTOR`
pattern as `canvas.dom`). `width`/`height` always report fullscreen dimensions so user code
behaves identically in both modes.

### Draw Modes

`draw` is a magic named function — define it and the runner calls it automatically on each
rAF frame (same pattern as `canvas.dom`):

```js
function draw() {
  ctx.clearRect(0, 0, width, height)
  // draw your frame here
  requestAnimationFrame(draw)
}

draw()
```

```js
setDrawMode('always')   // rAF loop — redraws every frame (default)
setDrawMode('interact') // redraws only on pointer/touch events — saves CPU when idle
setDrawMode('manual')   // user calls redraw() explicitly
```

```js
redraw() // trigger one draw pass (useful in manual mode)
```

### Video Output

```js
noOutput() // disable CPU→GPU texture copy (default: enabled, same as canvas.dom)
```

CPU→GPU copy is expensive. Call `noOutput()` if you don't need to composite the overlay
into the FBO pipeline.

### Surface Activation

```js
activate() // enter fullscreen state: show overlay, hide XYFlow, freeze DOM-renderer nodes
deactivate() // return to preview state: remove overlay, restore XYFlow and frozen nodes
```

Messages also trigger these:

```js
// bang or { type: 'activate' } → calls activate()
// { type: 'exit' }             → calls deactivate()
```

### Browser Fullscreen (optional)

```js
goFullscreen() // call document.documentElement.requestFullscreen()
exitFullscreen() // call document.exitFullscreen()
```

`surface` does NOT auto-fullscreen on activation. Use `goFullscreen()` explicitly,
or combine with activation:

```js
recv((msg) => {
  if (msg.type === 'live') {
    activate()
    goFullscreen()
  }

  if (msg.type === 'exit') {
    deactivate()
    exitFullscreen()
  }
})
```

### Interaction Callbacks

```js
onPointer((event) => {
  // event: { x, y, pressure, buttons, type: 'down'|'move'|'up' }
  // coordinates normalized 0–1
})

onTouch((touches) => {
  // touches: Array<{ x, y, pressure, id }>
  // coordinates normalized 0–1
})
```

### Message Outlets

| Outlet    | Type    | Description                                                                  |
| --------- | ------- | ---------------------------------------------------------------------------- |
| `pointer` | message | `{ x, y, pressure, buttons, type }` on every pointer event                   |
| `touch`   | message | `[{ x, y, pressure, id }, ...]` on every touch event                         |
| `video`   | video   | Overlay canvas as FBO texture (only present when `noOutput()` is NOT called) |

### Other APIs (inherited from canvas.dom)

```js
setPortCount(inlets, outlets)
setTitle(title)
noInteract()   // disable drag/pan/wheel on the node itself
noDrag()
noPan()
noWheel()
recv((msg) => { ... })
send(outlet, msg)
```

---

## Example Usage

```js
// Draw red rectangles wherever the user clicks
setDrawMode('interact')

onPointer((e) => {
  if (!e.down) return
  ctx.fillStyle = 'rgba(255, 0, 0, 0.5)'
  ctx.fillRect(e.x * width - 25, e.y * height - 25, 50, 50)
  redraw()
})
```

```js
// Flower blooms performance: send pointer position as messages,
// receive bloom regions back from a JS node
setDrawMode('interact')
noOutput()

onPointer((e) => {
  if (e.type === 'down') send(0, {x: e.x, y: e.y})
})
```

---

## Implementation Plan

### 1. Overlay Canvas Management (`SurfaceOverlay.ts`)

Singleton that manages the fullscreen canvas:

- Creates a `<canvas>` fixed to viewport (`position: fixed; inset: 0; pointer-events: all; z-index: [above video, below XYFlow]`)
- Resizes on `window.resize`
- Tracks active `surface` node ID — last activated wins (previous surface node is effectively displaced but not destroyed)
- `activate(nodeId)` / `deactivate(nodeId)`

### 2. DOM Renderer Freeze (`SurfaceOverlay.ts`)

Uses the existing `pauseObject`/`unpauseObject` mechanism — dispatches `nodeSetPaused` events
via `PatchiesEventBus` (same API exposed in `js-integrations`).

On `activate()`:

- Enumerate all nodes in the current patch
- For any node whose type is in `DOM_RENDERER_TYPES = ['p5', 'canvas.dom', 'textmode.dom', 'three.dom']`, dispatch `{ type: 'nodeSetPaused', nodeId, paused: true }`
- Store frozen node IDs for later restoration

On `deactivate()`:

- Dispatch `{ type: 'nodeSetPaused', nodeId, paused: false }` for only the nodes frozen by this activation

### 3. `Surface.svelte` Component

Based on `CanvasDom.svelte` with these differences:

- Canvas element is the overlay canvas from `SurfaceOverlay`, not an inline preview canvas
- `setDrawMode()` added to `extraContext`
- `onPointer()` / `onTouch()` added to `extraContext`
- `pointer` and `touch` message outlets added
- On mount: calls `SurfaceOverlay.activate(nodeId)`
- On destroy: calls `SurfaceOverlay.deactivate(nodeId)`
- Preview thumbnail: live scaled `drawImage` copy from overlay canvas each frame; hidden when `document.fullscreenElement` is active (no point rendering the thumbnail you can't see)
- **NodeResizer** enabled with `keepAspectRatio: true`, locked to the aspect ratio of `window.innerWidth / window.innerHeight`. This ensures the preview always matches the proportions of the fullscreen output — no surprises when going live. The inline canvas dimensions are derived from the node's resized width/height.

### 4. Node Registration

- `src/lib/nodes/node-types.ts` — add `'surface'`
- `src/lib/nodes/defaultNodeData.ts` — add default data
- `src/lib/components/object-browser/get-categorized-objects.ts` — add to Visual category
- `src/lib/ai/object-descriptions-types.ts` — add to OBJECT_TYPE_LIST
- `src/lib/ai/object-prompts/` — add `surface.ts` prompt + register in `index.ts`
- `src/lib/extensions/object-packs.ts` — add to Visual pack
- `static/content/objects/surface.md` — documentation

### 5. Z-Index Layer Order

```
z-index:
  XYFlow HTML canvas (node editor)   ← top
  surface overlay canvas             ← new layer
  video output canvas (background)   ← existing
```

The overlay must be above the video output but below the XYFlow layer when the node editor
is visible. In performance/fullscreen mode, XYFlow may be hidden entirely.

### 6. XYFlow Sleep During Fullscreen

XYFlow has no continuous rAF draw loop — it's reactive/event-driven. However the XYFlow
container still participates in browser paint and compositing (SVG edges, Svelte reactivity)
even when not visible.

On `SurfaceOverlay.activate()`: set a Svelte store `isFullscreenActive = true`, bind
`display: none` on the XYFlow wrapper element to this store. This removes XYFlow from paint
and compositing entirely without destroying component state.

On `SurfaceOverlay.deactivate()`: set `isFullscreenActive = false` to restore the node editor.

Do NOT unmount/destroy the XYFlow component — `display: none` is sufficient and avoids
state loss.
