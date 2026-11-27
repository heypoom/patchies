# 200. Patchies V2 Primitives

Status: Exploration. Nothing is implemented. This file keeps the context of a
design conversation. It is not a committed plan.

## Poom's Vision

The headless parts of Patchies may be more useful than the editor. Patchies V2
is the end state of [40. Headless Patcher System](40-headless-patcher-system.md)
and [167. Modular Patchies Roadmap](167-modular-patchies-roadmap.md), plus a
primitive library layer underneath them.

People should be able to embed Patchies pieces in other websites: a WebGPU render
graph, a fast infinite canvas, or a GLSL to WGSL translator, each on its own.
The patchies.app editor composes the same primitives.

## North Stars

Patchies V2 aims for all of these. Some will have to give.

- Low resource use: CPU, GPU, and memory.
- Embeddable on websites, as web components or as primitives such as
  `@patchies/renderer` and `@patchies/canvas`.
- A very large number of nodes, such as 1,000,000 buttons.
- Usable without a browser: messaging, audio, video with Dawn, and JavaScript code.
- DOM and web primitives as islands.
- Minimal by default: usable as libraries, and modular.
- Video and audio.
- WebGPU particles and geometry.

### Where They Conflict

| Conflict                                     | Why it is hard                                                                               | What reconciles it                                                                                             |
| -------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Low resources and 1M nodes                   | The WebGPU canvas that makes 1M nodes possible has a fixed memory cost, even for one button. | Free the canvas when idle, size it to the content, and use the Canvas 2D fallback for small embeds (spec 197). |
| Low resources and video, particles, geometry | GPU work is expensive.                                                                       | Frame budgets, culling, capped preview rates, and rendering only what is used (spec 198).                      |
| Embeddable and low resources                 | Five embeds could mean five workers, devices, and canvases.                                  | One shared runtime per page, and pausing off-screen embeds. See Embedding.                                     |
| Off-thread rendering and simplicity          | A worker costs memory and startup time, which a small embed may not need.                    | `Renderer` and `OffthreadRenderer` share one interface.                                                        |
| Without browsers and DOM islands             | Islands exist only where there is a DOM.                                                     | Capability tags: islands are a browser-host feature (spec 199).                                                |
| Without browsers and audio                   | Real-time audio needs a real-time thread that Node and Deno do not provide.                  | A native-backed audio engine. Unsolved (spec 199).                                                             |

### Where They Reinforce Each Other

- Minimal by default, embeddable primitives, and running without browsers are the
  same work. A primitive that imports almost nothing and knows nothing about
  patches is easy to embed, easy to keep MIT, and easy to run on Dawn.
- WebGPU serves 1M nodes, particles and geometry, and running without browsers.
- DOM islands keep 1M nodes and rich UI compatible.
- Plugins make minimal by default and full-featured both true, and they are the
  license boundary.

### If Something Has to Give

This is a recommendation, not a decision:

1. Relax 1M nodes to a soft target first. 100,000 is still about 10× what an
   optimized XYFlow shows at once.
2. Scope running without browsers to messaging and video first. Native audio is
   the hardest piece.
3. Keep embeddable, minimal, video, and audio. They are what makes Patchies Patchies.

## Layers

```
┌─ Apps ──────────────────────────────────────────────────────────┐
│  patchies.app editor  │  <x-patchies> embed  │  host apps, CLI  │
├─ Runtime ───────────────────────────────────────────────────────┤
│  @patchies/core: patch graph, objects, messages, scheduling    │
├─ Primitives (know nothing about patches) ───────────────────────┤
│  @patchies/renderer  │  @patchies/canvas  │  @patchies/shader   │
│  WebGPU render graph │  infinite canvas   │  GLSL to WGSL       │
└─────────────────────────────────────────────────────────────────┘
```

Spec 167 already splits `@patchies/core`, `@patchies/editor`,
`@patchies/web-component`, and `@patchies/plugin-*`. This spec adds the primitive
layer under `@patchies/core`.

## The Primitive Rule

Primitives do not know what a patch is.

- The renderer knows nodes, textures, parameters, and connections. It does not
  know messages, inlets, or objects.
- The canvas knows node shapes, hit regions, a camera, and DOM islands. It does
  not know objects or patch semantics.
