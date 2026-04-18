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

---

## Implementation Plan

### Corrections against the Design section

Grounded against the actual codebase, a few items in the Design section are slightly off and get corrected during implementation:

1. **`hydra.dom` does not exist.** `ui/src/lib/nodes/node-types.ts:117` maps `hydra` to `HydraNode`, which is already worker-backed (uses `GLSystem`, receives bitmaps from the render worker). FBO culling already handles it. Drop `hydra.dom` from `CULLABLE_DOM_TYPES`; skip the HydraNode edit in the File Touch List.
2. **Event bus API is `dispatch`, not `dispatchEvent`.** See `SurfaceOverlay.ts:113,148`. Use `eventBus.dispatch({ type: 'nodeSetPaused', ... })`.
3. **`three.dom` has no pause path yet.** `ThreeDom.svelte` has no `data.paused`, no `togglePlayback`, and no intercept over the user's rAF loop (unlike `CanvasDom.svelte:410–426`). Including it in `CULLABLE_DOM_TYPES` is harmless (`useNodeSetPaused` just isn't wired, events no-op), but it won't actually pause until the CanvasDom-style rAF wrapping is added. Treat as a v1 follow-up — list it in cullable types, but do not attempt to wire pause in this pass. Add a TODO note at the declaration.
4. **`TextmodeDom` has no `data.paused` field or toggle button today.** Both need to be added alongside the hook — it's not literally "just wire the hook."
5. **No `nodeDelete` event exists.** Prune `pausedByViewport` lazily inside the cull callback by intersecting against the set of live node IDs the culler just iterated. No new event subscription needed.

### Step 1 — `rendering/types.ts`

Add after `FBO_COMPATIBLE_TYPES` (line 320):

```ts
// DOM-backed main-thread renderers that should be auto-paused when offscreen.
// Note: three.dom is listed but lacks a pause mechanism today — pausing it
// requires wrapping the user's rAF loop (see CanvasDom.svelte pattern). Until
// that's added, events for three.dom nodes are no-ops.
export const CULLABLE_DOM_TYPES: string[] = [
  'p5',
  'canvas.dom',
  'textmode.dom',
  'three.dom'
];
```

### Step 2 — `ViewportCullingManager.ts`

Minimal refactor keeping the single-pass iteration:

- Rename config `margin` → `fboMargin`; add `domMargin` (default `300`). Keep `DEFAULT_CONFIG` sensible.
- Add `CULLABLE_DOM_TYPES` import.
- Add field `private cachedVisibleDomNodes: Set<string> = new Set();`
- Add field `public onVisibleDomNodesChange?: (visible: Set<string>, liveIds: Set<string>) => void;` — the second arg lets the callback prune stale entries in its own ledger.
- Rename existing `onVisibleNodesChange` → `onVisibleFboNodesChange`. Grep shows only one caller (`FlowCanvasInner.svelte:241`).
- In `updateVisibleNodes`: compute two bounds (one per margin), build two `Set<string>`s in a single pass, diff each against its own cache, fire each callback independently.
- In `destroy()`: clear both callbacks and both cached sets.

Performance: per-cull-tick cost goes from O(N) to O(N) (same loop, two membership tests per node). Negligible.

### Step 3 — `FlowCanvasInner.svelte`

Alongside the existing FBO wiring (line 241), add the DOM wiring. Use `getNode` (already destructured at line 235) to read current pause state; use `PatchiesEventBus` (already imported at line 75).

```ts
let prevVisibleDom = new Set<string>();
const pausedByViewport = new Set<string>();
const eventBus = PatchiesEventBus.getInstance();

viewportCullingManager.onVisibleDomNodesChange = (visible, liveIds) => {
  // Visible → hidden: auto-pause only if user hasn't already paused.
  for (const id of prevVisibleDom) {
    if (visible.has(id)) continue;

    const node = getNode(id);
    if (!node) continue;
    if (node.data?.paused) continue; // user-paused — leave alone

    eventBus.dispatch({ type: 'nodeSetPaused', nodeId: id, paused: true });
    pausedByViewport.add(id);
  }

  // Hidden → visible: only resume nodes we paused ourselves.
  for (const id of visible) {
    if (prevVisibleDom.has(id)) continue;
    if (!pausedByViewport.has(id)) continue;

    eventBus.dispatch({ type: 'nodeSetPaused', nodeId: id, paused: false });
    pausedByViewport.delete(id);
  }

  // Prune stale entries for deleted nodes.
  for (const id of pausedByViewport) {
    if (!liveIds.has(id)) pausedByViewport.delete(id);
  }

  prevVisibleDom = visible;
};
```

Handle the two edge cases from §6 by subscribing to `nodeDataCommit` (events.ts:353) for the `paused` key:

```ts
function handlePausedCommit(e: NodeDataCommitEvent) {
  if (e.dataKey !== 'paused') return;

  const node = getNode(e.nodeId);
  if (!node || !node.type) return;
  if (!CULLABLE_DOM_TYPES.includes(node.type)) return;

  // Pause-while-offscreen: user takes ownership; drop our claim.
  if (e.newValue === true && pausedByViewport.has(e.nodeId)) {
    pausedByViewport.delete(e.nodeId);
    return;
  }

  // Unpause-while-offscreen: if offscreen now, re-pause ourselves.
  if (e.newValue === false && !prevVisibleDom.has(e.nodeId)) {
    eventBus.dispatch({ type: 'nodeSetPaused', nodeId: e.nodeId, paused: true });
    pausedByViewport.add(e.nodeId);
  }
}

eventBus.addEventListener('nodeDataCommit', handlePausedCommit);
// Unregister in destroy block (line ~734 alongside viewportCullingManager.destroy()).
```

