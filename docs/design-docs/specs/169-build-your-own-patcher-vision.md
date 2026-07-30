# 169. Build Your Own Patcher

## Poom's Vision

I want to make Patchies into a headless editor that people can use in their own app without the editor interface, and ultimately people should be able to build their own patcher.

Most people would prefer to have a sense of ownership in the app they're building. Some people want to build or "vibe code" their own small, self-contained, one-off, focused set of tools.

Patchies can act as a library, a foundation, and a set of building blocks where people can compose their own infinite canvases for creative coding, with ample integrations with the rest of the creative coding ecosystem.

Patchies has systems and primitives for creative coding: messaging, audio pipeline, video pipeline, web worker management, peer-to-peer networking, virtual machines, and a whole lot more.

The idea is that we export a set of public API that is composable. People can start with the default Patchies editor UX, or build / "vibe code" their own domain-specific editors that are more tailored into their usage patterns e.g. drag-and-drop SVG placeholders of a few focused audio nodes.

The advantage is Patchies already ships with a lot of nodes that are pretty useful for creative coding. They can build their own sets of nodes, but also connect it with the rest of Patchies ecosystem e.g. sonification in ChucK, feeding their custom synth into Patchies' video synthesizer objects.

My inspiration is the [TLDraw SDK](https://tldraw.dev) where people can "Build infinite canvas apps in React with the tldraw SDK". TLDraw is an excellent editor on its own, but the SDK makes it extensible.

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

This is stronger than treating Patchies as a headless editor.

The runtime owns the difficult reusable behavior: object lifecycle, graph execution,
message routing, audio and video pipelines, workers, persistence, diagnostics, and
plugin/object registration.

The host owns its product language: layout,
selection, gestures, visual representation, focused workflows, and which
objects are available to its users.

## Design Principles

- The runtime graph is the shared executable representation, independent of
  XYFlow, Svelte, and any host layout model.
- The default editor is a first-party client of the public runtime interface,
  not a privileged implementation.
- Hosts may use the full object ecosystem or curate a small set of built-in and
  custom objects.
- Object definitions own their execution behavior, ports, data, migrations, and
  metadata; hosts choose how those objects look and are authored.
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
the host; it doesn't have to look like the default editor or even be a canvas.

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

`editor-kit` is intentionally not an export of current editor internals. Its
modules should **hide the behavior that is difficult to re-implement** while leaving
the host free to own visual and interaction design.

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
