# 209. Routing Beyond Wires

Status: Exploration. This spec records an idea for Patchies V2 beyond nodes and
edges. Nothing here is decided, except the small core decisions in What V2 Needs
Now. A playable prototype tested it (Prototype Results below).

## Problem

Messaging in Patchies today is tied to XYFlow's picture of a patch: nodes on a
screen, with visible edges from outlets to inlets. Sending a message means
following the edges out of an outlet.

A 2D canvas could support many more kinds of interaction. A year ago,
[Examples of Possible Behaviors](../behavior-examples.md) listed some of them:
fixed cycles, 2D magnets, Redstone, Scratch blocks, and combining objects. Poom's
examples since then:

- **Proximity:** objects broadcast signals, and other objects react to them, as in
  [Gro](https://depts.washington.edu/soslab/gro), where simulated cells signal each
  other. A button could light up near an audio source, and get less signal the
  further away it is.
- **Gravity:** blocks fall down, and a block resting on another sends it messages.
- **Redstone:** connections with a limited signal range, such as 0 to 16.
- **Scratch blocks:** blocks slot into other blocks.

The goal is to keep messaging central, but make the physical wire and the visible
inlets optional.

## Routing Separate From Wires

Split sending a message into two parts:

- **Delivery** is the message system that exists today: path addressing
  (invariant 3), scheduling, and commands from actors (invariant 6).
- **Routing** answers who receives a message, and with what metadata. A wire is one
  router among several:

| Router      | Who receives a message                                      | Precedent                                 |
| ----------- | ----------------------------------------------------------- | ----------------------------------------- |
| Wires       | whatever the outlet connects to                             | Max, Pure Data                            |
| Names       | every `r` with the same name                                | Pure Data's `s` and `r`, already wireless |
| Proximity   | nodes within range, with strength falling off over distance | Gro, Reactable                            |
| Adjacency   | the neighbor on a face: up, down, left, or right            | Orca, Redstone                            |
| Containment | the block in a slot, or the slot's owner                    | Scratch                                   |

Pure Data's `s` and `r` already deliver messages without a wire. Proximity and
adjacency are the same idea, where space decides who is connected instead of a
name.

### The Router Interface

The prototype's interface is `routes(send, out)`:

- `send` holds the sender, the outlet, the incoming metadata, and the wave.
- `incoming` is the metadata of the message the sender was handling, so a relay
  carries strength onward.
- The wave is an ID shared by everything one root send causes synchronously, used to
  guard against loops.
- The router appends routes to `out`.

Delivery owns the depth guard and the wave counter. Routers own decay and the
per-wave rule (Loops below).

A route's target should be a path, such as `doc/p-…/node`, not a node ID, so a
router can reach other runtimes (invariant 3). Names, including `doc:` and `host:`
names, then become a router, and `meta.source` can cross subpatch boundaries. Until
targets are paths, names stay a separate delivery path: in the prototype they cross
subpatches and documents and deliver to callbacks, while a router lives inside one
runtime and delivers to inlets.

## Stored and Derived Links

- **Wires are stored.** Someone drew a wire, so it is document data.
- **Spatial links are derived.** A router computes proximity and adjacency links
  from positions on each tick. Only the rules are stored, such as a signal range or
  which faces count.
- **Re-derive only around what moved.** Precomputed links cost memory in proportion
  to sources times density, so prefer lazy links: a move marks nearby sources stale,
  and a source re-derives its links when it next sends.
- **Positions are document state,** changed through a `move` command (invariant 6).
  Before the prototype, dragging changed positions without going through the
  document.

This fits the three kinds of state in invariant 5 of
[207](207-v2-architecture-invariants.md): a derived link is runtime state and is
never saved. Multiplayer syncs positions and rules, and each peer derives the same
links from them.

## Message Metadata

A message carries its value and optional routing metadata:

- `strength`, always from 0 to 1 in every world;
- `level`, a whole number for integer worlds, such as Redstone's 0 to 16;
- distance;
- direction, or the face it arrived on;
- the source node;
- the router that delivered it;
- the number of hops so far.

An object that does not care reads only the value, so a button works unchanged. A
light reads `strength` the same way in every world. `router` tells apart the same
message arriving twice, once by cable and once by field.

## Loops

Feedback loops that never stop are the risk of message-driven updates that the
behavior examples note.

- **Decay bounds depth.** A signal that loses strength with each hop dies out.
  Redstone's limited range is that rule.
- **Decay does not bound fan-out.** The per-wave rule does: within one wave, a node
  hears a signal again only if it is stronger.
- **Decay only ends synchronous loops.** A relay inherits strength only while
  delivery knows what it was handling. Timers, `await`, workers, subpatch boundaries,
  and remote peers break that link, so a loop through any of them sends at full
  strength again and never decays. Scoped timers could carry the context, but user
  promises in `js` cannot be tracked: JavaScript has no standard async context yet
  (the TC39 AsyncContext proposal).

So decay cannot be the live-performance safety net. Delivery needs a guard that does
not depend on causality, for every router, wires included: a per-node message rate
limit, or a per-node budget of messages per tick.

## Spatial Ports

Node definitions declare ports abstractly, and each world decides how a port
appears:

| World               | Ports                                          |
| ------------------- | ---------------------------------------------- |
| Wires               | inlets and outlets                             |
| Adjacency           | faces: top, bottom, left, and right            |
| Proximity           | one implicit port, the field around the node   |
| Scratch-style slots | typed slot shapes, where the shape is the type |

This follows
[168. Runtime Object and Editor Representations](168-runtime-object-editor-representations.md),
which separates an object from how the editor draws it.

## Worlds

A patch or a subpatch declares its world: wires by default, or field, grid, or
physics. A world brings:

1. **A router,** from the table above.
2. **A tick.** Proximity and physics need a fixed simulation step on the clock tree
   (invariant 8). That is the "message passing with fixed cycle" model from the
   behavior examples.
3. **Editor chrome:**
   - wires get cables;
   - fields get range halos;
   - grids get snapping and face markers;
   - physics gets gravity and collisions.

The node draws the same in every world: a button is a button. The display list
([197](197-canvas-editor-and-dom-islands.md)) makes it cheap to add chrome around a
node, or to swap in a different renderer for one world.

Worlds nest through subpatches. A grid world inside a wired patch talks to it
through `in` and `out`, so modes mix without one global rule.

## Hard Parts

- **Physics.** A falling block's position changes every tick, so its simulated
  position is runtime state on top of its stored rest position. In multiplayer,
  either the simulation is deterministic everywhere, or one peer is in charge of it.
- **Scratch is the furthest away.** Scratch blocks are imperative: they run in
  order. That is control flow, not data flow, so it may be a different kind of world
  rather than another router.
- **Scale.** Proximity between every pair of nodes grows with the square of the node
  count. It needs a spatial index, which the canvas controller already has for
  hit-testing, and recomputing only around nodes that moved keeps very large
  patches workable.
- **Tests.** A fixed tick and seeded randomness keep derived routing deterministic,
  so golden message traces still work ([208](208-v2-testing-strategy.md)).
- **Node extents.** Core does not know node sizes, but spatial worlds need a node's
  size or center. Without it, the prototype's proximity measured between top-left
  corners while halos drew from centers, and a node wider than a grid cell landed in
  the wrong cell.
- **Loop safety.** See Loops: delivery enforces a rate or budget guard for every
  router. Router calls are also contained like experimental objects, with a try and
  catch plus a time budget per tick and per send, because an exception in an
  experimental router would otherwise break wires too.
- **Events and levels.** Messages are events, but Redstone power and Gro signals are
  state: a level that persists, and a concentration that objects sample. Bursts of
  messages only approximate them. A lamp flashes on each bang instead of staying lit
  near a source, and the depth-first send order leaks into results. Those worlds need
  a second primitive next to routing: levels or fields evaluated on the tick, which
  objects read as a value.
- **Determinism.** Derived links depend on exact positions, tick timing, and
  floating-point math. During a drag, peers see positions at different moments, and
  a Rust `patchies_core` could disagree with JavaScript in the last bits of `sqrt` or
  `atan2`, so deliveries near a range edge flip. Spatial worlds that must agree use
  quantized positions, as integers or fixed point, and whole-number strength math.
  Grid worlds get this for free. This constrains the document format, so decide it
  before positions sync in multiplayer.

## What V2 Needs Now

Worlds are shell work: experimental, and not for live performance until they meet
the core bar
([207](207-v2-architecture-invariants.md#live-performance-stable)). Three small
decisions belong in core from the first version, because they are hard to add
later:

1. **Routing is an interface in `@patchies/core`,** with wires as the first
   implementation. Names (`s` and `r`) join once route targets are paths. Spatial
   routers get their positions and neighbors from a generic spatial index, so the
   generic canvas core still knows nothing about messages (invariant 14).
2. **The message envelope has room for optional metadata** from the first version.
3. **Delivery guards every router.** A per-node rate or budget guard, and contained
   router calls, apply to wires too, so a loop or a broken experimental router cannot
   take down a performance.

Without these, every world would later have to fake wires.

Decide before multiplayer syncs positions: whether positions are quantized.

### First Version: Wires Only, Behind the Interface

The first version ships one router, wires, but the routing concept is explicit in
code, and wires are an implementation of an interface. The shape comes from the
prototype:

```ts
// @patchies/core/routing/router.ts
/** Decides who receives a message. Delivery stays in the message system. */
export interface Router {
  readonly id: string; // 'wire'
  routes(send: Send, out: Route[]): void;
}

export interface Send {
  from: NodePath;
  outlet: number;
  incoming?: MessageMeta; // metadata of the message the sender was handling
  wave: WaveId; // shared by everything one root send causes synchronously
}

export interface Route {
  to: NodePath; // a path, not a node ID (invariant 3)
  inlet: number;
  meta?: MessageMeta;
}

// @patchies/core/routing/wire-router.ts
export class WireRouter implements Router {
  readonly id = "wire";

  constructor(private readonly connections: ConnectionIndex) {}

  routes(send: Send, out: Route[]) {
    for (const c of this.connections.from(send.from, send.outlet)) {
      out.push({ to: c.to, inlet: c.inlet });
    }
  }
}
```

The names are a sketch.

- **Delivery owns the rules for every router:** the wave counter, the depth guard,
  and the per-node rate or budget guard. They apply to wires from day one.
- **The composition root passes routers in,** such as
  `createRuntime({ routers: [new WireRouter(connections)] })`. There is no router
  registry singleton (invariant 1).
- **The message envelope has an optional `meta` field.** Wires leave it empty, and
  objects ignore it.

Deferred until a world needs it:

- the spatial index, the tick, derived links, worlds, and world chrome;
- metadata fields beyond the empty `meta` slot, such as `strength` and `level`;
- names (`s` and `r`) as a router, once route targets are paths everywhere.

Invariant 14 warns against generality before it is needed, and an interface with
one implementation can quietly take the shape of that implementation. Three guards
keep it honest:

1. **The interface comes from the prototype, not from guesses.** `routes(send,
out)`, `incoming`, and `wave` are what proximity and the grid needed. Nothing
   more goes in until a real second router needs it.
2. **A second router in tests.** A small fake router, such as one that routes to a
   fixed list of nodes, tests delivery's guards and the per-wave rule. If the
   interface starts assuming wires, those tests break.
3. **Routing is its own folder in core,** so the concept is visible, and
   dependency-cruiser checks that `WireRouter` is the only router core ships.

Naming: **router** in code, for what decides who receives a message. **World**
later, for a router plus its tick and editor chrome. **Behavior** stays the word
for people, in docs and in the editor.

## Prototype Results

A playable prototype added wires, proximity, and a Redstone-style grid as routers
to the V2 prototype, on both hosts. Its write-up is
`spikes/v2-prototype/FINDINGS-routing.md` on branch
`claude/routing-worlds-spike-e24404`, local only.

- Moving wires into a router kept the original 78-message golden trace identical,
  and no existing object changed. `button`, `toggle`, and `metro` know nothing about
  worlds.
- A new generic package, `@patchies/spatial`, holds a spatial hash with no knowledge
  of messages. The dependency checks enforce that.
- Each world has a golden trace in both hosts' test suites.
- Dragging one node costs under 3.5 ms per tick at 100,000 nodes. Dense sources are
  costly: with 100,000 nodes that are all sources there are 5 million links, the
  first derive takes 2 s, and moving 100 nodes takes about 70 ms. That is the case
  for lazy links.
- Proximity has to be opt-out. Every node in range listened, so a metro toggled its
  own toggle, and nodes gained `route.listen: false`.
- Switching worlds exposed leaks in the app's disposal code, which were fixed.

## Open Questions

Answered by the prototype:

- **Which world first?** The grid. It is discrete, deterministic without
  floating-point rounding, and cheap: about 2 links per node. Proximity is more fun
  to play, but it brings floats, dense-source costs, and listening by default.
- **Nodes with no spatial meaning,** such as a `js` with three inlets:
  - spatial messages arrive at inlet 0 by default, and `route.inlet` picks another;
  - in a grid, `route.faceInlets` maps faces to inlets, such as left to 0, up to 1,
    and right to 2;
  - `js` gets the metadata as `recv((data, inlet, meta) => …)`;
  - `route.listen: false` opts a node out;
  - a node with no outlet, such as a lamp, shows no face markers and sends nothing.
- **Mixing routers without subpatches:** yes, for wires plus one spatial router,
  because wires always run. A node can receive the same message twice, and
  `meta.router` tells the routes apart. Duplicates are not removed. Two spatial
  routers on one canvas would need each node to say which world it belongs to,
  which is untested.
- **Scratch-style control flow:** untested. The wave, everything one send causes
  synchronously, is close to what an ordered stack of blocks needs, so it gets its
  own spec.
- **Agents:** `move` and `route` commands change positions and rules, and a
  router-aware `query` returns a node's derived links and the last level it heard. An
  agent never measures distances itself, and links appear on the next tick.

Still open:

- A `near` query, "who would hear me from here", without moving the node.
- Where node extents live: in core, or in each world.
- What the levels or fields primitive looks like, and how it sits on the tick.
- Rate limit or per-tick budget, and its defaults for live performance.

## Related Specs

- [Examples of Possible Behaviors](../behavior-examples.md): the original list.
- [40. Headless Patcher System](40-headless-patcher-system.md): the runtime that
  delivers messages.
- [168. Runtime Object and Editor Representations](168-runtime-object-editor-representations.md).
- [197. Canvas Editor and DOM Islands](197-canvas-editor-and-dom-islands.md): the
  display list, controller, and spatial index.
- [204. Multiplayer](204-multiplayer.md): syncing positions and rules.
- [206. Presentation Views](206-presentation-views.md): another way of separating
  where a node appears from what it does.
- [207. V2 Architecture Invariants](207-v2-architecture-invariants.md): invariants
  3, 5, 8, and 14.