- The shader library translates shader code. It knows nothing about nodes.

`@patchies/core` wires objects to primitives through adapters. A `glsl` object
becomes a renderer node. Its box becomes a canvas node.

This keeps each primitive useful without the patcher. A website can embed only a
shader pipeline, or only a fast node canvas.

Invariant 14 in [207](207-v2-architecture-invariants.md) extends this rule to every
V2 system, including the native host, multiplayer, agent integration, and testing:
each has a generic core and a thin Patchies adapter. Generic graph vocabulary, such
as canvas nodes and render graph nodes and edges, is allowed. Patchies object types,
port kinds, message routing, and the patch document schema are not.

## `@patchies/renderer`

A WebGPU render graph, described in [198. WebGPU Render Core](198-webgpu-render-core.md).

```ts
import { OffthreadRenderer } from "@patchies/renderer";

const renderer = new OffthreadRenderer();

renderer.addNode({ id: "a", type: "glsl", code: shadertoyCode });
renderer.addNode({ id: "b", type: "wgsl", code: wgslCode });
renderer.connect({ from: "a", to: "b", input: 0 });
renderer.setParams("b", { strength: 0.4 });

renderer.setOutput("b", canvasElement);

renderer.on("error", (error) => {
  // error.nodeId, error.line: mapped back to the user's GLSL lines
});
```

- `Renderer` runs on the calling thread. `OffthreadRenderer` runs in a worker.
  Both share one interface. Only the transport differs: direct calls versus
  messages to a worker.
- `setOutput` takes a canvas element. The renderer transfers it to the worker as
  an OffscreenCanvas and presents directly. A `bitmaprenderer` context would copy
  every frame.
- Node types are registered: `registerNodeType('q5', definition)`. `glsl`, `wgsl`,
  `q5`, and POPs are renderer plugins, not hard-coded types.
- `new Renderer({ device })` accepts an existing GPU device, such as a Dawn device
  outside the browser, for [199. Portable Patchies Runtime](199-portable-patchies-runtime.md).

### Dependencies

`@patchies/renderer` is MIT-licensed and imports almost nothing. WebGPU is built
into the browser, so the renderer needs no graphics library.

| Dependency                                           | Why                                   | License                                                                                                                                          |
| ---------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| WebGPU                                               | built into the browser, not a package | n/a                                                                                                                                              |
| `@patchies/shader`                                   | `glsl` nodes, loaded on first use     | MIT                                                                                                                                              |
| the TypeScript translator, or glslang + Tint or Naga | translation inside `@patchies/shader` | permissive: glslang is mostly BSD-3-Clause, Tint ships with Dawn under a BSD-style license, Naga is MIT or Apache-2.0. Verify before publishing. |

Hydra, q5, textmode, Three.js, and Pixi live in plugins that register node types
with the renderer.

## `@patchies/canvas`

A fast, interactive infinite canvas, described in
[197. Canvas Editor and DOM Islands](197-canvas-editor-and-dom-islands.md).

```ts
import { InfiniteCanvas } from "@patchies/canvas";

const canvas = new InfiniteCanvas({ container });

canvas.registerNodeType("bang", {
  draw: (node) => [{ circle: { r: 12, stroke: 1 } }],
  hit: [{ region: "body", circle: { r: 12 } }],
});

canvas.addNodes(buttons);

canvas.on("click", ({ nodeId, region }) => {
  // flash the bang, send a message, and so on
});

canvas.mountIsland(nodeId, (element) => {
  // mount real DOM into element

  return cleanup;
});
```

- Node types declare shapes and hit regions instead of being components.
- `addNodes` is a bulk API. Nodes live in typed arrays, so 1,000,000 nodes fit.
  The canvas spike drew 1M buttons in about 4–5 ms per frame.
- DOM islands are part of the public API, for nodes that need real DOM.

### Display List

Node types return a retained display list, not drawing calls. A painter turns it
into pixels, so node authors never touch Canvas 2D or WebGPU. Spec 197 describes
the vocabulary, the Canvas 2D and WebGPU painters, when each is chosen, and the
measured costs.

### Controller and Painter

The canvas has two halves:

- **Controller (main thread):** input, hit-testing, node state, the camera, and
  DOM islands. This is the interactive part.