Caveat: `nodeDataCommit` is fired by `useNodeDataTracker` only for changes the user makes through tracked components. A direct `updateNodeData({ paused: true })` call that doesn't go through the tracker won't fire the event. Today, P5CanvasNode.svelte:176,180 and CanvasDom.svelte:317,327 call `updateNodeData` directly for pause toggles, so the commit event is NOT currently fired on user pause clicks. That means the §6 edge case fixes won't trigger today.

Two options:

- **A. Fire the commit manually from the pause buttons** in P5CanvasNode and CanvasDom. One line each: `eventBus.dispatch({ type: 'nodeDataCommit', nodeId, dataKey: 'paused', oldValue: <prev>, newValue: <next> })`. Minimal, but spreads the contract across components.
- **B. Subscribe to SvelteFlow node changes** via `onnodeschange` in FlowCanvasInner and derive the `paused` commit from the prev/next nodes snapshot. Centralizes the logic.

Recommend **A** for v1 — two-line change, and it makes the pause buttons properly participate in the history/tracking bus if anything else wants to listen.

### Step 4 — `CanvasDom.svelte`

`data.paused` and `togglePlayback()` already exist (lines 39, 314). Add:

```ts
import { useNodeSetPaused } from '$lib/canvas/use-node-set-paused.svelte';

useNodeSetPaused(
  nodeId,
  () => !!data.paused,
  togglePlayback
);
```

Also implement Step 3 option A for both pause branches of `togglePlayback` (lines 317, 327): dispatch `nodeDataCommit` with `dataKey: 'paused'`, old/new boolean.

### Step 5 — `TextmodeDom.svelte`

Larger edit since no pause plumbing exists. Add `paused?: boolean` to the data type (line 32); add a `togglePlayback` that calls `tm?.noLoop()` / `tm?.loop()` and updates `data.paused`; start/stop bitmap loop accordingly; wire the `useNodeSetPaused` hook; pass `paused` and `onPlaybackToggle` and `showPauseButton={true}` to `CanvasPreviewLayout` (same props `CanvasDom.svelte:491–493` uses).

```ts
function togglePlayback() {
  if (data.paused) {
    updateNodeData(nodeId, { paused: false });
    tm?.loop();
    startBitmapLoop();
  } else {
    updateNodeData(nodeId, { paused: true });
    tm?.noLoop();
    stopBitmapLoop();
  }
  // Step 3 option A: dispatch nodeDataCommit for paused.
}

useNodeSetPaused(nodeId, () => !!data.paused, togglePlayback);
```

Edge case: if `tm` is not yet initialized when a pause event arrives (rare — only during startup race), the hook still flips `data.paused`. The bitmap loop check `if (tm?.isLooping) sendBitmap()` (line 175) keeps this safe; `runCode()` will consult `data.paused` on next call.

One runCode() behavior to audit: lines 336–337 call `tm.loop()` to recover from errors. Guard that against `data.paused` so we don't silently un-pause on code re-run:

```ts
if (hadErrors && !tm.isLooping() && !data.paused) {
  tm?.loop();
}
```

### Step 6 — `ThreeDom.svelte` — skip in v1

Listed in `CULLABLE_DOM_TYPES` for forward compat, but no wiring this pass. File removed from the File Touch List. Follow-up: mirror CanvasDom's rAF wrapper pattern (CanvasDom.svelte:410–426) to intercept `requestAnimationFrame` calls from user code and short-circuit when `data.paused`.

### Step 7 — P5CanvasNode pause commit dispatch

Add `nodeDataCommit` dispatch to the two `updateNodeData({ paused: ... })` calls at `P5CanvasNode.svelte:176,180` (per Step 3 option A). No hook change needed — it's already wired via `ObjectPreviewLayout.svelte:78–82`.

### Revised File Touch List

- `ui/src/lib/rendering/types.ts` — add `CULLABLE_DOM_TYPES`
- `ui/src/lib/canvas/ViewportCullingManager.ts` — rename `margin`→`fboMargin`, add `domMargin`, second visible-set + callback, rename `onVisibleNodesChange`→`onVisibleFboNodesChange`
- `ui/src/lib/components/FlowCanvasInner.svelte` — wire new DOM callback, `pausedByViewport` set, `nodeDataCommit` subscription, update callback rename
- `ui/src/lib/components/nodes/CanvasDom.svelte` — wire `useNodeSetPaused`, dispatch `nodeDataCommit` in `togglePlayback`
- `ui/src/lib/components/nodes/TextmodeDom.svelte` — add `paused` field, `togglePlayback`, pause button prop, wire `useNodeSetPaused`, guard `runCode` error-recovery path, dispatch `nodeDataCommit`
- `ui/src/lib/components/nodes/P5CanvasNode.svelte` — dispatch `nodeDataCommit` in `togglePlayback`

### Build & Verify

Per CLAUDE.md: user starts `bun run dev`. Run `bun run check` and `bun run lint` after edits. Manual tests per Testing section. Do not run tests / commit without explicit user request.

### Risks

- **Cull tick starvation.** The culler only re-runs when the viewport changes (`FlowCanvasInner.svelte:381–398`). If the user drags a visible node offscreen by moving the *node* (not the viewport), visibility isn't re-evaluated — the node keeps running. Out of scope for this spec, but worth flagging.
- **Initial load timing.** On patch load, the culler's first tick fires after the first viewport effect runs. Offscreen nodes run briefly before being paused. Acceptable; matches FBO behavior.
- **P5 resume stutter.** The 300px DOM margin helps but doesn't eliminate. If perceptible, tune upward or investigate P5 warm-start behavior — not blocking.
