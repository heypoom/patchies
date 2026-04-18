# 134. Viewport Pause Culling for Main-Thread Nodes

## Problem

In a workshop, students created 50+ P5 nodes at once and placed many offscreen. The render worker stayed at 60 FPS, but the main thread lagged badly because every P5, canvas.dom, textmode.dom, and hydra.dom node kept running its `requestAnimationFrame` loop regardless of whether it was visible.

Worker-backed FBO rendering is already culled by `ViewportCullingManager` (`ui/src/lib/canvas/ViewportCullingManager.ts`) → `glSystem.setVisibleNodes()` (wired at `FlowCanvasInner.svelte:241`). The same visibility signal is not being routed to main-thread DOM renderers.

Individual nodes have most of the plumbing already:

- `nodeSetPaused` event on the bus (`events.ts:366`)
- `useNodeSetPaused(nodeId, getPaused, toggle)` hook (`use-node-set-paused.svelte.ts:7`)
- P5CanvasNode wires `noLoop()` / `loop()` via `ObjectPreviewLayout.svelte:78–82`
- WorkerNode, AnuparsNode, MediaPipeNode subscribed

Missing pieces:

1. **No emitter** for viewport-based pause. `nodeSetPaused` today is only fired by `SurfaceOverlay.ts:113,148` on fullscreen surface activation and by the manual pause toggle in `JSBlockNode.svelte:197,203`. Scrolling P5 offscreen does nothing.
2. **Type filter is too narrow.** `FBO_COMPATIBLE_TYPES` (`rendering/types.ts:308`) excludes `p5`, `canvas.dom`, `textmode.dom`, `three.dom`, `hydra.dom` — exactly the DOM-backed main-thread renderers that need pausing.
3. **Stragglers without handlers.** `CanvasDom.svelte`, `TextmodeDom.svelte`, `HydraNode.svelte` (DOM mode) have `requestAnimationFrame` loops but no `useNodeSetPaused` subscription.

## Design

### 1. Add a separate `CULLABLE_DOM_TYPES` list

Don't widen `FBO_COMPATIBLE_TYPES` — it carries a specific meaning (can flow through the FBO pipeline). DOM variants are not FBO-compatible and shouldn't be treated as such downstream.

In `rendering/types.ts`:

```ts
export const CULLABLE_DOM_TYPES: string[] = [
  'p5',
  'canvas.dom',
  'textmode.dom',
  'three.dom',
  'hydra.dom'
];
```

### 2. Extend `ViewportCullingManager` to track DOM nodes separately

The existing manager iterates nodes once and emits a single visible set filtered by `FBO_COMPATIBLE_TYPES`. Extend it to emit two independent sets, each diffed independently, each with its own callback:

```ts
public onVisibleFboNodesChange?: (ids: Set<string>) => void;   // existing behavior
public onVisibleDomNodesChange?: (ids: Set<string>) => void;   // new
```

Rationale for two callbacks instead of one union:

- GL side consumes via `glSystem.setVisibleNodes` — it expects FBO-only.
- DOM side needs a different margin (see §4) and a different throttle tolerance.

Implementation: single pass over `nodes`, two `Set`s built in parallel, each diffed against its own `cachedVisible*` field.

### 3. Emit `nodeSetPaused` from the DOM callback, tracking which pauses we own

The emitter needs a `Set<string>` of nodes it has auto-paused. Without it, we can't tell on re-entry whether a still-paused node is user-paused or viewport-paused, and resuming the wrong way around either leaves nodes frozen forever or overrides the user's intent.

In `FlowCanvasInner.svelte`, alongside the existing FBO wiring:

```ts
let prevVisibleDom = new Set<string>();
const pausedByViewport = new Set<string>();

viewportCullingManager.onVisibleDomNodesChange = (visible) => {
  const eventBus = PatchiesEventBus.getInstance();

  // Visible → hidden: auto-pause only if the user hasn't already paused it.
  for (const id of prevVisibleDom) {
    if (visible.has(id)) continue;

    const node = getNode(id);
    if (node?.data?.paused) continue; // user-paused — leave alone

    eventBus.dispatchEvent({ type: 'nodeSetPaused', nodeId: id, paused: true });
    pausedByViewport.add(id);
  }

  // Hidden → visible: only resume nodes we paused ourselves.
  for (const id of visible) {
    if (prevVisibleDom.has(id)) continue;
    if (!pausedByViewport.has(id)) continue;

    eventBus.dispatchEvent({ type: 'nodeSetPaused', nodeId: id, paused: false });
    pausedByViewport.delete(id);
  }

  prevVisibleDom = visible;
};
```

