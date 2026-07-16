# 168. Runtime Object And Editor Representations

## Goal

Keep runtime object behavior separate from editor representation without forcing
every object through the object-box `params[]` model.

Patchies has two useful editor data shapes:

- Object-box text objects: `{ expr, name, params }`
- Dedicated visual nodes: object-shaped `node.data`, such as `{ value, min, max }`

The runtime should accept both as runtime object data.

## Decision

Use one runtime lifecycle contract, with separate editor definition kinds.

```ts
type RuntimeNodeDescriptor<TData = Record<string, unknown>> = {
  id: string;
  type: string;
  data: TData;
};
```

`RuntimeNodeDescriptor` is the public `PatchRuntime` object shape. The editor,
tests, host applications, and headless scripts should all be able to construct
the same descriptor shape.

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

Keep editor-facing registries distinct:

- `TEXT_OBJECTS`: object-box objects loadable through `ObjectNode`
- `VISUAL_OBJECTS`: dedicated Svelte-node-backed visual objects
- `AUDIO_OBJECTS`: audio definitions and adapters
- `RUNTIME_OBJECTS`: combined registration surface for runtime execution and schema generation

Important rules:

- `ObjectNode` searches only text objects plus audio object names where needed.
- Dedicated visual nodes are not text objects.
- Schema/docs generation may include visual objects without making them object-box loadable.

## Data Ownership

Object definitions own their data shape.

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

Do not normalize text-object `params[]` into named object data as part of this
spec. That can remain a future migration.

## Reconciler Role

`EditorRuntimeReconciler` is an adapter from XYFlow state into public
`PatchRuntime` calls. It may understand editor representation kinds, but it
must not mention concrete object names or own object-specific data conversion.

For visual nodes:

```ts
runtime.createObject({
  id: node.id,
  type: node.type,
  data: node.data
});
```

For object-box nodes:

```ts
runtime.createObject({
  id: node.id,
  type: node.data.name,
  data: {
    expr: node.data.expr,
    name: node.data.name,
    params: node.data.params
  }
});
```

Object-specific defaults, migrations, and compatibility logic belong to object
definitions or registry entries, not the reconciler.

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
  setParam(indexOrName: number | string, value: unknown, options?: { notifyUI?: boolean }): void;
}
```

## Migration Plan

1. Keep `TEXT_OBJECTS`, `VISUAL_OBJECTS`, and `RUNTIME_OBJECTS` separate.
2. Pass visual `node.data` directly into runtime descriptors.
3. Pass object-box `{ expr, name, params }` as runtime data for text objects.
4. Move object-specific compatibility handling out of `EditorRuntimeReconciler`.
5. Prefer data-first runtime objects; keep param helpers only for text-object compatibility.

## Success Criteria

- Visual objects run headlessly from the same object-shaped data their Svelte views receive.
- `ObjectNode` cannot accidentally load visual-only objects.
- `EditorRuntimeReconciler` does not mention concrete object names.
- Headless callers can create the same runtime graph the editor creates through reconciliation.
- Text-object `params[]` continue to work for object-box expressions.

## Non-Goals

- Convert all text-object params into named object data.
- Redesign `ObjectNode`.
- Change patch JSON's XYFlow graph shape.
- Build the full plugin system.
