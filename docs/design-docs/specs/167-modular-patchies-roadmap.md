# 167. Modular Patchies Roadmap

## Goal

Move Patchies toward a small, headless core that can:

- Run patch graphs without Svelte or XYFlow;
- Keep runtime objects alive when editor views unmount;
- Load object and service definitions dynamically;
- Support subpatches and external abstractions;
- Expose a stable embeddable/API-first surface;
- Keep strongly licensed objects, such as Strudel, in separate bundles.

## Related Specs

- [40. Headless Patcher System](40-headless-patcher-system.md)
- [47. Modular Patchies](47-modular-patchies-api-design.md)
- [100. Object Module Migration](100-object-module-migration.md)
- [134. Viewport Pause Culling for Main-Thread Nodes](134-viewport-pause-culling-for-main-thread-nodes.md)
- [168. Runtime Object And Editor Representations](168-runtime-object-editor-representations.md)
- [169. Build Your Own Patcher Vision](169-build-your-own-patcher-vision.md)
- [170. Agent-Extensible Patchies Vision](170-agent-extensible-patchies-vision.md)
- [Visual Object Headless Migration](../visual-object-headless-migration.md)

## End State

The core package owns the runtime graph, registries, message routing,
scheduling, persistence, and service interfaces. It must work without the editor.

`PatchRuntime` is the public runtime interface. The editor, headless tests,
host applications, embeds, and plugin harnesses use the same graph API. It owns
the runtime graph. Helper modules may support it, but editor adapters do not own graph state.

The editor is a UI host. It renders and edits an XYFlow graph. Then,
`EditorRuntimeReconciler` converts nodes and edges into a `PatchRuntime.setGraph` call.
The reconciler may know editor representation kinds. It does not own graph diffs,
runtime behavior, or object-specific data conversion.

Objects are runtime definitions registered with the core. A definition can include
behavior, ports, schemas, defaults, migrations, services, views, settings, docs,
prompts, and license metadata.

## Principles

- Runtime objects outlive views.
- The editor uses the same runtime interface as headless consumers.
- Ship playable vertical slices early while the deeper migration continues.
- Registries are mutable runtime services, not only static TypeScript files.
- Built-ins, development modules, remote bundles, and marketplace packages use one loading model.
- Plugins register through explicit capabilities instead of arbitrary internal imports.
- Subpatches are nested runtimes, not XYFlow groups.
- License boundaries follow dynamically-loaded bundle boundaries.

## Phase 1: Headless Runtime Boundary

Create a `PatchRuntime` that instantiates objects, applies graph changes, routes
messages, and coordinates message, audio, and video services without the editor.

`EditorRuntimeReconciler` converts XYFlow state into the public runtime graph
shape and calls `PatchRuntime.setGraph`. Imperative calls such as
`createObject`, `updateObject`, `connect`, `disconnect`, and `destroyObject`
remain available to headless consumers. They update the same runtime graph.

Svelte views attach to existing runtime state. They do not own runtime lifecycle.

Success criteria:

- Message/text objects can run in an API-only test.
- Editor mutations route through runtime methods.
- Remounting an object view does not reset runtime-owned state.
- Runtime tests cover UI-originated and edge-routed messages.

## Phase 2: View Lifecycle Compatibility

Make XYFlow object views cheap to create and safe to destroy. Then enable
`onlyRenderVisibleElements`. This phase also provides headless audio, video, and
object execution for later subpatches.

Views can render controls, handles, settings, editors, and previews. They do not
own message subscriptions, nodes, timers, workers, media streams, graph membership,
or persisted runtime state.

Success criteria:

- Offscreen view unmount/remount does not restart runtime objects.
- Representative object families have runtime tests without the editor.
- Representative views have mount/unmount coverage.
- A representative video/rendering object can keep running headlessly while its
  view is unmounted.

## Phase 3: Playable Subpatch Vertical Slice

