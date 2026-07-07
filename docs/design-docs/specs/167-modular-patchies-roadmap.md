# 167. Modular Patchies Roadmap

## Goal

Move Patchies towards a thin, headless, extensible core that supports:

1. Enabling the XYFlow `onlyRenderVisibleElements` optimization. This destroys the Svelte component immediately when they are outside of viewport, then re-create as they enter viewport.

This means the Svelte component lifecycle must be lightweight and completely independent of the actual object lifecycle.

2. Makes Patchies object dynamically loadable. Currently, all objects are statically defined in `src/objects`. Ideally, you can give Patchies a URL to a JavaScript bundle or resource bundle, and it should be able to load new objects.

This means that the registries must allow for dynamic loading, and we must be able to quickly reload the patch graph somehow to dynamically load new objects.

3. Unlock ability to have subpatches and loading external patches inside the patch (i.e. Max/MSP style abstractions)

4. Makes Patchies operate-able as a headless and API-first library.

We should be able to load the patch JSON without rendering the XYFlow graph interface, or programmatically construct the patch graph at runtime. We should even be able to dynamically define new objects.

5. Makes Patchies embeddable in other application as a web component.

6. Make AGPL components such as Strudel not force the entire app to be AGPL licensed.

Ideally, the thin core of Patchies can be MIT-licensed in the future, whilst a subfolder for "Strudel" that are network-loaded (and maybe some other modules/objects) become AGPL licensed, for example. The network boundary is what makes dual licensing safe.

### Key specifications

This roadmap connects the earlier architecture specs into one migration path:

- [40. Headless Patcher System](40-headless-patcher-system.md) defines the first split between UI lifecycle and patch/object lifecycle.
- [47. Modular Patchies](47-modular-patchies-api-design.md) defines the long-term API direction for dynamic object, video, and audio registration.
- [100. Object Module Migration](100-object-module-migration.md) defines the current object-owned colocation boundary under `ui/src/objects/`.
- [134. Viewport Pause Culling for Main-Thread Nodes](134-viewport-pause-culling-for-main-thread-nodes.md) is a near-term performance bridge for offscreen DOM renderers, but it does not replace the need for UI/runtime lifecycle separation.
- [Visual Object Headless Migration](../visual-object-headless-migration.md) is the short implementation checklist for moving a Svelte-owned visual object into the decoupled runtime model.

The current `ui/src/objects/<object-or-family>` structure remains useful, but it should be treated as an internal packaging boundary on the way to separately loadable plugin bundles.

### How we can get there

1. Decouple the Svelte XYFlow UI component lifecycle from the object's actual component lifecycle. Things related to the object itself (e.g. video pipeline, audio pipeline, message handling) should be headless, and not coupled to the view/UI at all. So Patchies can operate purely as a headless API-only library without any XYFlow frontend visible.

2. Allow objects to be dynamically loaded, which includes service registration e.g. registering new video renderers in the rendering pipeline, or registering new audio nodes dynamically

3. Develop specifications for "plugins". Then, move most of Patchies objects under `src/objects` to become external plugins. This lets us move most code that are not universal to everyone's use cases to plugin-land.

## How the end state should look like

Patchies should have a **small core package** that owns the patch graph, object registry, message routing, scheduling, persistence, and service APIs. The core must be usable without Svelte, XYFlow, or the Patchies editor.

**The editor becomes a _UI host_ for that core.**

It renders an editable XYFlow graph when available, but the graph UI is not responsible for creating, running, or destroying patch objects. A node can leave the viewport, have its Svelte component destroyed by XYFlow, yet still keep its audio, video, message, timers, workers, and service subscriptions alive in the headless runtime.

**Objects become runtime definitions registered into the core.**

A definition may include headless behavior, ports, schemas, default data, migrations, services, optional editor views, optional settings views, AI prompt metadata, docs metadata, and bundle licensing metadata. Built-in objects should use the same registration path as external objects.

Patchies should expose an embeddable web component that can load a patch, load plugin bundles, choose an editor or playback-only UI, and expose an API surface to host applications.

## Principles

- **Runtime objects outlive views.** Svelte lifecycle hooks may attach previews, editors, controls, and handles, but they must not be the source of truth for object execution.
- **Registries are mutable runtime services.** Static TypeScript registry files may remain as bootstrapping helpers, but the core APIs must allow late registration and replacement.
- One object loading model should support built-ins, local development modules, remote bundles, and future marketplace packages.
- External plugins must register through explicit capabilities rather than importing arbitrary Patchies internals.
- Subpatches and abstractions are regular patch runtimes nested inside another runtime, not hidden XYFlow groups.
- License boundaries should follow bundle boundaries. AGPL objects such as Strudel should be isolated in separately loaded plugin bundles instead of being inseparable from the core app bundle.

## Phase 1: Headless Runtime Boundary

Create a `PatchRuntime` or equivalent service object that can load a patch JSON document, instantiate runtime objects, apply graph changes, route messages, and coordinate audio/video/message services without mounting the XYFlow editor.

