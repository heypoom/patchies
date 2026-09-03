# 168. Runtime Object And Editor Representations

## Goal

Keep runtime object behavior separate from editor representation. Do not force
every object into the object-box `params[]` model.

Patchies uses two editor data shapes:

- Object-box text objects: `{ expr, name, params }`
- Dedicated visual nodes: object-shaped `node.data`, such as `{ value, min, max }`

The runtime accepts both as object data.

## Decision

Use one public runtime object shape and separate editor definition kinds.

```ts
type RuntimeObjectSpec<TData = Record<string, unknown>> = {
  id: string;
  type: string;
  data: TData;
};
```

`RuntimeObjectSpec` is the public `PatchRuntime` object shape. The editor, tests,
host applications, and headless scripts use the same descriptor shape.

Connections use the same principle:

```ts
type RuntimeConnectionSpec = {
  id?: string;
  source: string;
  outlet?: string;
  target: string;
  inlet?: string;
};
```

`PatchRuntime` is the public graph module. It owns runtime objects and
connections. Its API uses graph, object, and connection operations:

```ts
runtime.setGraph({ objects, connections });
runtime.getGraph();
runtime.createObject(object);
runtime.updateObject(id, object);
runtime.destroyObject(id);
runtime.connect(connection);
runtime.disconnect(connectionId);
runtime.send(id, message);
```

All object changes use `RuntimeObjectSpec`, including the internal message and
audio adapter boundaries. Raw expression parameters are derived from `data.expr`
only where text-object creation needs them. Audio resolution adds derived params
to the object-owned data, making `data.params` the AudioService contract while
keeping runtime-managed code and settings flat beside it. Message, audio,
rendering, and editor compatibility stay behind this API. The editor reconciler
is one adapter from XYFlow state. Internal helpers can store objects,
connections, snapshots, and object keys, but callers use `PatchRuntime`.

Runtime objects implement a common lifecycle and message interface:

```ts
interface RuntimeObject<TData = Record<string, unknown>> {
  create?(): void | Promise<void>;
  update?(data: TData): void;
  destroy?(): void;
  onMessage?(data: unknown, meta: MessageMeta): void;
}
```

## Editor Kinds

Keep these editor registries separate:

- `TEXT_OBJECTS`: object-box objects loadable through `ObjectNode`
- `VISUAL_OBJECTS`: dedicated Svelte-node-backed visual objects that keep their
  own Svelte node type
- `AUDIO_OBJECTS`: audio definitions and adapters
- `RUNTIME_OBJECTS`: combined registration surface for runtime execution and schema generation

A dedicated audio Svelte node uses runtime ownership only when it must keep
producing or consuming graph-visible behavior while unmounted. An audio monitor
used only by its canvas stays view-owned and can pause when culled. A runtime
audio class owns graph messages, audio lifecycle, persisted state, and downstream
output. Its Svelte view owns drawing and editor-local interaction only.

Audio I/O nodes use the same boundary. A runtime microphone owns the capture
stream and its constraints. A runtime output owns the patch-to-device route and
selected sink. Their Svelte views can list devices and save selections. They do
not create or destroy audio nodes.

Important rules:

- `ObjectNode` searches and instantiates `TEXT_OBJECTS`, plus supported
  object-box audio names resolved through `AudioRegistry`.
- `ObjectNode` must exclude dedicated `VISUAL_OBJECTS`. Those stay dedicated
  Svelte node types.
- Schema/docs generation may include visual objects without making them object-box loadable.
- When a legacy message handle does not provide numeric inlet metadata, the
  audio adapter may route it only when the audio definition has exactly one
  message inlet. Definitions with multiple message inlets must keep explicit
  inlet handle IDs.
- A runtime-managed audio class with expression- or code-derived message ports
  may declare an object-owned dynamic message target. The audio adapter forwards
  the edge's numeric inlet index with the message, without learning the object
  name or its port grammar. The audio class translates that index into its
  dynamic runtime state. Its Svelte view owns only matching handle redraws.
- A runtime-managed audio class that defines settings or dynamic editor metadata
  owns the settings manager and publishes persisted-data updates through the
  audio adapter. A mounted Svelte view uses that same manager; it must not
  create a competing settings state.
- `AudioService` receives audio params plus an optional pre-create callback. It
  must not receive or interpret dedicated editor data such as settings or a
  settings schema; the audio adapter binds that data directly to an audio class
  through its optional `bindRuntimeData` capability.
- Runtime code editor changes remain an editor-only draft. Code reaches the
  audio class only on runtime creation or an explicit run command from the Run
  button, shortcut, or patch message.

## Data Ownership

Object definitions own data shape.