Build a small subpatch object after the core split supports audio, video, and
message objects. The first version can use built-ins and current patch JSON. It
models subpatches as nested `PatchRuntime` instances, not XYFlow groups.

Success criteria:

- A parent patch loads an embedded or referenced child patch as an object.
- Parent and child exchange messages through explicit ports.
- Audio, video, and message objects inside the child patch keep running without
  the child editor view being open.
- The slice is useful enough to build small reusable abstractions.

## Phase 4: Dynamic Object And Service Registries

Turn static registries into built-in manifests with runtime registration APIs.

The registry should support objects, views, audio nodes, video renderers,
schemas, migrations, docs metadata, prompt metadata, shorthands, browser
metadata, replacement in development, and structured missing-object diagnostics.

Success criteria:

- A test registers a new object type at runtime.
- The editor object browser reads from the live registry.
- Missing object types produce diagnostics.

## Phase 5: Plugin Bundle Contract

Define a plugin manifest and registration function for local built-ins and trusted
remote bundles.

```ts
export const manifest = {
  id: "@patchies/strudel",
  version: "0.1.0",
  license: "AGPL-3.0-or-later",
  objects: ["strudel"],
};

export function register(ctx: PatchiesPluginContext) {
  ctx.objects.define(StrudelObject);
  ctx.views.define("strudel", () => import("./StrudelNode.svelte"));
}
```

Success criteria:

- At least one built-in object family moves behind the plugin contract.
- At least one trusted development plugin loads at runtime.
- Plugin load errors surface to API consumers and the editor.

## Phase 6: Full Subpatches And Abstractions

Expand the playable subpatch into external abstractions. A subpatch object owns a
child runtime, maps parent ports to child ports, and can render a nested editor or remain headless.

Success criteria:

- A parent patch loads a child patch as an object.
- Parent and child exchange messages through declared ports.
- Closing the child editor view does not stop the child runtime.

## Phase 7: Embeddable And API-First Packaging

Back `<x-patchies>` with the headless runtime and split package surfaces:

- `@patchies/core`: runtime, graph model, registries, message routing, service interfaces
- `@patchies/editor`: Svelte/XYFlow editor host
- `@patchies/web-component`: custom element wrapper
- `@patchies/plugin-*`: optional object/plugin bundles

The web component should support patch input, plugin URLs, editor/viewer/headless
modes, lifecycle events, and imperative runtime access.

Success criteria:

- A host app embeds Patchies without importing editor internals.
- A test constructs a patch graph through the core API.
- The editor and web component use the same runtime API.

## Licensing Direction

The long-term licensing goal is a thin core that could use the MIT license while
selected plugins use stronger licenses. AGPL-dependent objects must not be part
of the core or editor artifact.

This is not legal advice. Review the final bundle and distribution model before
changing project licensing.

## Migration Order

1. Add runtime object lifecycle APIs and migrate representative message objects.
2. Route editor graph mutations through `PatchRuntime`.
3. Convert representative audio, worker-backed video, and DOM-preview objects.
4. Make views remount-safe, then enable `onlyRenderVisibleElements` behind a flag.
5. Ship a playable subpatch object backed by nested `PatchRuntime`.
6. Turn static registries into a built-in plugin manifest.
7. Add trusted plugin loading.
8. Expand subpatches into reusable external abstractions.
9. Move Strudel or another heavy/licensed object to plugin-land.
10. Stabilize the web component and package split.

## Non-Goals

- Rewrite all objects in one migration.
- Move object docs out of `ui/static/content/objects/`.
- Use XYFlow groups as the runtime model for subpatches.
- Make remote plugin loading unrestricted.
- Promise a license change before technical and legal review.

## Open Questions

- Should plugin bundles be ESM-only, or should resource bundles support non-JS assets?
- How should patches declare plugin dependencies?
- Should runtime own undo/redo, or should editor history call runtime APIs?
- Which object family should become the first external plugin?
