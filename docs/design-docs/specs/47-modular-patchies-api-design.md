# 47. Modular Patchies API Design

Status: Active architecture target, partially implemented through object/audio registries.

Last verified against code: 2026-07-06.

## Goal

Keep the core runtime small. Let objects, renderers, audio nodes, views, docs
metadata, and licensed integrations register at runtime.

This spec supports [167. Modular Patchies Roadmap](167-modular-patchies-roadmap.md).
It defines APIs for dynamic definitions and plugins.

## Current State

Patchies has made this progress since the first version of this spec:

- Object-owned code is colocated under `ui/src/objects/<object-or-family>` as described in [100. Object Module Migration](100-object-module-migration.md).
- `ObjectRegistry` supports registering V2 text object constructors and aliases.
- `AudioRegistry` supports registering V2 audio node constructors and aliases.
- `ObjectService` and `AudioService` instantiate registered text/audio classes outside the Svelte component tree.
- The object browser combines static schemas, static node types, `ObjectRegistry`, and `AudioRegistry`.
- The render type registry imports object-owned render-node type members from `ui/src/objects`.
- `<x-patchies>` exists as a custom element entry point.

The product is not yet dynamically modular:

- UI node components are still statically imported in `ui/src/lib/nodes/node-types.ts`.
- Object schemas are still collected through static imports in `ui/src/lib/objects/schemas/index.ts`.
- AI object descriptions, prompts, default node data, extension packs, shorthands, and render-node unions are still compile-time surfaces.
- There is no remote plugin loader, plugin manifest format, plugin permission model, or plugin dependency resolver.
- Built-in objects and AGPL-dependent objects such as Strudel are still bundled with the app.
- The existing web component mounts the full editor and does not expose a stable API-first runtime surface yet.

## API Shape

The long-term API exposes one runtime object:

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

An object definition describes runtime behavior and optional editor features:

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

Definitions can also provide or reference:

- object schema metadata;
- default data;
- migrations;
- object browser metadata;
- docs metadata;
- AI prompt metadata;
- editor view factories;
- settings view factories;
- required services or permissions.

V2 text object and audio node classes are the closest current implementation.
Next, register their metadata at runtime instead of splitting it across static files.

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

Static registry files can bootstrap built-ins. They should become generated or
declarative built-in plugin manifests. They must not be the only place an object exists.

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

The plugin context exposes stable service APIs. Plugins do not use arbitrary
`ui/src/lib` internals. Add an explicit API when a plugin needs a renderer, audio
node, worker channel, VFS access, or settings surface.

## Patch Loading Flow

Patch loading becomes dependency-aware:

1. Parse patch JSON.
2. Read declared plugin dependencies and object types present in the graph.
3. Resolve missing object types to known plugin sources when possible.
4. Load trusted plugin bundles.
5. Register object, service, schema, view, and metadata definitions.
6. Instantiate the graph through the headless runtime.
7. Report unresolved types as structured diagnostics.

Development hot reload can be conservative. It can destroy and recreate affected
runtime objects when a plugin definition changes.

## Licensing Boundary

Dynamic plugins also create clearer license boundaries.

The core and editor bundle does not include every optional dependency. Move
AGPL-dependent objects, such as Strudel, to separately loaded plugin bundles with
explicit license metadata. The app can offer a trusted source or installer, but
the dependency boundary stays visible.

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