Visual object runtime data should match the Svelte node's `node.data` shape:

```ts
{
  id: "slider-1",
  type: "slider",
  data: { value: 50, min: 0, max: 100, step: 1 }
}
```

Object-box text objects can keep the expression shape:

```ts
{
  id: "object-1",
  type: "metro",
  data: { expr: "metro 500", name: "metro", params: [500] }
}
```

For controls with `value` and `defaultValue`, an absent value has meaning.
`value` stays optional. The view and runtime use `defaultValue` when it is absent.
Do not replace an absent value with `0`. A preset can provide only a default value.

Do not normalize text-object `params[]` into named object data as part of this
spec. That can remain a future migration.

## Reconciler Role

`EditorRuntimeReconciler` is a stateless adapter from XYFlow state to the public
`PatchRuntime` graph shape. It can know editor representation kinds. It does not
own graph diffs, name objects, select message or audio lanes, or convert object data.

For visual nodes:

```ts
runtime.setGraph({
  objects: [
    {
      id: node.id,
      type: node.type,
      data: node.data,
    },
  ],
  connections,
});
```

For object-box nodes:

```ts
runtime.setGraph({
  objects: [
    {
      id: node.id,
      type: node.data.name,
      data: {
        expr: node.data.expr,
        name: node.data.name,
        params: node.data.params,
      },
    },
  ],
  connections,
});
```

Object definitions or registry entries own defaults, migrations, and compatibility
logic. The reconciler does not.

## Runtime Synchronization

`PatchRuntime` alone owns graph diffs and runtime lifecycle. It tracks the last
graph and resolves each public object spec to a message or audio implementation.
When an ID changes kind, it destroys the old implementation before it starts the new one.

Runtime-to-editor updates must compose when several messages reach the same
node synchronously. A view must accumulate same-turn mutations to a collection,
such as changes to several object-box `params[]` entries, before writing editor
state. When applying the batch, derive untouched values from the editor store's
current node snapshot rather than a Svelte view prop captured before message
fan-out began. This preserves every inlet update when one outlet connects to
several inlets on the same node.

Object synchronization is serialized. Each reconciliation waits for the last one
before it reads or changes lifecycle state. A failed sync does not block a later
graph update. `setGraph()` reconciles unchanged graphs because a runtime service
node can disappear without a graph change.

Object and connection fan-out have separate responsibilities:

- Object additions, removals, or type changes update direct-channel node types.
- Connection changes update message, audio, rendering, and other edge consumers.
- `setConnections()` waits for the latest object synchronization before sending
  edges, so endpoints exist before they are wired.

## Runtime Context

Runtime objects should use a data-first context:

```ts
interface RuntimeObjectContext<TData = Record<string, unknown>> {
  send(data: unknown, options?: SendMessageOptions): void;
  getData(): TData;
  setData(updates: Partial<TData>, options?: { notifyUI?: boolean }): void;
}
```

Object-box text objects may keep param helpers through an adapter:

```ts
interface TextObjectContext extends RuntimeObjectContext<TextObjectData> {
  getParam(indexOrName: number | string): unknown;
  setParam(
    indexOrName: number | string,
    value: unknown,
    options?: { notifyUI?: boolean },
  ): void;
}
```

## Migration Plan

1. Keep `TEXT_OBJECTS`, `VISUAL_OBJECTS`, and `RUNTIME_OBJECTS` separate.
2. Pass visual `node.data` directly into runtime descriptors.
3. Pass object-box `{ expr, name, params }` as runtime data for text objects.
4. Move message/audio runtime lane selection out of `EditorRuntimeReconciler`.
5. Move object and connection diffs into `PatchRuntime.setGraph`.
6. Serialize runtime reconciliation and keep node-type propagation separate from
   connection fan-out.
7. Move edge updates behind `PatchRuntime` connection methods.
8. Prefer data-first runtime objects. Keep param helpers only for text-object compatibility.

## Success Criteria

- Visual objects run headlessly from the same object-shaped data their Svelte views receive.
- `ObjectNode` cannot accidentally load visual-only objects.
- `EditorRuntimeReconciler` does not maintain graph state, mention concrete object names, or mention runtime lanes.
- Headless callers can create the same runtime graph the editor creates through reconciliation.
- All public object mutations use `{ id, type, data }`. Message descriptors are
  internal runtime details.
- Overlapping editor updates cannot leave a stale runtime object active, and
  unchanged graph snapshots can restore missing service-owned nodes.
- Text-object `params[]` continue to work for object-box expressions.

## Non-Goals

- Convert all text-object params into named object data.
- Redesign `ObjectNode`.
- Change patch JSON's XYFlow graph shape.
- Build the full plugin system.