The first implementation step is intentionally smaller than the final full-system
runtime: add a minimal `PatchRuntime` that owns lifecycle for one low-risk object
family, plus a lightweight editor reconciler that translates the XYFlow editor
graph into `createObject`, `updateObject`, and `destroyObject` runtime calls.
The editor reconciler may understand XYFlow nodes, but `PatchRuntime` should not.
Mounted Svelte views only attach to the existing runtime state. `PatchRuntime`
should remain a thin facade over focused runtime services such as message/object
lifecycle and audio routing, rather than becoming a monolithic owner of every
runtime concern. Runtime helpers should own lifecycle sync state such as audio
object identity tracking and suppression of duplicate recreations; Svelte views
should only report their current editor state. Message runtime helpers should
own parameter-change forwarding, view message subscriptions, and runtime-derived
object port lookup.

Current checkpoint as of 2026-07-07: `PatchRuntime` exists as a thin facade over
`PatchMessageRuntime` and `RuntimeAudioObjectAdapter`, and `EditorRuntimeReconciler`
translates XYFlow object nodes into runtime create/update/destroy calls.
Runtime-owned message contexts now survive same-node object replacement without
dropping existing message routing, while true deletion still unregisters the
message node. Audio objects are also visible to the runtime object registry check
so message endpoints can route control messages into audio parameters. This is
still a partial Phase 1 implementation: patch loading, graph-level connect APIs,
video runtime ownership, plugins, and subpatches remain future work.

The first UI-owned Svelte node validation slice is `button`. Its runtime
behavior lives in `ui/src/objects/button/ButtonObject.ts`, registered through the
same object service path as text objects. `ObjectService` owns the per-node
instance map and `MessageContext` lifecycle; `ButtonNode.svelte` only renders the
button and creates a view-local `MessageContext` with the same node id. The view
uses the shared message queue to inject click messages into the headless object
and to flash when inbound messages arrive; view cleanup must not unregister the
runtime message node.

This phase extends spec 40. The important shift is that the runtime owns object lifecycle:

- `createObject(node)` creates or reuses a runtime object instance.
- `updateObject(id, data)` applies node data changes.
- `connect(edge)` and `disconnect(edge)` update message, audio, and video routing.
- `destroyObject(id)` tears down the runtime object.
- `mountView(id, host)` attaches optional UI resources to an already-running object.
- `unmountView(id, host)` detaches optional UI resources without destroying the object.

Success criteria:

- A simple patch with message/text objects can run through an API-only test with no Svelte component mounted.
- Existing editor mutations are routed through the runtime API instead of directly coupling every object behavior to XYFlow state.
- Object views can be remounted without resetting runtime-owned state.

## Phase 2: View Lifecycle Compatibility

Make every XYFlow-rendered object view cheap to create and safe to destroy. This unlocks the Svelte Flow `onlyRenderVisibleElements` optimization, whose documentation describes it as rendering only viewport-visible nodes and edges for large graphs, with extra overhead to consider.

This phase builds on spec 134 but is stronger than pause culling. Pause culling reduces work for selected offscreen renderers while their components still exist. `onlyRenderVisibleElements` means offscreen Svelte components may not exist at all.

Object views should be limited to:

- displaying runtime state;
- sending UI intents back to the runtime;
- attaching optional preview surfaces;
- measuring node handles and dimensions;
- opening settings/editor affordances.

Object views should not own:

- message subscriptions;
- audio nodes;
- video render nodes;
- long-running timers;
- workers;
- media stream ownership;
- patch graph membership;
- persisted object state.

Success criteria:

- The editor can enable `onlyRenderVisibleElements` behind a feature flag.
- Panning a running patch offscreen and back does not restart runtime objects unless their own runtime data changed.
- Runtime tests cover object execution without the editor, and UI tests cover view mount/unmount behavior for representative object families.

## Phase 3: Dynamic Object And Service Registries

Replace static registry assumptions with runtime registration APIs. Current files such as `node-types.ts`, audio node indexes, text object indexes, schema indexes, prompts, default data, and render-type registries should become built-in plugin manifests rather than the only source of truth.

The registry should support:

- registering object definitions after startup;
- registering view components lazily;
- registering audio node definitions;
- registering video renderer definitions;
- registering schemas, migrations, docs metadata, prompt metadata, shorthands, and object browser metadata;
- unregistering or replacing development-time definitions when safe;
- reporting missing object types when loading a patch.

Patch reload should become explicit: load patch JSON, discover missing object/plugin requirements, load required bundles, register definitions, then instantiate the graph. In development mode, a plugin reload may tear down and recreate only the affected runtime objects if the definition identity changes.

Success criteria:

- A test can define a new object type at runtime and use it in a patch without editing static registries.
- The editor object browser reads from the live registry.
- Missing object types produce structured diagnostics instead of silent fallback behavior.

## Phase 4: Plugin Bundle Contract

