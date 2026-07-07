# 40. Headless Patcher System

Status: Active architecture target, partially implemented through runtime services.

Last verified against code: 2026-07-07.

## Goal

Move Patchies toward a patch runtime that can load, execute, and mutate a patch graph without mounting the XYFlow editor. This is the foundation for:

- viewport rendering with `onlyRenderVisibleElements`;
- subpatches and Max/MSP-style abstractions;
- dynamic object and plugin loading;
- API-first usage from host applications;
- a stable embeddable web component.

This spec is now a supporting spec for [167. Modular Patchies Roadmap](167-modular-patchies-roadmap.md). It describes the headless runtime boundary that roadmap depends on.

## Current State

Patchies now has a small `PatchRuntime` facade, but it does not yet own the
whole patch graph lifecycle.

The codebase does have several headless runtime primitives:

- `ui/src/lib/runtime/PatchRuntime.ts` coordinates the first runtime slice for
  message/text and V2 audio object behavior.
- `ui/src/lib/runtime/PatchMessageRuntime.ts` owns runtime `MessageContext`
  lifecycle, parameter-change forwarding, message subscriptions for views,
  runtime-derived object ports, and view revision bumps.
- `ui/src/lib/runtime/RuntimeAudioObjectAdapter.ts` owns audio object identity sync,
  duplicate recreation suppression, message forwarding to audio parameters, and
  cleanup for runtime-created audio objects.
- `ui/src/lib/runtime/EditorRuntimeReconciler.ts` translates XYFlow object nodes
  into runtime object create/update/destroy calls. It may understand editor node
  shape; `PatchRuntime` itself should not.
- The first UI-owned Svelte node runtime slice is `button`: `ButtonObject` lives
  under `ui/src/objects/button/` and is managed by `ObjectService`, while
  `ButtonNode.svelte` remains a view that uses a view-local `MessageContext` to
  inject click messages and render flash feedback without owning object
  lifecycle.
- `ui/src/lib/objects/v2/ObjectService.ts` owns V2 text object instances, message dispatch, creation, and destruction outside Svelte components.
- `ui/src/lib/registry/ObjectRegistry.ts` and `ui/src/lib/registry/AudioRegistry.ts` support runtime registration of text object and audio node constructors.
- `ui/src/lib/audio/v2/AudioService.ts` owns V2 audio node instances, audio graph updates, scheduled messages, and virtual audio routing.
- The worker-backed video pipeline owns render graph execution outside Svelte node views.
- `ui/src/lib/canvas/ViewportCullingManager.ts` now tracks visible FBO and DOM-backed nodes separately.

The editor still owns too much:

- `ui/src/lib/components/FlowCanvasInner.svelte` owns the canonical `nodes` and `edges` arrays, history, deletion cleanup, viewport culling wiring, and many cross-system side effects.
- Patch loading, graph-level connect/disconnect APIs, video runtime ownership,
  plugin loading, and subpatch runtime ownership are not yet runtime-owned.
- Many object views still call `useSvelteFlow()` directly to update node data or inspect graph state.
- Static registries such as `ui/src/lib/nodes/node-types.ts`, `ui/src/lib/objects/schemas/index.ts`, and object browser packs are still required for complete editor behavior.
- `<x-patchies>` currently mounts the full editor shell; it is not yet a stable API-first embed surface.

## Target Runtime Boundary

Introduce a `PatchRuntime` or equivalent object that owns graph execution independently of the editor.

The runtime should provide graph-level APIs:

```ts
runtime.loadPatch(patchJson);
runtime.createObject(node);
runtime.updateObject(id, data);
runtime.removeObject(id);
runtime.connect(edge);
runtime.disconnect(edge);
runtime.send(nodeId, message, meta);
runtime.destroy();
```

The runtime should also expose service surfaces:

- `runtime.objects` for text/message object registration and instances;
- `runtime.audio` for audio node registration and audio graph execution;
- `runtime.video` for render node registration and render graph execution;
- `runtime.messages` for message routing;
- `runtime.plugins` for loading/registering plugin bundles;
- `runtime.subpatches` for nested patch runtimes.

The editor should become a client of this runtime. It may own selection, canvas gestures, panels, history UI, and visual layout state, but object execution should not depend on Svelte component lifetime.

## Object Lifecycle

Runtime object lifecycle:

- `create` happens when a patch graph instantiates a node.
- `update` happens when node data or graph connections change.
- `destroy` happens when the node is removed from the runtime graph.
- Runtime objects own message callbacks, audio nodes, render nodes, timers, workers, schedulers, subscriptions, and persisted execution state.

View lifecycle:

- `mountView` happens when the editor renders a node view.
- `unmountView` happens when the editor removes that view, including because it left the viewport.
- Views may attach preview canvases, controls, settings panels, CodeMirror editors, resize handles, and local UI affordances.
- Views must not own runtime execution resources that should continue while the view is unmounted.

This split is required before enabling XYFlow `onlyRenderVisibleElements` as the default behavior. With that optimization, offscreen Svelte node components can be destroyed and later recreated.

## Migration Path

1. Keep the existing `ObjectService` and `AudioService` patterns as the first runtime services.
2. Add a small `PatchRuntime` around one low-risk message-only object path.
3. Route editor graph changes through runtime APIs instead of letting individual views instantiate runtime behavior.
4. Move view-owned message/audio/video side effects into runtime object classes one object family at a time.
5. Add mount/unmount hooks for optional preview surfaces and editor-only UI.
6. Make representative objects remount-safe, then enable `onlyRenderVisibleElements` behind a feature flag.
7. Use nested `PatchRuntime` instances for subpatch objects.

## Success Criteria

- A patch with message-only objects can run in a unit test without mounting Svelte or XYFlow.
- A patch with V2 audio objects can be constructed and connected through runtime APIs.
- A worker-backed video object keeps its render-node state when its Svelte view is unmounted and remounted.
- The editor can pan nodes out of view and back without restarting runtime-owned state.
- Subpatch runtime instances can run when their editor view is closed.

## Non-Goals

- Do not rewrite all existing objects in one pass.
- Do not make Svelte components disappear; they remain the editor/view layer.
- Do not put editor selection, drag behavior, panels, or keyboard shortcuts into the headless runtime.
- Do not use XYFlow group nodes as the runtime model for subpatches.
