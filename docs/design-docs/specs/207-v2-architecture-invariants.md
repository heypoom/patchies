# 207. V2 Architecture Invariants

Status: Exploration. These are design rules for Patchies V2, written before any of
the systems they protect exist. They decide the shape of data and APIs from day
one. They do not require implementing every system on day one.

## Live-Performance-Stable

The main goal of every V2 iteration is to be stable enough for a live performance,
from the very first version. A performer in front of a crowd must not be afraid of
crashes. V2 moves slowly to get there, on purpose:

- **Primitives first.** Build and prove the core systems before adding objects.
- **Few objects at a time.** Start with 4 or 5 objects and add more only once
  they are proven stable.
- **Never vibe-code the core.** Core systems, core primitives, and core objects are
  built slowly, with tests, care, and review by hand. Don't rush systems
  or objects into V2.
- **Shell objects are experimental.** Vibe-coded objects build on the stable
  primitives, are marked experimental, and are not recommended for live
  performance.

Consequences for the design:

- An object definition declares its stability, `stable` or `experimental`, and the
  editor shows it. A patch can tell the performer when it uses experimental
  objects.
- A failing experimental object must not take down the patch. Its errors, hangs,
  and resource use are contained to its instance (invariants 10 and 12), so one bad
  shell object cannot stop the stable parts of a performance.
- An object moves from shell to core only by meeting the core bar in spec 208.

## Core and Shell

