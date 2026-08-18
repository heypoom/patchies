# Visual Object Headless Migration

Use this guide to move a UI-owned Svelte object to the headless runtime model.

## Goal

The Svelte node becomes a view only. Put runtime behavior, message handling, port
metadata, and docs and search schemas in `ui/src/objects/<object>/`.

## Migration Roadmap

Only migrate visual objects whose graph-visible behavior is useful without a
mounted UI. Keep display-only objects view-owned.

Completed:

- `sequencer`
- `trigger`, `curve`, `msg`

Migrate the remaining objects in this order. Objects grouped in one item form a
single migration batch:

1. `expr`
2. `filter`, `map`, `tap`, `scan`
3. `uniq`
4. `mqtt`, `sse`, `netsend`, `netrecv`
5. `worker`
6. `orca`
7. `python`, `ruby`
8. `midi.in`, `midi.out`, `serial`, `serial.dmx`, `tts`, `stt`
9. `uxn`, `uiua`

## Migration Steps

1. Create an object class next to the view.

   Add `ui/src/objects/<object>/<ObjectName>Object.ts` with the common runtime
   object contract. Put `create`, `onMessage`, `destroy`, timers, subscriptions,
   and `context.send(...)` calls there. Dedicated visual objects use object-shaped
   node data. Do not keep text-object-only APIs or hidden positional parameters.

2. Move schema metadata into the object class.

   Replace duplicated `schema.ts` data with static object metadata:
   `type`, `category`, `description`, `tags`, `inlets`, and `outlets`.
   Include TypeBox `messages` and explicit `handle` specs when existing handle
   IDs must be preserved.

   Match incoming message variants with the TypeBox schemas in the metadata. Use
   `schema(Type.Boolean())`, `schema(Type.Number())`, or `messages.bang`. Do not
   use raw `ts-pattern` primitives such as `P.boolean` and `P.number`.

   For native DSP or audio visual nodes, put public docs and handles in
   `schemaInlets` when they differ from worklet parameter inlets. Keep hidden
   worklet parameters in `inlets` with `hideDocs` or `hideInlet`. This keeps
   processor inlet indexes stable.

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
   only (for example, legacy `message-in` handles do not produce numeric
   `meta.inlet`). Do not rely on `meta.inletName` unless the runtime resolves it
   from object metadata. For single-inlet objects, a missing inlet can use that inlet.

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
