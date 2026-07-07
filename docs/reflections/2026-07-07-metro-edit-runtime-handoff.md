# Metro Edit Runtime Handoff

**Date:** 2026-07-07

## Summary

Editing an existing object from `metro 1000` to `metro 1001` stopped downstream ticks until any unrelated object was added to the graph.

The real issue was not `MetroObject`. The replacement path destroyed the old `MessageContext`, which called `messageSystem.unregisterNode(nodeId)`. That removed the node's message routing from `MessageSystem.connections`. The new `MessageContext` registered the same node id again, but existing edges were not re-applied until a later graph update. Adding any object triggered that update, so metro appeared to start again.

## What We Tried

- Pending async reconcile fixes in `EditorRuntimeReconciler`: did not solve it.
- Reconciling from fresher SvelteFlow node state: did not solve it.
- Explicit reconcile from `objectDataCommit`: did not solve it.
- Stale params investigation (`rawParams: ["1001"]` with old params): plausible, but not the repro.

## What Fixed It

- `MessageContext.destroy()` now accepts `{ unregisterNode?: boolean }`, defaulting to `true`.
- `PatchMessageRuntime` uses `unregisterNode: false` when replacing an object with the same node id.
- True node deletion still unregisters the message node.
- `MessageContext` now stores the exact bound callback it registers, so cleanup removes the correct callback.

Regression test added in `ui/src/lib/runtime/PatchRuntime.test.ts`: messages must still route after replacing an object with the same node id, without calling `messageSystem.updateEdges()` again.

## What We Learned

- Object replacement is not the same as graph-node deletion.
- `MessageSystem.unregisterNode()` is destructive: it clears queues and removes routing state.
- If a bug recovers after any graph edit, inspect connection rebuilding and stale runtime routing before chasing parser or component state.
- For source objects like `metro`, verify both halves separately: "is it ticking?" and "are ticks still routed?"

## Verification

```bash
cd ui
bun run test:unit src/lib/runtime/PatchRuntime.test.ts
bun run check
git diff --check
git diff --cached --check
```
