# 203. Patchies V2 Roadmap

Status: Exploration. This is the index for the Patchies V2 vision. Details live
in the linked specs.

## Vision

Patchies V2 is a set of small, embeddable pieces that the patchies.app editor
composes:

- an editor drawn on one canvas, with DOM only where it is needed, scaling to
  very large patches: Canvas 2D for small patches without video, WebGPU for video
  and very large patches, and WebGPU always on the native host;
- a WebGPU render core in place of WebGL2, with GLSL and WGSL as peers, q5.js,
  and particles;
- primitive libraries that other websites can embed on their own;
- subpatches and abstractions as nested runtimes, now that no XYFlow graph stands
  in the way;
- a native host with no browser, built on an embeddable `patchies_core`, so other
  apps and custom instruments can embed Patchies.

The browser stays the home platform. Every host runs the same TypeScript core and
always needs a JavaScript runtime.

**Start with [207. V2 Architecture Invariants](207-v2-architecture-invariants.md).**
V2 grows by primitives, not objects: a small core of coherent systems, with coding
agents vibe-coding on top. Spec 207 sets the day-one object set and the rules that
keep the systems from colliding: no singletons, short random IDs, path addressing,
definitions and instances, three kinds of state, commands from actors,
capabilities, one clock per runtime tree, host services, owned resources, a
lossless document, one trust rule, and black-box testability on both hosts
([208](208-v2-testing-strategy.md)).

## North Stars

