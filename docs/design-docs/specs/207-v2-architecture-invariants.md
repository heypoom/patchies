# 207. V2 Architecture Invariants

Status: Exploration. These are design rules for Patchies V2, written before any of
the systems they protect exist. They decide the shape of data and APIs from day
one. They do not require implementing every system on day one.

## Core and Shell

Patchies V1 grew by adding objects. [patchies.app/docs](https://patchies.app/docs)
lists about 200 of them. That was useful: V1 shows which objects people need.

Patchies V2 grows by building primitives:

- **Core:** Patchies provides a small set of coherent primitive systems and libraries.
- **Shell:** coding agents vibe-code on top of them: new objects, GLSL, WGSL, and
  q5.js code, unusual interfaces such as Septabee-style instruments, and whole patches.

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

V2 starts with very few objects:

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

### 8. One Clock per Runtime Tree

- Subpatches share their root runtime's clock.
- Embeds on one page share a page clock.
- Multiplayer shares a room timeline (spec 204).
- Randomness is seeded from the clock wherever peers need matching output.

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

## Collisions and the Invariants That Resolve Them

| Collision                           | Resolved by                                                                                        |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| Multiplayer inside subpatches       | 4: definitions sync, instances stay local. 3: paths address the patch.                             |
| Subpatches in the native host       | 7: placeholders inside abstractions. 9: host services.                                             |
| Agent integration inside subpatches | 3: every command names its patch. 6: agents are actors.                                            |
| Embeds alongside multiplayer        | 1: no singletons. 3: scoped names. 8: a page clock and a room timeline.                            |
| Subpatches in presentation views    | 4 and 5: an instance's controls can appear in a view, with graph-on-parent as model 2 in spec 206. |
| UUIDs too long for agents           | 2: short Crockford IDs, unique per patch, validated with suggestions.                              |
| `s` and `r` with five patches alive | 3: scoped by default, with explicit prefixes.                                                      |

## Enforcement

- Lint rules: no module-level mutable state, no `getInstance()` or
  `static instance` (invariant 1).
- Core and primitive packages compile without DOM types (invariant 9).
- dependency-cruiser rules for cycles and wrong-direction imports (spec 203).
- Tests that run two runtimes side by side in one process, such as two embeds or two
  abstraction instances, and check they do not interfere (invariants 1, 3, 4, 10).
- Tests that run every primitive on two hosts in CI (spec 203).
- Object conformance tests, snapshots, and end-to-end tests on both hosts as part of
  the definition of done (invariant 13, spec 208).

## Related Specs

- [27. Decouple XYFlow With Graph](27-decouple-xyflow-with-graph.md) and
  [167. Modular Patchies Roadmap](167-modular-patchies-roadmap.md): subpatches and abstractions.
- [40. Headless Patcher System](40-headless-patcher-system.md).
- [197](197-canvas-editor-and-dom-islands.md) through
  [206](206-presentation-views.md): the primitive systems.
- [203. Patchies V2 Roadmap](203-patchies-v2-roadmap.md).