Define a plugin contract that works for local built-ins and remote bundles.

A plugin bundle should export a manifest and a registration function:

```ts
export const manifest = {
  id: '@patchies/strudel',
  version: '0.1.0',
  license: 'AGPL-3.0-or-later',
  objects: ['strudel'],
  patchies: { minVersion: '0.1.0' }
};

export function register(ctx: PatchiesPluginContext) {
  ctx.objects.define(StrudelObject);
  ctx.views.define('strudel', () => import('./StrudelNode.svelte'));
  ctx.audio.define(...);
}
```

The plugin context should expose explicit service capabilities instead of raw imports from `ui/src/lib`. For example, a video object can register a renderer through the video service, but it should not reach into internal render-worker implementation details unless the service API intentionally exposes that extension point.

Remote plugin loading should be opt-in and policy controlled. The first version can support trusted URLs only. Later versions can add integrity hashes, lockfiles, allowlists, permissions, and marketplace metadata.

Success criteria:

- At least one built-in object family is moved behind the plugin contract while still being bundled locally.
- At least one development plugin can be loaded from a URL or local dev server during runtime.
- Plugin load errors are visible to both API consumers and the editor UI.

## Phase 5: Subpatches And Abstractions

Represent subpatches as nested `PatchRuntime` instances. A subpatch object owns a child runtime, maps parent inlets/outlets to child patch ports, and can be rendered as an editable nested editor or kept headless.

This should not depend on XYFlow group nodes. Visual groups organize the canvas; subpatches define runtime composition.

Requirements:

- A patch can reference an external patch resource by URL, VFS path, package resource, or embedded patch JSON.
- Subpatch port definitions are explicit so the parent graph can connect safely.
- Child runtime lifecycle follows the parent object lifecycle, not the child editor view lifecycle.
- Missing plugins inside a subpatch are resolved through the same plugin loader as top-level patches.

Success criteria:

- A parent patch can load a child patch as an object and send/receive messages through declared ports.
- Opening and closing the child editor view does not stop the child runtime.
- External abstractions can be reused across patches.

## Phase 6: Embeddable And API-First Packaging

Promote the existing `<x-patchies>` custom element into a stable embed surface backed by the headless runtime.

The web component should support:

- `src` or `patch` input;
- plugin bundle URLs;
- editor, viewer, or headless/playback modes;
- lifecycle events such as ready, load error, plugin error, patch changed, and runtime error;
- an imperative API for host apps to load patches, send messages, inspect runtime state, and register objects when allowed.

The package split should make the core usable without the editor:

- `@patchies/core`: runtime, graph model, registries, message routing, service interfaces.
- `@patchies/editor`: Svelte/XYFlow editor host.
- `@patchies/web-component`: custom element wrapper.
- `@patchies/plugin-*`: optional object/plugin bundles.

Success criteria:

- A host application can embed Patchies as a web component without importing the editor source tree.
- A test can construct a patch graph programmatically through the core API.
- The editor and web component both use the same runtime APIs.

## Licensing Direction

The long-term licensing goal is a thin core that can plausibly be MIT-licensed while selected plugins carry stronger licenses. The practical architecture requirement is that AGPL-dependent objects are not statically bundled into the core/editor artifact that every consumer must distribute.

Strudel is the first concrete case. It should move toward a separately loadable plugin bundle with its own license metadata. The editor may offer a convenient installer or trusted default source, but the dependency boundary should remain explicit.

This spec is not legal advice. Before changing project licensing, the bundle structure and distribution model should be reviewed with someone qualified to assess AGPL network/distribution implications.

## Migration Order

1. Add runtime object lifecycle APIs and migrate one low-risk message object.
2. Route editor graph mutations through the runtime API.
3. Convert representative object families: message-only, audio, worker-backed video, DOM-preview video.
4. Make views remount-safe, then enable `onlyRenderVisibleElements` behind a feature flag.
5. Turn existing static registries into a built-in plugin manifest.
6. Add dynamic plugin loading for trusted bundles.
7. Move Strudel or another heavy/licensed object to plugin-land.
8. Implement subpatch runtime objects.
9. Stabilize the web component and package split.

## Non-Goals

- Do not rewrite all objects in one migration.
- Do not move docs out of `ui/static/content/objects/` unless a later docs packaging spec says so.
- Do not use XYFlow groups as the runtime model for subpatches.
- Do not make remote plugin loading unrestricted by default.
- Do not make every object support hot replacement in the first plugin milestone.
- Do not promise a license change before the technical boundary and legal review are complete.

## Open Questions

- Should plugin bundles be ESM-only, or should resource bundles support non-JS assets and manifests without executable code?
- What is the minimum stable object definition interface for the first runtime object migration?
- How should patches declare plugin dependencies: inline manifest, lockfile, package references, or all three?
- Should the runtime own undo/redo semantics, or should the editor continue to own history while calling runtime APIs?
- Which object family should become the first external plugin: Strudel for licensing pressure, or a smaller object for lower migration risk?
