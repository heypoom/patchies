# 134. Viewport Pause Culling for Main-Thread Nodes

Status: Implemented as viewport pause culling. Still a bridge toward full view virtualization.

Last verified against code: 2026-07-06.

## Problem

Large patches can contain many expensive DOM renderers. Their main-thread loops
can continue when nodes are offscreen and make the editor slow.

Worker-backed FBO rendering already uses `ViewportCullingManager` and
`glSystem.setVisibleNodes()`. DOM renderers need a separate path. They are not
FBO-compatible, and they do not need the render graph only to pause local loops.

This spec pauses offscreen DOM renderers. It does not enable XYFlow
`onlyRenderVisibleElements`. Full view destruction and creation needs the headless
object lifecycle in [40. Headless Patcher System](40-headless-patcher-system.md)
and [167. Modular Patchies Roadmap](167-modular-patchies-roadmap.md).

## Current Implementation

`ui/src/lib/rendering/types.ts` defines two separate renderer sets:

- `FBO_COMPATIBLE_TYPES` for worker/FBO graph culling;
- `CULLABLE_DOM_TYPES` for DOM-backed main-thread renderer pause culling.

Current DOM-cullable types:

```ts
['p5', 'canvas.dom', 'textmode.dom', 'three.dom']
```

`ui/src/lib/canvas/ViewportCullingManager.ts` tracks visible nodes separately:

- `onVisibleFboNodesChange(visible)` emits visible FBO node IDs;
- `onVisibleDomNodesChange(visible, liveIds)` emits visible DOM-cullable node IDs and all live DOM-cullable IDs.

The manager computes separate FBO and DOM viewport bounds, builds both visible sets in one pass, diffs each against its own cache, and exposes `getVisibleNodes()` and `getVisibleDomNodes()` for current state.

`ui/src/lib/components/FlowCanvasInner.svelte` wires:

- visible FBO nodes to `glSystem.setVisibleNodes(visibleNodes)`;
- visible DOM nodes to `nodeSetPaused` events;
- a `pausedByViewport` set so nodes paused by the viewport are resumed on re-entry, while user-paused nodes stay paused;
- `nodeDataCommit` and `nodeDataBatchCommit` handling so manual pause/unpause changes keep the viewport ownership ledger consistent.

## DOM Renderer Contract

DOM-backed renderers that opt into viewport pause culling must:

- include their node type in `CULLABLE_DOM_TYPES`;
- store pause state in `node.data.paused`;
- implement a `togglePlayback()` function;
- call `useNodeSetPaused(nodeId, () => !!data.paused, togglePlayback)`;
- dispatch a `nodeDataCommit` event when the user toggles pause manually;
- make code reruns respect `data.paused` instead of silently resuming.

Current implementations:

- `ui/src/objects/p5/P5CanvasNode.svelte`
- `ui/src/objects/canvas/CanvasDom.svelte`
- `ui/src/objects/textmode/TextmodeDom.svelte`
- `ui/src/objects/three/ThreeDom.svelte`

## Pause Ownership Rules

Viewport pause and user pause have different owners.

When a node goes from visible to hidden:

- if it is already user-paused, the viewport does nothing;
- otherwise the viewport dispatches `nodeSetPaused` with `paused: true` and records the node in `pausedByViewport`.

When a node goes from hidden to visible:

- the viewport resumes only nodes present in `pausedByViewport`;
- user-paused nodes remain paused.

When the user toggles pause while a node is offscreen:

- pause takes ownership away from the viewport;
- unpause is immediately converted back into viewport pause if the node is still offscreen, so it does not start consuming CPU out of view.

Deleted DOM-cullable nodes are pruned from `pausedByViewport` using the `liveIds` set emitted by `ViewportCullingManager`.

## Relationship To `onlyRenderVisibleElements`

Viewport pause culling improves performance for mounted components. It is less
complete than XYFlow `onlyRenderVisibleElements`.

With `onlyRenderVisibleElements`, offscreen node components can be destroyed. A
renderer cannot use Svelte `onMount` or `onDestroy` to own resources that must survive offscreen.

Before enabling that optimization broadly:

- runtime object state must move out of Svelte views;
- view mount/unmount must become a lightweight attachment layer;
- preview surfaces must be optional and reconnectable;
- message, audio, video, worker, and scheduler ownership must live in headless runtime services.

## Non-Goals

- Do not pause audio, message-only, or data objects based on viewport visibility.
- Do not treat DOM-backed renderers as FBO-compatible render nodes.
- Do not rely on viewport pause culling as the final solution for subpatches or headless operation.
- Do not enable `onlyRenderVisibleElements` by default until representative object views are remount-safe.

## Success Criteria

- Offscreen `p5`, `canvas.dom`, `textmode.dom`, and `three.dom` nodes stop their main-thread render loops.
- Returning those nodes to the viewport resumes only nodes that the viewport paused.
- User-paused nodes stay paused when moved offscreen and back onscreen.
- Manual pause/unpause while offscreen does not leave expensive render loops running invisibly.
- Worker/FBO culling remains separate and continues to feed only FBO-compatible nodes to the render worker.
