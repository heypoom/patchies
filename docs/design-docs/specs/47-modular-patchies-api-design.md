# 47. Modular Patchies API Design

Status: Active architecture target, partially implemented through object/audio registries.

Last verified against code: 2026-07-06.

## Goal

Make Patchies modular enough that the core runtime can stay small while objects, renderers, audio nodes, editor views, docs metadata, and licensed integrations can be registered dynamically.

This spec supports [167. Modular Patchies Roadmap](167-modular-patchies-roadmap.md). It focuses on the API shape for dynamic definitions and plugins.

## Current State

Patchies has moved a long way from the original version of this spec:

- Object-owned code is colocated under `ui/src/objects/<object-or-family>` as described in [100. Object Module Migration](100-object-module-migration.md).
- `ObjectRegistry` supports registering V2 text object constructors and aliases.
- `AudioRegistry` supports registering V2 audio node constructors and aliases.
- `ObjectService` and `AudioService` instantiate registered text/audio classes outside the Svelte component tree.
- The object browser combines static schemas, static node types, `ObjectRegistry`, and `AudioRegistry`.
- The render type registry imports object-owned render-node type members from `ui/src/objects`.
- `<x-patchies>` exists as a custom element entry point.

The codebase is not yet dynamically modular in the product sense:

- UI node components are still statically imported in `ui/src/lib/nodes/node-types.ts`.
- Object schemas are still collected through static imports in `ui/src/lib/objects/schemas/index.ts`.
- AI object descriptions, prompts, default node data, extension packs, shorthands, and render-node unions are still compile-time surfaces.
- There is no remote plugin loader, plugin manifest format, plugin permission model, or plugin dependency resolver.
- Built-in objects and AGPL-dependent objects such as Strudel are still bundled with the app.
- The existing web component mounts the full editor and does not expose a stable API-first runtime surface yet.

## API Shape

The long-term API should expose one runtime object:

```ts
const patchies = await createPatchiesRuntime({
  plugins: ['https://example.com/patchies-strudel/plugin.js']
});

patchies.objects.define(MyObject);
patchies.audio.define(MyAudioNode);
patchies.video.define(MyRenderer);

await patchies.loadPatch(patchJson);
patchies.send('node-id', { type: 'bang' });
```

The API should work in three contexts:

- **Editor:** Svelte/XYFlow renders views for runtime objects.
- **Headless:** host code constructs and runs a graph without rendering the editor.
- **Embed:** a web component wraps the runtime and exposes attributes, events, and imperative methods.

## Object Definitions

An object definition should describe both runtime behavior and optional editor affordances:

```ts
class DelayObject {
  static type = 'delay';
  static inlets = [{ name: 'in', type: 'message' }, { name: 'delay', type: 'float' }];
  static outlets = [{ name: 'out', type: 'message' }];

  constructor(nodeId, context) {}

  create(params) {}
  update(data) {}
  destroy() {}
  onMessage(data, meta) {}
}
```

Definitions may also provide or reference:

- object schema metadata;
- default data;
- migrations;
- object browser metadata;
- docs metadata;
- AI prompt metadata;
- editor view factories;
- settings view factories;
- required services or permissions.

The existing V2 text object classes and V2 audio node classes are the nearest current implementation. The next step is to make the surrounding metadata dynamically registerable instead of split across static files.

## Service Registries

Patchies should expose dynamic registries for each extension point:

- `objects.define(definition)` for text/message objects;
- `audio.define(definition)` for audio nodes and native DSP wrappers;
- `video.define(definition)` for render-worker/FBO renderers;
- `views.define(type, loader)` for editor node views;
- `schemas.define(type, schema)` for docs, ports, validation, and object browser descriptions;
- `defaults.define(type, factory)` for default node data;
- `prompts.define(type, promptMetadata)` for AI object generation;
- `packs.define(pack)` for object browser categories and installable bundles;
- `shorthands.define(shorthand)` for object text expansion;
- `migrations.define(migration)` for patch data upgrades.

Static registry files may continue to bootstrap built-ins, but they should become generated or declarative built-in plugin manifests, not the only place an object can exist.

## Plugin Contract

A plugin bundle should export a manifest and a registration function:

```ts
export const manifest = {
  id: '@patchies/strudel',
  version: '0.1.0',
  license: 'AGPL-3.0-or-later',
  objects: ['strudel'],
  patchies: { minVersion: '0.1.0' },
  resources: ['./StrudelNode.svelte', './worker.js']
};

export async function register(ctx) {
  ctx.objects.define(StrudelObject);
  ctx.views.define('strudel', () => import('./StrudelNode.svelte'));
  ctx.schemas.define('strudel', strudelSchema);
  ctx.defaults.define('strudel', () => ({ code: DEFAULT_STRUDEL_CODE }));
}
```

The plugin context should expose stable service APIs. Plugins should not reach into arbitrary `ui/src/lib` internals. If a plugin needs a capability, such as a video renderer, audio node, worker channel, VFS access, or settings surface, the plugin API should expose that capability intentionally.

## Patch Loading Flow

Patch loading should become dependency-aware:

1. Parse patch JSON.
2. Read declared plugin dependencies and object types present in the graph.
3. Resolve missing object types to known plugin sources when possible.
4. Load trusted plugin bundles.
5. Register object, service, schema, view, and metadata definitions.
6. Instantiate the graph through the headless runtime.
7. Report unresolved types as structured diagnostics.

For development, hot reload can be conservative. It is acceptable to tear down and recreate affected runtime objects when a plugin definition changes.

## Licensing Boundary

Dynamic plugins are also the path toward cleaner licensing boundaries.

The core/editor bundle should not be forced to include every optional dependency. AGPL-dependent objects such as Strudel should move toward separately loaded plugin bundles with explicit license metadata. The app can offer a trusted source or installer, but the dependency boundary must remain visible.

This spec is a technical design, not legal advice. Any licensing change should be reviewed separately once the bundle boundary exists.

## Milestones

1. Wrap the current built-in text/audio registry initialization in a built-in plugin manifest.
2. Add dynamic schema/default-data/view registration for one small object.
3. Make the object browser read from the live registry surface instead of static lists plus ad hoc fallbacks.
4. Load one trusted development plugin bundle at runtime.
5. Move one low-risk built-in object family behind the plugin contract while still bundling it locally.
6. Move Strudel or another heavy/licensed object to a separately loadable plugin bundle.
7. Use plugin dependency metadata during patch load and subpatch load.

## Success Criteria

- A test can register a new message object at runtime and instantiate it in a patch without editing static registry files.
- A plugin can register an object view lazily.
- A missing object type produces a structured load error with plugin-resolution hints.
- Built-in objects and external objects use the same registration API.
- The editor, headless runtime, and web component all consume the same registered definitions.

## Non-Goals

- Do not require remote plugin loading before local/built-in plugin manifests work.
- Do not expose unstable internal services just to make the first plugin easy.
- Do not make every existing static registry disappear in one refactor.
- Do not promise hot replacement for every object type in the first plugin milestone.