- **Painter (wherever the GPU device lives):** draws the shapes.

```ts
// Paints on the main thread with its own device. Fine for embeds without video.
new InfiniteCanvas({ container });

// Paints inside the renderer's worker, so node previews need no copies.
new InfiniteCanvas({ container, painter: renderer });
```

The patchies.app editor uses the second form. Spec 198 explains why: the worker
owns the GPU device, and textures cannot cross threads.

## `@patchies/shader`

A GLSL to WGSL translator with a Shadertoy-aware preprocessor, built on
[`glsl-to-wgsl`](https://github.com/heypoom/glsl-to-wgsl): a TypeScript library,
16 KB gzipped, with no WASM. It matches WebGL2 more often than glslang + Tint or
Naga. Spec 198 has its results and what Patchies still needs from it.

- The renderer depends on it for `glsl` nodes. It is small enough to ship inline,
  with no lazy-loaded WASM.
- It stays usable on its own: in other WebGPU apps, in build tools that
  pre-translate presets, and on a server.
- The GLSL on WebGPU spike translated 36 of 36 self-written Shadertoy-style test
  shaders with glslang and Tint, and 32 of 36 with Naga. Real Shadertoy pass
  rates still need measuring. Spike results:
  `spikes/glsl-webgpu/FINDINGS.md` on branch `claude/glsl-webgpu-spike-36d5a4`.
- Download sizes: glslang and Tint total about 2.7 MB raw, 0.7–0.9 MB compressed.
  A trimmed Naga (GLSL in, WGSL out) is about 971 KB raw, 230–290 KB compressed.

## `@patchies/core`

The headless runtime from specs 40 and 167: the patch graph, object lifecycles,
message routing, scheduling, and registries.

Core adapters connect runtime objects to primitives:

- a video object registers a renderer node and keeps it while its view unmounts;
- an object's editor representation registers a canvas node type;
- DOM-backed views mount as canvas islands.

Core does not import the editor. It depends on primitives only through these adapters.

## Apps

- **patchies.app editor:** composes `@patchies/core`, `@patchies/canvas`, and
  `@patchies/renderer`, plus panels, history, and the object browser.
- **`<x-patchies>`:** the web component from spec 167, backed by the same runtime.
- **Host apps:** use any layer directly.
- **Native hosts:** use `@patchies/core`, `@patchies/renderer`, and
  `@patchies/canvas` outside the browser (specs 199 and 201). The canvas runs
  natively with the WebGPU painter only, and DOM islands are browser-only, so
  nodes that need them load as placeholders.

## Embedding

### Shared Runtime Per Page

A page can hold several Patchies elements, such as several outputs:

```html
<patchies-output size="300x300" src="./mountain.json"></patchies-output>
<patchies-output size="500x500" src="./river.json"></patchies-output>
```

Elements on one page share one runtime. The first element creates it, later
elements reuse it, and it shuts down when the last element detaches.

```ts
class PatchiesOutput extends HTMLElement {
  connectedCallback() {
    this.output = PatchiesRuntime.shared().attachOutput(this.canvas, {
      patch: this.patch,
      resolution: [300, 300],
    });
  }

  disconnectedCallback() {
    this.output.detach();
  }
}
```

Each element's canvas is configured with the shared GPU device. In the off-thread
renderer, all canvases are transferred to the same render worker. One frame loop
renders every patch and presents each output to its canvas.

| Shared once per page                                      | Separate per patch                                 |
| --------------------------------------------------------- | -------------------------------------------------- |
| GPU device and render worker                              | the patch graph, objects, and their state          |
| compiled shaders and pipelines                            | output resolution and render targets               |
| the GLSL translator                                       | message routing                                    |
| shared resource pool ([117](117-shared-resource-pool.md)) | transport and BPM, on top of a shared page clock   |
| frame loop and frame budget                               | errors: one patch failing must not stop the others |
| one `AudioContext`, with a gain bus per patch             | storage, scoped by patch ID                        |

- Each canvas keeps its own swapchain surfaces. A 300×300 output at DPR 2 costs
  about 10 MB, so five small outputs cost about 50 MB.
- Two elements showing the same patch render it once and present the same texture.
- `send` and `recv` names are scoped per patch by default. An explicit page-wide
  prefix lets embeds talk to each other.
- One `AudioContext` avoids the browser's limit on contexts and needs one user
  gesture to start.
- Visible elements get frame budget first. Off-screen elements pause through an
  `IntersectionObserver`, and a heavy patch cannot starve a light one.
- The runtime registers on a global key, such as
  `globalThis[Symbol.for('patchies.runtime')]`, so two compatible copies of the
  library on one page find each other.
- Elements inside an iframe have their own JavaScript environment and their own device.
- Device loss affects every element at once, and recovery lives in one place.
- An `isolated` attribute opts an element out of the shared runtime.

### Trusted and Sandboxed Patches

Patches contain code. A patch loaded into the page runs with the host page's
privileges: its origin, cookies, and storage. Isolation is the page author's choice
per element:

```html
<!-- Trusted: runs in the page and shares the GPU device. -->
<patchies-output src="./mountain.json"></patchies-output>

<!-- Sandboxed: runs in a cross-origin iframe with its own device. -->
<patchies-output
  src="https://someone.else/river.json"
  sandbox
></patchies-output>
```

| Mode      | Patch code can touch the host page | Shares the runtime | Controlled by |
| --------- | ---------------------------------- | ------------------ | ------------- |
| Trusted   | yes                                | yes                | direct calls  |
| `sandbox` | no                                 | no                 | `postMessage` |

- A same-origin `src` is trusted by default.
- A cross-origin `src` needs either `sandbox` or an explicit `trusted` attribute.
  Without either, the element refuses to load it and explains why in the console.
- Sandboxed embeds run the runtime from a separate domain, such as a user-content
  domain. If the patch needs `SharedArrayBuffer`, the iframe must be cross-origin
  isolated. An iframe with the `sandbox` attribute but without `allow-same-origin`
  gets an opaque origin, which may not be isolatable. Verify this before relying on it.
- Trusted is not robust. An infinite loop or runaway shader in one trusted patch
  can stall the shared runtime. A per-patch watchdog limits user code time, and the
  frame budget drops a patch that keeps running over.

### Shared Memory

WebGPU never needs `SharedArrayBuffer`. GPU data stays on the GPU, and the main
thread and render worker can communicate with `postMessage` and transferable
objects such as OffscreenCanvas and ImageBitmap.

`SharedArrayBuffer` requires the host page to be cross-origin isolated with COOP
and COEP headers. COEP blocks cross-origin content that does not opt in, so it can
break a host site's video embeds, ads, analytics, or cross-origin images. Many
sites cannot enable it to embed Patchies.

| Use                                       | Needs `SharedArrayBuffer` | Without it                                           |
| ----------------------------------------- | ------------------------- | ---------------------------------------------------- |
| Rendering on the GPU                      | no                        | n/a                                                  |
| Canvases and frames to the worker         | no                        | transfer with `postMessage`                          |
| Camera shared with the worker (editor)    | optional                  | `postMessage`, with up to one frame of lag           |
| Audio worklet ring buffers, buffer bridge | for the fast path         | `postMessage`, as SuperSonic and Csound do today     |
| WASM threads (pthreads builds)            | yes                       | single-threaded builds, or the object is unavailable |

Patchies already detects `SharedArrayBuffer` with `canUseSharedArrayBuffer()` in
`ui/src/lib/audio/buffer-bridge/feature-detect.ts`. SuperSonic switches between
`sab` and `postMessage` modes, and Csound passes `useSAB`.

- Use shared memory when `crossOriginIsolated` is true, and fall back otherwise.
- Objects that need it declare a `shared-memory` capability
  ([199](199-portable-patchies-runtime.md)), so an embed on a non-isolated page
  reports which objects cannot run.
- A video-only `<patchies-output>` needs no `SharedArrayBuffer`, so its sandbox
  iframe needs no cross-origin isolation either.

## Licensing

The goal: `@patchies/core` and the primitives are MIT-licensed. Each plugin
package, such as `q5` or `strudel`, carries its own license, including AGPL,
LGPL, or anything else its dependencies require.

This is not legal advice. Review the final bundle and distribution model with
someone qualified before changing project licensing.

### Boundary Rules

1. **Dependencies point one way.** Plugins import core. Core and the primitives
   never import plugin code, not even types.
2. **Plugins load as separate bundles.** Plugin code ships as its own chunk,
   loaded at runtime through the plugin contract in spec 167. It is never
   compiled into the core bundle.
3. **Licenses are visible at every level.**
   - Plugin manifests declare their license. Spec 167's manifest already has a
     `license` field.
   - Patches declare the plugins they use, so a patch's licenses are knowable.
   - The editor shows licenses in the object browser and on export.
4. **CI enforces it.** A license check runs over each package's dependency tree,
   so a copyleft dependency cannot slip into core or a primitive unnoticed.
5. **Two builds follow naturally.**
   - patchies.app loads the full plugin set, including AGPL plugins.
   - An MIT-only embed loads core, the primitives, and permissive plugins. An
     embedding site chooses its plugins and knows what it takes on.
6. **Each primitive has a dependency allowlist.** CI fails when a primitive's
   `package.json` gains a dependency that is not on its list. This keeps the
   goal of importing almost nothing from eroding. The license check in rule 4
   covers licenses. The allowlist covers the dependency count.
7. **Core never names a plugin.** When core needs to know a plugin's name, the
   plugin should register itself instead.

### How Each License Behaves

- **LGPL**: users must be able to replace the library with their own version.
  Shipping it as a separate module fits. Minifying it into one combined bundle
  is murkier.
- **AGPL**: anyone serving a site that uses it must offer users the source. That
  is easy for open-source patchies.app. The burden falls on embedders who load
  an AGPL plugin. Whether runtime-loaded bundles keep the rest of a page out of
  the AGPL work is legally unsettled, so AGPL plugins stay clearly opt-in.
- **GPL**: like AGPL without the network clause. Distributing it still requires
  offering the source.
- **MPL-2.0**: copyleft per file. Unmodified MPL files can ship next to MIT code.
  Changes to MPL files must be shared.

### Relicensing

Patchies is AGPL-3.0 today. Moving core code to MIT needs permission from every
copyright holder of that code. The main branch history has 6 contributors.
Code without permission must be rewritten or stay in an AGPL plugin.

### Dependency Audit (2026-11-27)

Audit of `ui/package.json` direct dependencies (99 runtime, 54 dev) and all
1,365 installed packages. Dev dependencies are all MIT, ISC, or Apache-2.0.

| Dependency                                         | License                               | Comes from                                      | Used by                                                                         | Plugin      |
| -------------------------------------------------- | ------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------- | ----------- |
| `@strudel/*` (12 packages)                         | AGPL-3.0-or-later                     | direct                                          | `strudel` via `StrudelEditor.svelte`, already split into a `strudel` Vite chunk | `strudel`   |
| `superdough`, `supradough`                         | AGPL-3.0-or-later                     | `@strudel/codemirror`, `@strudel/webaudio`      | `strudel`                                                                       | `strudel`   |
| `hydra-synth`                                      | AGPL                                  | `@strudel/hydra`                                | Strudel's Hydra integration                                                     | `strudel`   |
| Hydra fork in `ui/src/lib/hydra/`                  | AGPL-3.0                              | vendored                                        | `hydra`, used by the render worker, CodeMirror completions, default node data   | `hydra`     |
| `textmode.synth.js`                                | AGPL-3.0                              | direct                                          | `textmode` objects and the render worker                                        | `textmode`  |
| SuperSonic in `ui/static/supersonic-scsynth-core/` | GPL-3.0-or-later                      | vendored static assets                          | `sonic~` and SuperSonic features: sample search, synthdef drag and drop         | `sonic`     |
| `p5`                                               | LGPL-2.1                              | direct                                          | `p5` via `ui/src/lib/p5/`                                                       | `p5`        |
| `@csound/wasm-bin`                                 | LGPL-2.1                              | `@csound/browser`                               | `csound~`                                                                       | `csound`    |
| `melange`, `melange.js`                            | LGPL-2.1-or-later                     | `libpd-wasm` (BSD-3-Clause)                     | nothing in `ui/src` imports `libpd-wasm` yet                                    | `pd`        |
| `mediabunny`                                       | MPL-2.0                               | direct                                          | video playback (`ui/src/lib/video/`)                                            | none needed |
| `pyodide`                                          | MPL-2.0                               | direct                                          | `python`, `peppermint`                                                          | none needed |
| `dompurify`                                        | MPL-2.0 or Apache-2.0                 | direct                                          | markdown sanitizing                                                             | none needed |
| `jszip`                                            | MIT or GPL-3.0-or-later               | transitive                                      | choose MIT                                                                      | none needed |
| `lygia`                                            | Prosperity License and Patron License | direct, and fetched from `lygia.xyz` at runtime | `#include <lygia/...>` in GLSL, presets that include it                         | see below   |

Not restrictive:

- `@img/sharp-libvips-*` is LGPL-3.0-or-later, but `sharp` runs only at build time.
- `machine` is Patchies' own VASM package in `ui/src/assets/vasm`, with no
  license field. It needs one.
- `runed` and `svelte-toolbelt` have no `license` field in `package.json`, but
  ship a LICENSE file. Confirm their license.

### lygia

lygia uses the Prosperity License, which allows non-commercial use, plus a Patron
License for sponsors. Patchies resolves `#include <lygia/...>` from the
`lygia.xyz` CDN at runtime, so user shaders fetch lygia directly. Two follow-ups:

- Presets that Patchies ships with lygia includes carry lygia's license terms.
- Commercial users need to know lygia's terms. The editor could show the
  license when a shader includes lygia.

### What the Audit Means

- Most restrictive code is already contained in a few objects: Strudel, Hydra,
  textmode, SuperSonic, p5, Csound, and libpd. Each maps to one plugin package.
- Hydra is the largest boundary problem. The vendored AGPL fork is used by the
  render worker and the editor, not only by the `hydra` object. Core render code
  must stop importing it.
- Strudel's code is already loaded as a separate Vite chunk, which is a start on
  rule 2.

### Decoupling Hydra

The Hydra fork is imported in three places outside the `hydra` object. Each one
moves behind plugin registration:

| Where Hydra is imported today | What replaces it                                                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| The render worker             | The `hydra` plugin calls `renderer.registerNodeType('hydra', definition)`. The worker already has `NodeRendererRegistry.ts`, which is the seam. |
| CodeMirror completions        | The plugin supplies its own language support. The editor loads it when a `hydra` node opens.                                                    |
| Default node data             | Comes from the plugin's manifest, so core never hard-codes Hydra's defaults.                                                                    |

The same pattern applies to every row in the audit: textmode, SuperSonic, p5,
Csound, and libpd each register through their plugin.

## Risks

- **Public APIs are a promise.** Once other sites embed a primitive, breaking
  changes cost other people. Build the patchies.app editor on the primitives
  first, and publish them after the editor proves the API.
- **Two thread modes** in both the renderer and the canvas double the test matrix.
- **Package boundaries cost effort.** Shared types, versioning, and release tooling
  for several packages are ongoing work.

## Open Questions

- Does `@patchies/canvas` own edges and cables, or does the editor draw them as
  node types?
- How do renderer node types and canvas node types share a definition for one
  object, such as a `glsl` object's preview and box?
- Which thread runs user JavaScript for message objects in an embed with no editor?
- Answered: `@patchies/shader` ships `glsl-to-wgsl` alone, with no WASM fallback
  ([198](198-webgpu-render-core.md)).

## Related Specs

- [203. Patchies V2 Roadmap](203-patchies-v2-roadmap.md): the index for the
  Patchies V2 vision.
- [197. Canvas Editor and DOM Islands](197-canvas-editor-and-dom-islands.md):
  the painters behind `@patchies/canvas`.
- [198. WebGPU Render Core](198-webgpu-render-core.md): the render core behind
  `@patchies/renderer`.
- [199. Portable Patchies Runtime](199-portable-patchies-runtime.md): running
  the core outside the browser.
- [201. Rust Native Host](201-rust-native-host.md): a native host that runs the
  primitives with no browser.
- [202. patchies_core](202-patchies-core.md): an embeddable Rust crate that lets
  other apps embed Patchies.

## Suggested Order

1. Build `@patchies/shader` as a standalone library. This is in progress.
2. Extract `@patchies/renderer` from the WebGPU render core work in spec 198.
3. Extract `@patchies/canvas` from the canvas editor work in spec 197.
4. Move the patchies.app editor onto the primitives.
5. Publish the primitives once the editor has used them for a while.
