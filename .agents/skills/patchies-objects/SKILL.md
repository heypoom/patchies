---
name: patchies-objects
description: Use when adding, editing, or migrating Patchies nodes, objects, handles, object modules, schemas, object docs, AI prompts, file drag/drop support, or node data settings.
---

# Patchies Objects

## Object Modules First

Before adding, moving, or migrating object code, read `ui/src/objects/README.md`. Treat it as the source of truth for object-module ownership.

Object-owned code belongs under `ui/src/objects/<object-or-family>/`. Each object, or small obvious object family, should own the files specific to that object:

- Svelte node components
- object schemas
- audio or text object runtime classes
- object-specific AI prompts
- default data, render-node type members, settings, constants, helpers, and tests
- workers or system classes that are not shared infrastructure

There is no required subfolder shape beyond keeping object-owned files colocated. Use subfolders when they make the module easier to scan:

```text
ui/src/objects/<object-or-family>/
  components/
  workers/
  native-dsp/
  render-types.ts
  schema.ts
  prompt.ts
  *.test.ts
```

Markdown object docs stay in `ui/static/content/objects/`.

Shared infrastructure belongs outside `ui/src/objects` only when it is not owned by one object or a small object family. Examples: registries, schema helper utilities, shared layout components used by unrelated objects, object service plumbing, rendering infrastructure, and native DSP framework code.

Use the `$objects` alias for object-owned imports.

Files outside `ui/src/objects` should import object modules only when they are registry-style files whose job is to gather object definitions, such as component, audio, text-object, schema, prompt, shorthand, default-data, or render-type registries.

If a non-registry file outside `ui/src/objects` needs behavior from an object module, reconsider the boundary: move shared behavior to `ui/src/lib`, or move the object-specific caller into the owning object module.

When migrating many objects, move in small validated batches. Do not group unrelated objects merely because they share a layout component.

## Handles

Use `StandardHandle` for node handles:

```svelte
<StandardHandle port="inlet|outlet" type="video|audio|message" id="optional" title="Description" total={count} index={idx} />
```

Handle colors: video is orange, audio is blue, message is gray.

ID generation:

- `type` and `id`: `${type}-${portDir}-${id}`, for example `audio-in-0`.
- `type` only: `${type}-${portDir}`, for example `message-in`.
- `id` only: `${portDir}-${id}`, for example `in-0`.
- Neither: the `port` value.

Common patterns:

- Simple single inlet/outlet: omit `id`.
- Multiple indexed handles: `id={index}`.
- Complex dynamic handles: include index, name, and type in `id`.

## Node Data Undo/Redo

When adding any new node option or setting, add undo/redo tracking with `useNodeDataTracker`.

Discrete changes, such as toggles, color pickers, dropdowns, and radio buttons, should commit immediately:

```ts
const tracker = useNodeDataTracker(node.id);

function handleColorChange(newColor: string) {
  const oldColor = color;

  updateNodeData(node.id, { color: newColor });
  tracker.commit('color', oldColor, newColor);
}
```

Continuous changes, such as text inputs, sliders, and number inputs, should track from focus/pointerdown through blur/pointerup:

```ts
const textTracker = tracker.track('text', () => node.data.text ?? '');
```

`CodeEditor` handles code undo internally through `codeCommit`; pass the correct `dataKey` instead of adding `useNodeDataTracker` for code.

See `PostItNode.svelte`, `SliderNode.svelte`, and `docs/design-docs/specs/68-undo-redo-system.md`.

## Visual or Expression Nodes

When adding a visual/expression node, update the relevant surfaces:

- Component in the owning `ui/src/objects/<module>/` unless it is genuinely shared UI infrastructure.
- Node type registry.
- Default node data.
- Object browser category and description.
- Documentation and object schema when user-visible.
- AI object prompts: `object-descriptions-types.ts`, object prompt file, and prompt index.
- CodeMirror completions for JavaScript-based nodes that expose API functions.

## Runtime Object Kinds

Patchies has separate editor representations that can share runtime lifecycle
and message routing:

- Object-box text objects use `{ expr, name, params }` and are loadable through
  `ObjectNode`.
- Dedicated visual nodes use object-shaped `node.data`, such as
  `{ value, min, max, step, isFloat }`.