Low resource use, embeddable on websites, very large patches, usable without a
browser, DOM as islands, minimal and modular by default, video and audio, and
WebGPU particles and geometry. Where they conflict, and what gives first, is in
[200. Patchies V2 Primitives](200-patchies-v2-primitives.md#north-stars).

## Specs

| Spec                                                                       | Covers                                                                                                                                     |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| [207. V2 Architecture Invariants](207-v2-architecture-invariants.md)       | Read first: core and shell, the day-one object set, and thirteen invariants that keep the systems coherent                                 |
| [197. Canvas Editor and DOM Islands](197-canvas-editor-and-dom-islands.md) | One WebGPU canvas, DOM islands, update rate, Canvas 2D and WebGPU painters, lines, today's XYFlow fixes                                    |
| [198. WebGPU Render Core](198-webgpu-render-core.md)                       | Render graph on WebGPU, threads and frame budgets, GLSL to WGSL translation, q5.js, POPs, WebGL2 islands                                   |
| [199. Portable Patchies Runtime](199-portable-patchies-runtime.md)         | Running patches outside the browser: host adapters, capability tags, native WebGPU engines, native audio                                   |
| [200. Patchies V2 Primitives](200-patchies-v2-primitives.md)               | `@patchies/renderer`, `@patchies/canvas`, `@patchies/shader`, north stars, embedding, licensing                                            |
| [201. Rust Native Host](201-rust-native-host.md)                           | The native host: engine choice, Node or Rust host, audio, shared Patchies API, object support, native editor                               |
| [202. patchies_core](202-patchies-core.md)                                 | The embeddable Rust crate the native host is built on, libpd-style                                                                         |
| [204. Multiplayer](204-multiplayer.md)                                     | Shared patch documents with a CRDT, collaborative code, presence, Link-style clock, and join equals trust                                  |
| [205. Agent Integration](205-agent-integration.md)                         | Coding agents driving Patchies: one operations protocol with mount, CLI, and MCP front-ends, building on PR 272                            |
| [206. Presentation Views](206-presentation-views.md)                       | Interfaces beyond the infinite canvas: presentation views, graph-on-parent, and windows, not yet chosen                                    |
| [208. V2 Testing Strategy](208-v2-testing-strategy.md)                     | Black-box tests from day one on both hosts: object conformance, golden traces, audio and visual snapshots, end-to-end, performance budgets |

## Earlier Specs This Builds On

| Spec                                                                                                                             | How it fits                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [27. Decouple XYFlow With Graph](27-decouple-xyflow-with-graph.md)                                                               | Decoupling the graph from XYFlow, and the `p` subpatch object with local and URL sources and typed `in` and `out` ports. V2 needs this decoupling: there is no XYFlow, and the core must be cross-platform. |
| [40. Headless Patcher System](40-headless-patcher-system.md)                                                                     | The headless runtime every V2 piece depends on                                                                                                                                                              |
| [47. Modular Patchies API Design](47-modular-patchies-api-design.md)                                                             | Early modular API design                                                                                                                                                                                    |
| [167. Modular Patchies Roadmap](167-modular-patchies-roadmap.md)                                                                 | Package split, plugin contract, MIT core goal, and its phases 3 and 6: subpatches and abstractions as nested `PatchRuntime` instances                                                                       |
| [168. Runtime Object and Editor Representations](168-runtime-object-editor-representations.md)                                   | Objects separate from how the editor draws them                                                                                                                                                             |
| [169. Build Your Own Patcher Vision](169-build-your-own-patcher-vision.md)                                                       | Custom patchers and host apps                                                                                                                                                                               |
| [170. Agent-Extensible Patchies Vision](170-agent-extensible-patchies-vision.md)                                                 | Agents building objects and hosts                                                                                                                                                                           |
| [100. Schema-Driven Handles](100-schema-driven-handles.md)                                                                       | Declarative object ports, toward declarative drawing                                                                                                                                                        |
| [134. Viewport Pause Culling](134-viewport-pause-culling-for-main-thread-nodes.md)                                               | Current culling, which DOM islands extend                                                                                                                                                                   |
| [119. Visual Pipeline Roadmap](119-visual-pipeline-roadmap.md)                                                                   | The code-oriented TouchDesigner goal the render core continues                                                                                                                                              |
| [57. WebGPU Compute Node](57-webgpu-compute-node.md), [116. WebGPU Render Bridge](116-webgpu-render-bridge.md)                   | WebGPU work that one shared device replaces bridging for                                                                                                                                                    |
| [113. Graph-Level Feedback](113-graph-level-feedback.md), [115. Geometry Wire Type](115-geometry-wire-type.md)                   | Feedback and geometry that carry over to WebGPU                                                                                                                                                             |
| [117. Shared Resource Pool](117-shared-resource-pool.md)                                                                         | Shared resources, reused across embeds on one page                                                                                                                                                          |
| [105. Base Worker Renderer](105-base-worker-renderer.md), [184. Render Worker Orchestration](184-render-worker-orchestration.md) | The render worker that owns the GPU device in V2                                                                                                                                                            |
| [52. Virtual Filesystem](52-virtual-filesystem.md), [121. VFS JS Modules](121-vfs-js-modules.md)                                 | Code as files, shared by both hosts                                                                                                                                                                         |
| [70. Native DSP Worklets](70-native-dsp-worklets.md)                                                                             | Audio worklets that need porting to the native host                                                                                                                                                         |
| [35. netsend and netrecv](35-netsend-netrecv.md), [87. Networked Transport Sync](87-networked-transport-sync.md)                 | Peer-to-peer messaging and clock sync that multiplayer builds on                                                                                                                                            |

## Implementation Strategy

### Branches

- `main` is completely frozen until V2 is finished. It gets no fixes, critical or
  otherwise.
- V2 is built on a `patchies-v2` branch, on top of the current codebase. Some
  modules are refactored and reused, some are rewritten, and some are deleted.

### Clean Skeleton, Harvested Modules

V2 starts from a clean package layout with strict boundaries, then moves existing
modules into it one at a time, once each is untangled to meet the boundary rules.
New code never imports from the old tree.

- Purely incremental work would keep today's XYFlow editor alive at every step,
  including `FlowCanvasInner.svelte` (1,934 lines, 79 imports), which V2 replaces.
- A purely clean-room rewrite would discard tested logic: message routing, the
  transport and scheduler, the JavaScript runner, object behaviors, and their tests.

```
packages/core        @patchies/core: runtime, messages, scheduling, host-services interface
packages/renderer    @patchies/renderer
packages/canvas      @patchies/canvas
packages/shader      @patchies/shader
hosts/browser        the browser host: adapters and the editor app
hosts/native         patchies_core (Rust) and the standalone native app
ui/                  today's app, a read-only reference until V2 reaches parity
```

### Boundaries Enforced From the First Commit

Circular and cross-module dependencies are expected to bite, so boundaries are
checked mechanically rather than by review:

- Core and primitive packages compile without DOM types: their `tsconfig` `lib`
  has no `"dom"`, so any use of `window`, `document`, or `HTMLElement` fails to
  typecheck.
- A dependency checker, such as dependency-cruiser or ESLint boundary rules, runs
  in CI:
  - no circular imports;
  - `core` imports no Svelte, XYFlow, or host code;
  - primitives import no other Patchies package;
  - each package has the dependency allowlist from spec 200.
- TypeScript project references build each package on its own, so an import in
  the wrong direction fails the build.

### Harvesting Modules

Modules are moved and untangled, never imported from `ui/`. Each move brings its
tests, and the old copy stays untouched in `ui/`.

- `MessageSystem.ts` is close. Its only problematic import is the type-only
  `Edge` from `@xyflow/svelte`, which becomes core's own `Connection` type.
- `JSRunner` moves once its injected services sit behind the host-services
  interface from spec 201.
- The transport, scheduler, and `JSModuleResolver`, which is already pure, move early.

For logic that must behave the same, such as message routing and scheduling, use
the scientist pattern: run the old and new implementations on recorded inputs and
compare. Golden message traces recorded from `ui/` become V2's regression tests.

### Milestone 0

One button that works on both the browser host and the native host, built from
harvested `MessageSystem` code. Then benchmark 1,000,000 buttons on both hosts.

Done in the V2 prototype (`spikes/v2-prototype/` on branch
`claude/native-host-spike-c0d660`): one playable patch from identical TypeScript in
Chrome and in a Node host with a patched `dawn.node`. 1,000,000 buttons as real
patch nodes held 118–120 fps zoomed out in both hosts. At 120 Hz the native host
used 15–16% of a core against 33–39% for Chrome (spec 201).

What the prototype showed about the strategy:

- Harvesting `MessageSystem` took six seams, each turned into a constructor
  argument: the XYFlow `Edge` type became `Connection`, `SendMessageOptions` was
  copied out of `MessageContext`, the profiler and logger singletons were injected,
  global timers became host timers, and `getInstance()` singletons became
  constructor injection. The harvested tests pass.
- Compiling core and canvas without DOM types, and dependency-cruiser rules for
  cycles and wrong-direction imports, worked. Test files confirmed each rule fires.
  The checks can go into the real `patchies-v2` skeleton as they are.
- The second host caught a real bug: two render passes shared one uniform buffer
  and cropped the preview. Run every primitive on two hosts in CI.
- The entry point stayed small: `createApp()` is an 85-line composition root, with
  features as separate modules.

### No New FlowCanvasInner

- The entry point is a composition root only. It creates services and connects
  them, with no feature logic, in about 100–150 lines, enforced with ESLint's
  `max-lines` on entry files.
- Each editor feature is its own registered module: selection, clipboard, history,
  autosave, shortcuts, the object browser, and so on. Each subscribes to editor
  state and events and has its own tests. Adding a feature adds a module, never
  lines in the entry point.
- Editor features sit on top of the canvas controller's split of input,
  hit-testing, state, and camera (spec 197), not inside it.
- Features change the patch through commands such as "add node" or "connect",
  which gives undo history one place to live.

## Phases

The phases overlap. Each links to where the work is described. Milestone 0 comes
first, before phase 2.

1. **Headless core.** Harvest the message system, transport, scheduler, and
   JavaScript runner into `@patchies/core`, finishing the headless runtime
   ([40](40-headless-patcher-system.md)). The near-term XYFlow fixes in
   [197](197-canvas-editor-and-dom-islands.md#near-term-fixes-for-todays-editor)
   are not applied, because `main` is frozen and V2 replaces XYFlow.
2. **Primitives.** Build `@patchies/shader`, then extract `@patchies/renderer` and
   `@patchies/canvas`, with plugins at the license boundary
   ([200](200-patchies-v2-primitives.md)).
3. **WebGPU render core.** Move the render graph to WebGPU, with GLSL translation,
   q5.js, and WebGL2 islands, then POPs ([198](198-webgpu-render-core.md)).
4. **Canvas editor.** Move the editor onto one canvas with DOM islands and
   painters chosen per patch ([197](197-canvas-editor-and-dom-islands.md)).
5. **Embedding.** Ship `<patchies-output>` and a shared runtime per page
   ([200](200-patchies-v2-primitives.md#embedding)).
6. **`patchies_core` and the native host.** Turn the native host spike into the
   crate, then build the standalone host on it, with the fullscreen code editor
   ([202](202-patchies-core.md), [201](201-rust-native-host.md)).
7. **Multiplayer.** Collision-resistant IDs, a shared patch document, presence,
   collaborative code, and a Link-style clock ([204](204-multiplayer.md)).
8. **Agent integration.** Land the remote control and mount work on `patchies-v2`,
   add a capability catalog, then an MCP front-end and headless runs on
   `patchies_core` ([205](205-agent-integration.md)).
9. **Subpatches and abstractions.** A `p` object that owns a nested `PatchRuntime`,
   loading local or URL patches, with typed `in` and `out` ports for video, audio,
   and messages ([27](27-decouple-xyflow-with-graph.md),
   [167](167-modular-patchies-roadmap.md) phases 3 and 6). It builds on the headless
   core (phase 1) and the canvas editor (phase 4), which shows one patch level at a
   time. Graph-on-parent interfaces for abstractions are model 2 in
   [206](206-presentation-views.md).
10. **Presentation views.** Choose among presentation views, graph-on-parent, and
    windows ([206](206-presentation-views.md)).

## Open Decisions

Decided so far: `main` is frozen until V2 is finished; the browser is the home
platform and every host needs a JavaScript runtime; one canvas with painters chosen
per patch; multiplayer is CRDT-based with simultaneous editing from the first
implementation, and joining a room means trusting everyone in it; the
invariants in [207](207-v2-architecture-invariants.md); and serious black-box
testing on both hosts from day one ([208](208-v2-testing-strategy.md)).

Still open, with the current lean where there is one:

| Decision                                                 | Lean                                                                                 | Spec     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------- |
| Native host: Rust embedding V8, or Node with Rust addons | Node with a patched `dawn.node`, from the V2 prototype                               | 201, 202 |
| Dawn or wgpu                                             | Dawn: matches Chrome and worked in the prototype                                     | 201      |
| JavaScript engine after October 2027                     | keep `deno_core` behind a swappable interface; revisit as Deno's future clears       | 201      |
| GLSL translator                                          | the tiny TypeScript library once it reaches parity, with WASM as a possible fallback | 198, 200 |
| CRDT library: Yjs, Automerge, or Loro                    | Yjs. A CRDT with simultaneous editing from the first implementation is decided       | 204      |
| Interface model                                          | none yet: presentation views, graph-on-parent, and windows are all proposed          | 206      |
| Where MCP lives                                          | none yet: Go server, `patchies_core`, or both                                        | 205      |
| Painter switch threshold                                 | about 10,000–20,000 visible nodes at 120 Hz, to tune                                 | 197      |

## Work in Progress Elsewhere

- A separate session on the user's devbox is building the tiny TypeScript GLSL to
  WGSL library. The GLSL spike's 42-shader corpus and harness sources were copied to
  `~/glsl-webgpu-corpus/` on the devbox as its acceptance tests.
- An interactive overview of this roadmap is published as a Claude artifact:
  [Patchies V2 Roadmap](https://claude.ai/artifact/3TQ6whjs8686cV6ds4JHpu).

## Spikes

All uncommitted in their worktrees:

| Spike                    | Branch                              | Recorded in   |
| ------------------------ | ----------------------------------- | ------------- |
| Canvas editor and WebGPU | `claude/canvas-webgpu-spike-1ebcec` | 197           |
| XYFlow stress test       | `claude/xyflow-stress-test-32545b`  | 197           |
| Today's editor at scale  | `claude/nice-volhard-303b5b`        | 197           |
| Pixel-identical painters | `claude/dual-painter-spike-59da6f`  | 197           |
| Shadertoy GLSL on WebGPU | `claude/glsl-webgpu-spike-36d5a4`   | 198           |
| Minimal Rust native host | `claude/native-host-spike-c0d660`   | 201, 202      |
| V2 prototype, both hosts | `claude/native-host-spike-c0d660`   | 201, 202, 203 |
