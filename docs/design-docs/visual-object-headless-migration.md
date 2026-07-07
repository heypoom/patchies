# Visual Object Headless Migration

Use this when moving a UI-owned Svelte object toward the headless runtime model.

## Goal

The Svelte node should become a view only. Runtime behavior, message handling,
port metadata, and docs/search schema should live in the object definition under
`ui/src/objects/<object>/`.

## Migration Steps

1. Create an object class next to the view.

   Add `ui/src/objects/<object>/<ObjectName>Object.ts` implementing
   `TextObjectV2`. Put runtime behavior there: `create`, `onMessage`,
   `destroy`, timers, subscriptions, and outgoing `context.send(...)` calls.

2. Move schema metadata into the object class.

   Replace the old `schema.ts` duplication with static metadata on the object:
   `type`, `category`, `description`, `tags`, `inlets`, and `outlets`.
   Include TypeBox `messages` and explicit `handle` specs when existing handle
   IDs must be preserved.

   For native DSP/audio-backed visual nodes, put public docs/handle ports in
   `schemaInlets` when they differ from the worklet's actual parameter inlet
   array. Keep hidden worklet parameters in `inlets` with `hideDocs` /
   `hideInlet` so processor inlet indices remain stable.

   For one message inlet/outlet that previously used `{ handleType: 'message' }`,
   keep that exact handle spec. Do not let generation add `handleId: 0` unless
   you intend to migrate saved edge handle IDs.

3. Register the object.

   Add the class to `TEXT_OBJECTS` in
   `ui/src/lib/objects/v2/nodes/index.ts`. Run `bun run generate:schemas` from
   `ui/` so `ui/src/lib/generated/object-schemas.generated.ts` includes it.

4. Remove the manual schema.

   Delete `ui/src/objects/<object>/schema.ts` once generated metadata matches
   the old schema. Remove its export, import, and override entry from
   `ui/src/lib/objects/schemas/index.ts`.

5. Update the Svelte node.

   Import schema metadata from `objectSchemas` only if the view needs handle
   specs. Move message behavior into the object class. The view may keep local
   UI state such as hover, flash, focus, dimensions, and editor controls.

6. Add a view-local message context when the UI needs message feedback.

   Use `useNodeViewMessageContext(nodeId, callback)` for UI-only reactions such
   as flash animations. Cleanup must preserve the runtime message node by using
   `destroy({ unregisterNode: false })`, which the composable handles.

7. Route UI actions through messages.

   A click or control change should send into the shared message queue or
   update node data. The headless object should receive the same message path as
   external patch messages.

8. Verify headless and remount behavior.

   Add or update runtime tests that prove behavior works without mounting the
   Svelte component. Then verify `Cull objects` in Settings so unmount/remount
   does not reset runtime-owned state.

## Checklist

- Runtime behavior is in `<ObjectName>Object.ts`, not the Svelte view.
- Static object metadata replaces `schema.ts`.
- Generated schema preserves existing handle IDs.
- `schema.ts` is deleted and removed from `schemas/index.ts`.
- Svelte cleanup does not unregister the runtime message node.
- Runtime tests pass without Svelte.