- Audio nodes keep their audio-specific `params[]` runtime contract unless the
  audio object explicitly provides a higher-level message/settings adapter.

Keep these registries distinct in `ui/src/lib/objects/v2/nodes/index.ts`:

- `TEXT_OBJECTS`: object-box objects only.
- `VISUAL_OBJECTS`: dedicated Svelte-node-backed visual objects.
- `RUNTIME_OBJECTS`: union used for runtime registration and schema generation.

Do not put a dedicated visual node in `TEXT_OBJECTS` just to make schemas or
headless runtime work. `ObjectNode` should only search/load `TEXT_OBJECTS`
plus audio object names.

`EditorRuntimeReconciler` may branch on editor representation (`object` node
versus dedicated node), but must not mention concrete object names. If an object
needs data defaults or compatibility handling, put that logic on the object
definition with `getRuntimeDataFromNodeData()`.

## Headless Visual Objects

When moving a visual Svelte node to a headless runtime object, read
`docs/design-docs/visual-object-headless-migration.md` first.

Guidelines:

- Put runtime behavior in `<ObjectName>Object.ts`: `create`, `update`,
  `destroy`, timers, subscriptions, `onMessage`, and `context.send(...)`.
- Keep the Svelte component as a view over `node.data` plus local UI state.
- Store runtime state in object-shaped data via `context.getData()` and
  `context.setData(updates, { notifyUI: true })`.
- Do not add hidden positional params just to feed the runtime.
- If a view action should behave like an external patch message, send through
  the shared message queue or view message context instead of duplicating logic
  in the component.
- UI-local sends may arrive without `meta.inletName`; edge-routed messages may
  arrive with only `inletKey`. Runtime dispatch should resolve metadata from
  object inlets, and single-inlet objects may default missing metadata to that
  inlet.
- Add runtime tests that prove behavior works without mounting the Svelte
  component. Include UI-originated and edge-routed message paths when they can
  differ.

## Text Objects

For text control objects:

- Create a class implementing `TextObjectV2` in the owning `ui/src/objects/<module>/`.
- Register it in `TEXT_OBJECTS` in `ui/src/lib/objects/v2/nodes/index.ts`;
  this file should stay a registry/import surface.
- Add it to the appropriate extension pack.
- Add object docs in `ui/static/content/objects/{name}.md`.
- Add AI object prompt coverage.
- Use TypeBox schemas for message types.

Object-box text objects can keep positional `params[]`. Use
`context.getParam()` / `context.setParam()` where that matches the expression
model. New visual runtime objects should prefer `getData()` / `setData()`.

Do not pattern-match text object messages against raw `P.string`, `P.array()`, or similar patterns. Define TypeBox schemas with `msg()`/`sym()`, wrap them with `schema()`, and match those wrappers.

## Schema Generation

Object schemas for docs are generated at build time with `bun run generate:schemas`.

Schema generation uses `RUNTIME_OBJECTS`, not only `TEXT_OBJECTS`, so docs can
include both text and visual definitions without making visual objects loadable
through `ObjectNode`.

When adding fields to `InletSchema` or `OutletSchema`, update:

- `ui/src/lib/objects/schemas/types.ts`
- `ui/src/lib/objects/schemas/from-v2-node.ts`
- `ui/scripts/generate-object-schemas.ts`, especially `emitPort()`

Then run `bun run generate:schemas`.

Manual schemas in `ui/src/lib/objects/schemas/*.ts` override generated schemas. If a generated field is missing from docs, check `ui/src/lib/objects/schemas/index.ts` for a manual override.

Keep manual schemas object-owned where possible and import them through the central schema registry.

## JS API Completions

When adding a JS API function such as `flash()`, `llm()`, or `fft()`:

- Add the function to `patchiesAPICompletions`.
- Add it to `topLevelOnlyFunctions` if it should not appear inside callbacks.
- Add every implementing node type to `nodeSpecificFunctions`.
- Implement it in each relevant runner/context.

## File Drag/Drop

When adding file drag/drop support:

- Add MIME type mapping in `ui/src/lib/vfs/path-utils.ts`.
- Add extension and MIME mappings in `CanvasDragDropManager`.
- Add VFS file handling in `getVfsFileNodeData()`.
- Add direct file handling in `getFileNodeData()`.
