# Visual Object Headless Migration

Use this when moving a UI-owned Svelte object toward the headless runtime model.

## Goal

The Svelte node should become a view only. Runtime behavior, message handling,
port metadata, and docs/search schema should live in the object definition under
`ui/src/objects/<object>/`.

## Migration Steps

1. Create an object class next to the view.

   Add `ui/src/objects/<object>/<ObjectName>Object.ts` implementing the common
   runtime object contract. Put runtime behavior there: `create`, `onMessage`,
   `destroy`, timers, subscriptions, and outgoing `context.send(...)` calls.
   Dedicated visual objects should use object-shaped node data and should not
   keep text-object-only APIs or hidden positional params.

2. Move schema metadata into the object class.

   Replace the old `schema.ts` duplication with static metadata on the object:
   `type`, `category`, `description`, `tags`, `inlets`, and `outlets`.
   Include TypeBox `messages` and explicit `handle` specs when existing handle
   IDs must be preserved.

   Match incoming message variants with the same TypeBox schemas used in the
   metadata. Prefer `schema(Type.Boolean())`, `schema(Type.Number())`, or
   pre-wrapped common matchers such as `messages.bang` over raw `ts-pattern`
   primitive patterns like `P.boolean` and `P.number`.

   For native DSP/audio-backed visual nodes, put public docs/handle ports in
   `schemaInlets` when they differ from the worklet's actual parameter inlet
   array. Keep hidden worklet parameters in `inlets` with `hideDocs` /
   `hideInlet` so processor inlet indices remain stable.

   For one message inlet/outlet that previously used `{ handleType: 'message' }`,
   keep that exact handle spec. Do not let generation add `handleId: 0` unless
   you intend to migrate saved edge handle IDs.

3. Register the object.

   Add dedicated Svelte-node-backed controls to `VISUAL_OBJECTS` in
   `ui/src/lib/objects/v2/nodes/index.ts`, not `TEXT_OBJECTS`. `TEXT_OBJECTS`
   is only for objects that can be created through the object-box editor.
   `RUNTIME_OBJECTS` combines both lists for runtime registration and schema
   generation.

   Run `bun run generate:schemas` from `ui/` so
   `ui/src/lib/generated/object-schemas.generated.ts` includes it.

4. Remove the manual schema.

   Delete `ui/src/objects/<object>/schema.ts` once generated metadata matches
   the old schema. Remove its export, import, and override entry from
   `ui/src/lib/objects/schemas/index.ts`.

5. Update the Svelte node.

   Import schema metadata from `objectSchemas` only if the view needs handle
   specs. Move message behavior into the object class. The view may keep local
   UI state such as hover, flash, focus, dimensions, and editor controls.

   Keep visual-node state in the same object-shaped `node.data` that the Svelte
   component receives. Do not add hidden positional params just to feed the
   runtime. Put defaults in the object/view helpers that read node data, and use
   explicit migrations for saved data shape changes.

6. Add a view-local message context when the UI needs message feedback.

   Use `useNodeViewMessageContext(nodeId, callback)` for UI-only reactions such
   as flash animations. Cleanup must preserve the runtime message node by using
   `destroy({ unregisterNode: false })`, which the composable handles.

7. Route UI actions through messages.

   A click or control change should send into the shared message queue or
   update node data. The headless object should receive the same message path as
   external patch messages.

   A view-local send may arrive without inlet metadata because it goes directly
   to the node's queue. Edge-routed messages may also arrive with `inletKey`
   only (for example legacy `message-in` handles do not produce numeric
   `meta.inlet`). Do not rely on `meta.inletName` being present unless the
   runtime resolves it from the object metadata; for single-inlet objects,
   defaulting missing inlet metadata to that inlet is acceptable.

8. Verify headless and remount behavior.

   Add or update runtime tests that prove behavior works without mounting the
   Svelte component. Then verify `Cull objects` in Settings so unmount/remount
   does not reset runtime-owned state.

   Include tests for both message paths when they differ: UI-originated sends
   with no inlet metadata, and edge-routed sends using the preserved handle key
   shape such as `message-in`. These tests catch cases where click behavior
   works but patched messages do not, or vice versa.

## Checklist

- Runtime behavior is in `<ObjectName>Object.ts`, not the Svelte view.
- Static object metadata replaces `schema.ts`.
- Dedicated visual objects are registered in `VISUAL_OBJECTS`, not
  `TEXT_OBJECTS`.
- Generated schema preserves existing handle IDs.
- Message matchers use the TypeBox schemas declared in metadata.
- Visual runtime state uses object-shaped node data instead of hidden params.
- Runtime message dispatch handles UI-local sends and edge-routed `inletKey`
  metadata for preserved handle IDs.
- `schema.ts` is deleted and removed from `schemas/index.ts`.
- Svelte cleanup does not unregister the runtime message node.
- Runtime tests pass without Svelte.