Patchies V1 grew by adding objects. [patchies.app/docs](https://patchies.app/docs)
lists about 200 of them. That was useful: V1 shows which objects people need.

Patchies V2 grows by building primitives:

- **Core:** Patchies provides a small set of coherent primitive systems, libraries,
  and objects. Core must be production-ready, and is never vibe-coded.
- **Shell:** coding agents vibe-code on top of them: new objects, GLSL, WGSL, and
  q5.js code, unusual interfaces such as Septabee-style instruments, and whole
  patches. Shell objects are experimental until they meet the core bar. Shader and
  q5.js code that people write inside core objects, such as `glsl` and `wgsl`, is
  user content, not shell: the object running it must stay stable whatever the code
  does.

The primitive systems:

- one canvas editor ([197](197-canvas-editor-and-dom-islands.md));
- the WebGPU render core ([198](198-webgpu-render-core.md));
- embeddable primitives ([200](200-patchies-v2-primitives.md));
- the native host ([201](201-rust-native-host.md), [202](202-patchies-core.md));
- multiplayer and CRDTs ([204](204-multiplayer.md));
- agent integration ([205](205-agent-integration.md));
- presentation views ([206](206-presentation-views.md));
- subpatches and abstractions ([27](27-decouple-xyflow-with-graph.md),
  [167](167-modular-patchies-roadmap.md)).

They must stay coherent when they interact:

- multiplayer must not break inside subpatches;
- subpatches must not break in the native host;
- agent integration must not break inside subpatches;
- embeddable primitives must not break multiplayer;
- subpatches must not break presentation views.

These systems collide in the data model, not in features, so the invariants below
are settled before the systems are built.

## Day-One Object Set

The first version ships 4 or 5 core objects, such as `button`, `slider`, `glsl`, and
`wgsl`, and adds the rest of the set below one at a time, each only once it is proven
stable (Live-Performance-Stable above). The full day-one set:

- `button` and `slider`;
- `js`;
- `glsl` and `wgsl`;
- `q5`;
- one audio oscillator;
- `p`, which creates a subpatch;
- `in` and `out`, typed ports for subpatches ([27](27-decouple-xyflow-with-graph.md));
- `s` and `r`, patch-aware send and receive (invariant 3).

With the primitive systems, this set already covers a lot: many more buttons and
sliders than V1 can hold, complex WGSL effects, embeds, fast native rendering,
multiplayer, agents writing q5.js and shader code, dashboards that are not pannable
canvases, and reusable abstractions.

V1's other objects come back later as plugins, ported or vibe-coded against the same
primitives. Interesting candidates include `anupars`, `orca`, `uxn`, and `asm`.

## Invariants

### 1. No Singletons

Every service belongs to a runtime instance and is passed in explicitly. Several
runtimes can live in one page or process: five embeds on one page, several subpatch
instances, or a test harness.

- A lint rule bans module-level mutable state, `getInstance()`, and `static instance`.
- The V2 prototype already turned `MessageSystem` and `MessageChannelRegistry`
  singletons into constructor injection ([203](203-patchies-v2-roadmap.md)).
- How services are wired and scoped is in [Wiring and Scopes](#wiring-and-scopes).

### 2. Short, Stable, Unique IDs

- IDs are random, never counters. Counters collide in multiplayer, such as two
  peers creating `glsl-3` at once.
- IDs are short and typo-resistant for agents: a type prefix plus about 8
  characters of Crockford base32, such as `osc-k3f9x2ma`. Crockford base32 has no
  ambiguous characters, such as `0` and `O`, or `1` and `l`.
- About 40 bits of randomness is enough because IDs only need to be unique within
  their patch document. Global addresses come from paths (invariant 3).
- Every command validates IDs and answers a mistyped or hallucinated ID with a
  suggestion, such as "did you mean `osc-k3f9x2ma`?", instead of acting on it. An
  optional check character can catch typos outright.

### 3. Path Addressing

Nothing assumes a single patch. Everything is addressed by a path:

```
<document> / <subpatch path> / <node id> : <port>
patch-7q2m / mixer / osc-k3f9x2ma : out0
```

- Commands, messages, CLI operations, and MCP calls all name their target patch.
  Pull request 272 binds a remote control session to one patch, which must extend
  to the patch tree ([205](205-agent-integration.md)).
- `s` and `r` names are scoped:
  - local to their patch by default;
  - per instance inside abstractions, like Pure Data's `$0`, so two instances of one
    abstraction do not hear each other;
  - document-wide or room-wide only with an explicit prefix.

### 4. Definitions and Instances

A subpatch or abstraction is a definition, a document, that can have many
instances, each with its own runtime state.

- The shared document stores definitions. Editing a definition in multiplayer
  updates every instance.
- Runtime addresses include the instance, as `instance / node id`. The same node in
  two instances of one abstraction is two runtime objects.

### 5. Three Kinds of State

| State          | Examples                                                       | Synced                                      | Lives in             |
| -------------- | -------------------------------------------------------------- | ------------------------------------------- | -------------------- |
| Document       | nodes, edges, code, presentation layouts, subpatch definitions | yes, through the CRDT                       | the shared document  |
| Runtime        | object state, playheads, GPU resources, audio nodes            | no: each peer and each instance has its own | the runtime instance |
| Per-actor view | camera, selection, the view an actor is looking at             | presence only                               | each actor           |

Presentation layouts are document data, so everyone shares them. The view an actor
is looking at is per-actor state.

### 6. Commands From Actors

- Commands are the only way to change the document. The editor, the CLI, MCP,
  remote peers, and undo all use them. The runtime follows the document through
  `setGraph()` ([40](40-headless-patcher-system.md)).
- Every command carries an actor: a human, an agent, a host, or a remote peer.
- Agents are players. They use the same command protocol (spec 205), have the same
  presence and cursors (spec 204), and appear in the interface like humans, the way
  Claude artifacts show Claude alongside people.
- Undo history and permissions are per actor.

### 7. Capabilities Everywhere

Objects declare what they need. Hosts declare what they provide. Anything unmet
loads as a placeholder that keeps its data and connections intact
([201](201-rust-native-host.md)). The same rule covers:

- a native host loading an abstraction that contains a `dom` node;
- a mixed browser and native multiplayer room;
- an embed on a page without `SharedArrayBuffer`.

### 8. A Clock Tree

Clocks form a tree that follows the runtime tree. Each runtime instance owns its
clock tree, so there is no global transport singleton (invariant 1).

- The root clock is the patch's transport. Embeds on one page share a page clock,
  and multiplayer shares a room timeline (spec 204).
- Each subpatch or abstraction instance has a clock in one of three modes:

| Mode              | Behavior                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Inherit (default) | uses its parent's clock                                                                  |
| Derived           | follows its parent's play and pause, with its own offset, rate, and a loop or hold range |
| Independent       | its own transport: play, stop, and BPM, unaffected by its parents                        |

- Objects read local and absolute time. `clock.time` and `clock.beat` are local to
  the object's patch, and an absolute time such as `clock.absTime` is the root's.
  GLSL's `iTime` follows the local clock.
- Look-ahead audio scheduling maps local time to root time to audio-context time,
  so beat callbacks stay sample-accurate. A rate other than 1 changes when things are
  scheduled, not how audio is rendered.
- Clock settings, such as mode, offset, rate, and range, are document data and sync
  in multiplayer. Each clock's running position is runtime state, per instance.
- Randomness is seeded from the local clock wherever peers need matching output, so
  a looping section repeats the same random values.
- The transport panel shows the clock of the patch you are in, with a breadcrumb up
  to the root. This is how multiple clocks reach the transport docs
  (`ui/static/content/topics/transport-control.md`).

Precedent: TouchDesigner's Time COMP gives each component its own timeline, with
play, rate, start and end, a range that loops or holds, signature, and tempo, and a
"Run Independently" option. Objects there read both component time and absolute
time. Max has named transports, and Ableton's clips loop their own length against
one global transport.

### 9. Host Services, Never Globals

Core and primitive packages compile without DOM types, so they cannot reach
`window`, `document`, `console`, or `performance`. Timers, frames, the clock, input,
logging, audio, and storage come from the host ([202](202-patchies-core.md)). The V2
prototype proved this works.

### 10. Resources Belong to Their Instance

The GPU device is shared per host, but textures, pipelines, and audio nodes belong
to the runtime instance that created them and are freed when it is destroyed.
Destroying one embed or one subpatch instance must never leak or break another.

### 11. A Versioned, Lossless Document

- The document has a schema version and migrations.
- Unknown objects and fields are kept on save.

This is what mixed versions in multiplayer, placeholders across hosts, and agents
writing patches all need.

### 12. One Trust Rule

Code in a document runs with its host's privileges. Embeds, multiplayer rooms,
agents, and subpatches loaded from URLs all follow the same rule: loading means
trusting ([200](200-patchies-v2-primitives.md), [204](204-multiplayer.md)).

### 13. Black-Box Testable on Both Hosts

Everything is testable from the outside on the browser host and the native host,
through the same operations protocol, commands, and queryable scene that agents and
people use. Every object ships conformance tests. Time and randomness are
controllable, and rendering can happen offscreen and be read back. The testing
strategy is [208. V2 Testing Strategy](208-v2-testing-strategy.md).

### 14. Generic Cores, Patchies Adapters

Each system has a generic core that is reusable outside Patchies, and a thin
Patchies adapter that hooks it into the patch model. Zed and GPUI are the model:
GPUI is a general UI framework, and Zed is one app built on it.

Generic cores may use generic graph and canvas vocabulary. An infinite canvas has
nodes, as tldraw, Excalidraw, and Figma do, and a render graph has nodes and edges.
What a generic core must not know is the Patchies model: object types, the object
registry, port kinds such as message, audio, and video, message routing, and the
patch document schema.

| System              | Generic core                                                                                               | Patchies adapter                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Canvas and painters | display list, controller, Canvas 2D and WebGPU painters, DOM islands, hit-testing, camera, canvas nodes    | turns objects into canvas nodes, cables into curves, ports into hit regions |
| Render core         | a WebGPU render graph of nodes and edges, plus the shader library                                          | turns video objects into render nodes                                       |
| Native host         | a JavaScript runtime with WebGPU windows, audio, input, and host services                                  | loads `@patchies/core` and the patch                                        |
| Multiplayer         | CRDT document sync, presence, rooms, relay transport, and the clock timeline, over any document            | the patch document's schema                                                 |
| Agent integration   | an operations protocol, a filesystem mount of a document tree, the CLI, and an MCP bridge                  | the Patchies command set and the object capability catalog                  |
| Testing             | deterministic clocks, offscreen snapshots with tolerances, offline audio comparison, semantic tree queries | patch builders, the object conformance runner, golden message traces        |
| Presentation views  | anchored screen-space layouts of canvas nodes                                                              | placing widget objects into named views                                     |

`@patchies/core`, with the patch graph, objects, and message routing, is the
patch-aware layer between the Patchies model and the generic systems. Routing is an
interface there, with wires as one router among several, and the message envelope
has room for optional metadata, so later worlds such as proximity or Redstone-style
grids do not have to fake wires
([209](209-routing-beyond-wires.md#what-v2-needs-now)).

- Keep adapters thin. Logic in an adapter that is not about mapping belongs in the
  generic core or in `@patchies/core`.
- Make the boundary generic from day one, so no Patchies types cross it, but add
  generality only when Patchies or a real second user needs it. This guards against
  over-abstraction.
- Name the layers so the boundary is visible, with adapters clearly labeled as
  Patchies-specific.

Precedent: Zed and GPUI, tldraw's editor and its shapes, ProseMirror's generic
model, state, and view with app-specific schemas, and Yjs as a generic CRDT that apps
give a schema.

## Wiring and Scopes

Invariants 1, 7, 9, and 10 need one wiring style. V2 uses dependency injection by
hand, with no container or framework.

### Why Not a Container

- Containers such as InversifyJS or tsyringe move missing bindings from compile
  errors to runtime errors. Wiring by hand is type-checked.
- They hide the dependency graph, which `getInstance()` already hides in V1.
- Their decorators and `reflect-metadata` do not fit an embeddable core, nor a
  Rust `patchies_core` ([202](202-patchies-core.md)), where wiring by hand is the
  normal style.
- Precedent: VS Code's instantiation service works at its scale, at the cost of
  ceremony. Zed and GPUI pass an explicit context (`cx`) and scope global state to
  the `App`, not the process, which is closer to what Patchies needs.

### Rules

1. **Constructor injection of narrow interfaces**, such as `Clock`, `Timers`,
   `FileSystem`, `Fetch`, `Rng`, and `Logger`. A class asks for exactly what it
   uses. More than four or five dependencies means the class does too much.
2. **One composition root per host.** `createRuntime(hostServices)`, about 100 to
   150 lines, builds everything ([203](203-patchies-v2-roadmap.md)). Tests call the
   same function with test services, so both hosts and tests share one wiring path.
3. **Scopes that follow the document:**

   | Scope    | One per                                | Owns                                        |
   | -------- | -------------------------------------- | ------------------------------------------- |
   | Host     | process, or page                       | the GPU device, the audio context           |
   | Runtime  | patch, so several per page for embeds  | message routing, the clock tree, scheduling |
   | Subpatch | subpatch instance, child of its parent | its scoped names and its clock              |
   | Instance | object                                 | its textures, audio nodes, and timers       |

   A scope owns what it creates and disposes of it when it closes, so invariant 10
   is the mechanism rather than a rule to remember.

4. **Capabilities are injection for objects.** An object definition never imports
   a service. It receives a `ctx` with only the capabilities it declared, such as
   audio, video, the filesystem, or timers. One mechanism covers dependencies,
   trust (invariant 12), the two kinds of `js`, and placeholders when a host lacks
   a capability (invariant 7). Tests hand objects a fake `ctx`.
5. **Fakes over mocks.** A shared test host provides a stepped clock, an in-memory
   filesystem, a recording message sink, and a seeded random number generator,
   used by both hosts' test suites ([208](208-v2-testing-strategy.md)).
6. **Svelte context only in the shell.** The editor adapter's root puts the runtime
   into Svelte context. Core never sees it.

## Collisions and the Invariants That Resolve Them

| Collision                           | Resolved by                                                                                        |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| Multiplayer inside subpatches       | 4: definitions sync, instances stay local. 3: paths address the patch.                             |
| Subpatches in the native host       | 7: placeholders inside abstractions. 9: host services.                                             |
| Agent integration inside subpatches | 3: every command names its patch. 6: agents are actors.                                            |
| Embeds alongside multiplayer        | 1: no singletons. 3: scoped names. 8: a page clock, a room timeline, and a clock tree under them.  |
| Subpatches in presentation views    | 4 and 5: an instance's controls can appear in a view, with graph-on-parent as model 2 in spec 206. |
| UUIDs too long for agents           | 2: short Crockford IDs, unique per patch, validated with suggestions.                              |
| `s` and `r` with five patches alive | 3: scoped by default, with explicit prefixes.                                                      |

## Enforcement

- Lint rules: no module-level mutable state, no `getInstance()` or
  `static instance` (invariant 1).
- No reading `window` or `globalThis` outside host adapters (invariant 9, Wiring and
  Scopes).
- Core and primitive packages compile without DOM types (invariant 9).
- dependency-cruiser rules for cycles and wrong-direction imports (spec 203).
- Tests that run two runtimes side by side in one process, such as two embeds or two
  abstraction instances, and check they do not interfere (invariants 1, 3, 4, 10).
- Tests that run every primitive on two hosts in CI (spec 203).
- Object conformance tests, snapshots, and end-to-end tests on both hosts as part of
  the definition of done (invariant 13, spec 208).
- dependency-cruiser rules that stop generic cores from importing Patchies types,
  such as object types, the object registry, or the patch document, and from
  importing `@patchies/core` (invariant 14).

## Related Specs

- [27. Decouple XYFlow With Graph](27-decouple-xyflow-with-graph.md) and
  [167. Modular Patchies Roadmap](167-modular-patchies-roadmap.md): subpatches and abstractions.
- [40. Headless Patcher System](40-headless-patcher-system.md).
- [197](197-canvas-editor-and-dom-islands.md) through
  [206](206-presentation-views.md): the primitive systems.
- [203. Patchies V2 Roadmap](203-patchies-v2-roadmap.md).
- [209. Routing Beyond Wires](209-routing-beyond-wires.md): routing as an interface
  and optional message metadata.
