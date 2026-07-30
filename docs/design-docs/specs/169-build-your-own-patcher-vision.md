# 169. Build Your Own Patcher

## Poom's Vision

I want Patchies to provide a headless runtime that people can use in their apps.
People should also be able to build their own patcher.

People want ownership of the app that they build. Some want to build or vibe-code
a small, focused, self-contained set of tools.

Patchies can provide a library, foundation, and building blocks for creative-coding
canvases. It can also connect to the wider creative-coding ecosystem.

Patchies has creative-coding systems for messages, audio, video, web workers,
peer-to-peer networking, and virtual machines.

The public API must be composable. People can use the default Patchies editor or
build a domain-specific editor, such as SVG placeholders for focused audio nodes.

Patchies ships useful creative-coding nodes. People can build their own nodes and
connect them to the Patchies ecosystem, such as ChucK sonification or video synth objects.

The [tldraw SDK](https://tldraw.dev) is an inspiration. It is a complete editor
and an extensible SDK for infinite-canvas apps.

## Related Vision

[170. Agent-Extensible Patchies Vision](170-agent-extensible-patchies-vision.md)
describes how people and external agent harnesses can create the objects,
presets, packs, and extensions that run in both the default editor and custom
Patchies host applications.

## Product Direction

Patchies should be a creative-patching runtime and object ecosystem.

The existing Patchies app is the default patcher built with that ecosystem,
not the only way to author or run a patch.

A host app should be able to use the runtime without accepting the
default editor's visual language or interaction model. It may offer an infinite
canvas, but it may instead be a stage, timeline, dashboard, game-like interface,
or a constrained domain-specific tool. The host can expose only a small,
curated subset of objects and represent them as SVG placeholders, controls, or
other domain-specific UI.

```text
Patchies core      runs a patch graph and provides creative capabilities
Patchies editor    is the complete default authoring experience
Host patcher       is a custom UI that authors the same patch graph
```

This is more than a headless editor.

The runtime owns reusable behavior: object lifecycle, graph execution, message
routing, audio and video pipelines, workers, persistence, diagnostics, and
plugin and object registration.

The host owns its product language: layout, selection, gestures, visuals,
workflows, and available objects.

## Design Principles

- The runtime graph is the shared executable representation, independent of
  XYFlow, Svelte, and any host layout model.
- The default editor is a first-party client of the public runtime interface,
  not a privileged implementation.
- Hosts may use the full object ecosystem or curate a small set of built-in and
  custom objects.
- Object definitions own execution behavior, ports, data, migrations, and
  metadata. Hosts choose object appearance and authoring.
- Public capabilities must be instance-scoped and host-configurable. A host
  controls browser permissions, audio context activation, workers, persistence,
  and network/P2P configuration rather than inheriting app-global behavior.
- Editor helpers should be optional, composable modules. Do not expose every
  internal editor store as a public contract.
- Built-in objects, local object packs, and external plugins use the same
  registration model.

## Experiences

A developer should be able to start with using the default Patchies editor:

```ts
// Use the complete default Patchies authoring experience.
mountPatchiesEditor(element, { patch, plugins: [standardObjects] });
```

Or, they could compose a custom patcher:

```ts
// Or compose a custom patcher around the same executable graph.
const patchies = await createPatchies({
  objects: [standardObjects, customSynthObjects],
  capabilities: { audio, video, workers, network },
});

await patchies.runtime.setGraph(graph);
```

The host's own document can keep presentation **separate from execution**:

```ts
type HostDocument = {
  graph: RuntimeGraphSpec;
  layout: Record<string, { x: number; y: number; svgTemplate?: string }>;
};
```

`RuntimeGraphSpec` is the Patchies-owned executable graph. `layout` belongs to
the host. It does not have to look like the default editor or be a canvas.

## Package Direction

The names can evolve, but the public surfaces should separate these roles:

- `@patchies/core`: graph runtime, object lifecycle, registries, routing,
  persistence contracts, diagnostics, and capability interfaces.
- `@patchies/objects-*`: installable built-in object packs and plugin bundles.
- `@patchies/editor`: the full Svelte/XYFlow default editor.
- `@patchies/editor-kit`: optional deep authoring modules shared by the default
  editor and hosts where they genuinely fit, such as graph editing, history,
  selection, palette, and inspector adapters.
- `@patchies/web-component`: a quick embed of the default editor, viewer, or
  headless runtime wrapper.

`editor-kit` does not export current editor internals. Its modules hide difficult
behavior while the host owns visuals and interaction design.

## Execution Plan

This vision extends the sequence in [167. Modular Patchies
Roadmap](167-modular-patchies-roadmap.md). It should progress through playable
host-facing slices rather than attempting a package split up front.

### 1. Make the Core Seam Usable Outside the App

Complete the graph-oriented `PatchRuntime` interface for representative
message, audio, video, and worker-backed objects. Define a small bootstrap
interface that creates a runtime with explicit host-provided capabilities.

Success criteria:

- A standalone app can create, load, mutate, observe, and destroy a patch
  without mounting Svelte or XYFlow.
- Runtime diagnostics and lifecycle events are observable without importing
  editor internals.
- Audio, worker, persistence, and network dependencies are configured per
  runtime instance.

### 2. Establish Object Packs as the Common Ecosystem

Turn the existing built-in registration paths into manifests/object packs, then
exercise the same registration interface with one local custom pack. Include
the metadata a host needs to build a focused picker or inspector: ports,
defaults, schemas, labels, icons, and documentation references.

Success criteria:

- A host can install a curated object pack without importing the default editor.
- A custom object connects to representative built-in audio and video objects.
- Missing object types and unavailable capabilities produce structured
  diagnostics.

### 3. Build a Deliberately Small Reference Patcher

Build one standalone example that is not a reskin of the full editor: for
example, an SVG stage where users drag a few focused objects onto a composition
and connect them through constrained interactions.

The example should keep its layout and interactions in host-owned state while
using the public runtime to execute its graph. It is both a product prototype
and the first integration test for the public interfaces.

Success criteria:

- The reference patcher uses no private editor imports.
- It can use existing Patchies objects plus one host-defined object.
- Its patch can open in the default editor, and a compatible default-editor
  patch can run in the reference patcher when its required object pack is
  installed.

### 4. Extract Only Proven Authoring Modules

Compare the reference patcher and the default editor. Extract an
`@patchies/editor-kit` module only where both need the same difficult behavior;
for example, graph transactions, history integration, keyboard routing, or a
palette adapter. Keep host presentation and workflow choices outside that
interface.

Success criteria:

- Each exported authoring module has at least two real clients or a clear,
  independently valuable interface.
- A host can use a module without adopting Svelte or XYFlow unless that module
  explicitly provides a Svelte/XYFlow adapter.

### 5. Stabilize Packaging and Embedding

Use the reference patcher and the default editor to establish package boundaries,
versioning, compatibility policy, capability permissions, and plugin loading.
The web component remains the fast path for embedding the default experience;
the core/runtime path remains the escape hatch for ownership.

Success criteria:

- The default editor, web component, and reference patcher execute through the
  same runtime and object-pack contracts.
- A host can upgrade packages with clear runtime/object-pack compatibility
  diagnostics.
- Optional or strongly licensed object packs stay outside the core bundle.

## Non-Goals

- Replacing the default Patchies editor with a generic SDK demo.
- Requiring every host patcher to use an infinite canvas, Svelte, or XYFlow.
- Publishing current internal stores and managers as a permanent public
  interface.
- Making unrestricted remote code or plugin loading part of the first slice.
- Migrating every existing object before proving the reference patcher.

## Open Questions

- What is the smallest reference patcher that feels distinct and emotionally
  compelling rather than like a reduced editor?
- Which host capabilities must be required, optional, or permission-gated?
- Which metadata is essential for a host to render a focused object picker and
  inspector without copying editor code?
- Should a patch have a separate host-layout document by default, or should
  layout be an optional extension of the executable graph?
- Which existing object family best demonstrates a custom object feeding both
  audio and video objects?