`useNodeSetPaused` already no-ops when the requested state matches the current state (`use-node-set-paused.svelte.ts:18`), so redundant emissions are safe.

#### `pausedByViewport` invariants

- Only contains node IDs currently paused *because of* viewport culling.
- On node deletion: remove the entry (subscribe to node-removal events, or clean lazily when iterating).
- On manual unpause while offscreen (see §6): the entry must be cleared so the next visible→hidden transition can re-pause the node.

### 4. Use a larger margin for DOM culling

The current `ViewportCullingManager` uses a 100px margin. P5 re-start via `loop()` can stutter on the first few frames after a pan. Add per-consumer margins to the config:

```ts
interface ViewportCullingConfig {
  fboMargin: number;   // 100  — existing behavior, rename from `margin`
  domMargin: number;   // 300  — new
  ...
}
```

Compute bounds twice (cheap — just four arithmetic ops), or expand once with `max(fboMargin, domMargin)` and apply a tighter test per node type. Former is clearer.

### 5. Wire `useNodeSetPaused` into the three stragglers

Follow the WorkerNode pattern (`WorkerNode.svelte:172`):

```ts
let isPaused = $state(false);

function togglePlayback() {
  if (isPaused) {
    isPaused = false;
    startLoop();
  } else {
    isPaused = true;
    cancelAnimationFrame(rafId);
  }
}

useNodeSetPaused(nodeId, () => isPaused, togglePlayback);
```

Targets:

- `CanvasDom.svelte:320` — has a `togglePlayback()` already; just wire the hook.
- `TextmodeDom.svelte:177` — wrap the rAF in a pause-aware start/stop.
- `HydraNode.svelte` (DOM mode only) — existing `togglePause()` at line 253; wire the hook.

### 6. Manual pause interaction

The `pausedByViewport` set in §3 handles the main case: manually paused nodes are left alone on visible→hidden, and only tracked nodes get resumed on hidden→visible. Two edge cases remain:

**Unpause-while-offscreen.** User manually unpauses a node that's currently offscreen (via keyboard shortcut or context menu). `data.paused` flips to false, but visibility hasn't changed, so the culler won't tick. The node runs offscreen, wasting CPU, until the next pan.

Fix: subscribe to `nodeDataCommit` (or equivalent) for the `paused` field on DOM node types. On transition to `false`, check current visibility; if offscreen, emit `paused: true` and add to `pausedByViewport`. No change to node components — the emitter owns this too.

**Pause-while-offscreen.** User pauses a node that's already viewport-paused. `pausedByViewport` still claims ownership. On re-entry we'd resume, overriding the user.

Fix: on `data.paused` commit to `true`, if the node is in `pausedByViewport`, remove it. The user's pause takes ownership.

Both fixes live in `FlowCanvasInner.svelte` alongside the culling wiring — nothing per-node.

## Scope & Non-Goals

- **In scope:** main-thread DOM renderers listed in `CULLABLE_DOM_TYPES`. Worker-backed nodes already benefit from FBO culling and need no change.
- **Not in scope:** audio nodes, message-only nodes, data nodes. Culling them would change behavior, not just performance.
- **Not in scope:** pausing during drag/pan gestures. Existing throttle (`throttleMs: 100`) is sufficient.

## Testing

Manual:

- Create 50 P5 nodes, scroll half offscreen, verify main-thread FPS recovers (Performance Profiler spec 96 shows this).
- Pan a paused-by-user P5 offscreen and back — it should stay paused.
- Pan a visible P5 offscreen and back — it should auto-pause then resume.
- Fullscreen surface activation should still pause DOM renderers (SurfaceOverlay path unchanged).

## File Touch List

- `ui/src/lib/rendering/types.ts` — add `CULLABLE_DOM_TYPES`
- `ui/src/lib/canvas/ViewportCullingManager.ts` — second set + second callback + per-consumer margin
- `ui/src/lib/components/FlowCanvasInner.svelte` — emit `nodeSetPaused` from new callback
- `ui/src/lib/components/nodes/CanvasDom.svelte` — `useNodeSetPaused`
- `ui/src/lib/components/nodes/TextmodeDom.svelte` — `useNodeSetPaused` + rAF start/stop
- `ui/src/lib/components/nodes/HydraNode.svelte` — `useNodeSetPaused` on DOM-mode path
