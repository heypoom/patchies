# 168. Runtime Object And Editor Representations

## Goal

Split runtime object behavior from editor node representation without forcing
all objects through the text-object `params[]` model.

Patchies currently has two different editor data shapes:

- Object-box text objects use `{ expr, name, params }`.
- Dedicated visual nodes use object-shaped `data`, such as
  `{ value, min, max, step, isFloat }`.

Both shapes are useful. The runtime should accept them as object data instead of
making visual objects pretend to be text objects with hidden positional params.

## Problem

`TextObjectV2` has become overloaded. It currently means:

- an object that can be created from an object box expression;
- a runtime message object with lifecycle and message handling;
- a metadata source for docs, search, and handles;
- in recent migrations, a headless backing object for dedicated visual Svelte
  nodes.

That overload creates bad pressure on the architecture:

- Visual objects get registered as text objects even when they should not be
  loadable through `ObjectNode`.
- Visual node data gets converted into artificial `params[]` arrays.
- Runtime reconciliation starts needing object-specific adapters.
- The term "text object" stops describing the boundary it owns.

The runtime should not know that `slider`, `knob`, `textbox`, or any other
object needs special data handling. Object-specific data shape belongs to the
object definition.

## Design

Introduce a common runtime object contract and separate editor-facing
definition kinds.

```ts
interface RuntimeObject<TData = Record<string, unknown>> {
  readonly nodeId: string;
  readonly data: TData;
  readonly context: RuntimeObjectContext;

  create?(): void | Promise<void>;
  update?(data: TData): void;
  destroy?(): void;
  onMessage?(data: unknown, meta: MessageMeta): void;
}
```

Runtime objects receive object-shaped data. The runtime descriptor is the editor
node stripped of XYFlow-only fields:

```ts
type RuntimeNodeDescriptor<TData = Record<string, unknown>> = {
  id: string;
  type: string;
  data: TData;
};
```

For dedicated visual nodes, `data` should closely match the Svelte component's
current `node.data`:

```ts
{
  id: "slider-1",
  type: "slider",
  data: {
    value: 50,
    min: 0,
    max: 100,
    step: 1,
    isFloat: false,
    runOnMount: true
  }
}
```

For object-box text objects, runtime data can remain the existing object-box
shape:

```ts
{
  id: "object-1",
  type: "metro",
  data: {
    expr: "metro 500",
    name: "metro",
    params: [500]
  }
}
```

The runtime does not need to normalize object-box text objects into named object
data as part of this spec. `params[]` remains valid for object-box text objects.

## Definition Kinds

Use separate editor-facing registries that can all point at runtime objects:

```ts
TEXT_OBJECTS
VISUAL_OBJECTS
AUDIO_OBJECTS
```

`TEXT_OBJECTS` contains objects that can be created and edited through
`ObjectNode`. These use the expression/object-box data shape.

`VISUAL_OBJECTS` contains dedicated Svelte node types such as `slider`, `knob`,
`toggle`, `button`, `textbox`, `loadbang`, `label`, and `note`. These use the
visual node's object-shaped `data`.

`AUDIO_OBJECTS` continues to own audio-specific definitions. Audio objects may
also implement the common runtime object contract where it helps message
routing, lifecycle, and editor/runtime reconciliation share code.

The important rule is:

- `ObjectNode` searches and instantiates only `TEXT_OBJECTS`.
- Dedicated Svelte nodes come from `VISUAL_OBJECTS`.
- Runtime services can run both because both implement `RuntimeObject`.

## Data Ownership

The editor node data shape is owned by the object definition.

Visual objects should define a data type that matches their Svelte props:

```ts
type SliderData = {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  isFloat?: boolean;
  runOnMount?: boolean;
};
```

The object class should read and update that data directly:

```ts
class SliderObject implements RuntimeObject<SliderData> {
  static type = "slider";
  static editorKind = "visual";

  constructor(
    readonly nodeId: string,
    public data: SliderData,
    readonly context: RuntimeObjectContext
  ) {}
}
```

Object-box text objects can continue to use `{ expr, name, params }`:

```ts
type TextObjectData = {
  expr: string;
  name: string;
  params: unknown[];
};
```

This preserves the current text object editing model while still letting the
runtime treat text and visual objects through one lifecycle and message-routing
contract.

## Runtime Reconciliation

`EditorRuntimeReconciler` should translate an XYFlow node into a runtime
descriptor without knowing concrete object names.

For dedicated visual nodes:

```ts
{
  id: node.id,
  type: node.type,
  data: node.data
}
```

For object-box nodes:

```ts
{
  id: node.id,
  type: node.data.name,
  data: {
    expr: node.data.expr,
    name: node.data.name,
    params: node.data.params
  }
}
```

The reconciler may know editor representation kinds (`object` node versus
dedicated visual node), but it must not contain branches for individual object
types.

If an object needs data migration, defaults, or compatibility handling, that
logic belongs to its definition or registry entry, not the reconciler.

## Runtime Context

Replace `ObjectContext`'s param-first API with a data-first context for runtime
objects:

```ts
interface RuntimeObjectContext<TData = Record<string, unknown>> {
  send(data: unknown, options?: SendMessageOptions): void;
  getData(): TData;
  setData(updates: Partial<TData>, options?: { notifyUI?: boolean }): void;
}
```

For object-box text objects, the text-object adapter can provide convenience
helpers for positional params:

```ts
interface TextObjectContext extends RuntimeObjectContext<TextObjectData> {
  getParam(indexOrName: number | string): unknown;
  setParam(indexOrName: number | string, value: unknown, options?: { notifyUI?: boolean }): void;
}
```

This keeps existing text object code migratable without making params the
universal runtime shape.

## Schema And Metadata

Schema/docs/search metadata should live on object definitions, but schema
generation should not imply object-box loadability.

Definitions should explicitly declare their editor kind:

```ts
type EditorKind = "text" | "visual" | "audio";
```

Generated object schemas can include all editor kinds for docs and object
browser search, while `ObjectNode` filters to `editorKind === "text"`.

This avoids the current trap where registering a visual object for schema
generation also makes it look like a text object.

## Migration Plan

1. Add the common `RuntimeObject<TData>` contract and data-first runtime
   context.

2. Split the text object registry into:

   - a runtime object registry used by `PatchRuntime`;
   - a text-object registry used by `ObjectNode` and expression parsing.

3. Add a visual object registry for dedicated Svelte node-backed objects.

4. Move recently migrated visual controls out of `TEXT_OBJECTS` and into
   `VISUAL_OBJECTS`.

5. Update `EditorRuntimeReconciler` to pass `node.data` as runtime data for
   visual nodes and `{ expr, name, params }` for object-box nodes.

6. Adapt existing `TextObjectV2` objects through a compatibility adapter so the
   current `params[]` text-object model continues to work during migration.

7. Migrate visual object classes from hidden param arrays to typed visual data.

8. Remove visual-object param adapters once their runtime objects read data
   directly.

## Success Criteria

- A visual object can run headlessly from the same object-shaped data its Svelte
  node receives.
- `ObjectNode` cannot accidentally load visual-only objects.
- `EditorRuntimeReconciler` does not mention concrete object names.
- Text object params continue to work for object-box expressions.
- Runtime lifecycle and message routing are shared between text and visual
  runtime objects.
- Schema generation can include both text and visual definitions without
  conflating their editor representations.

## Non-Goals

- Convert all text-object `params[]` data into named object data.
- Redesign `ObjectNode` editing UI.
- Change patch JSON's XYFlow graph shape.
- Build the full plugin bundle system.

Those remain compatible future improvements, but this spec focuses on the
runtime/editor representation boundary.
