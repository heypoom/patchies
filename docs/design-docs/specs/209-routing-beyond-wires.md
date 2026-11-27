# 209. Routing Beyond Wires

Status: Exploration. This spec records an idea for Patchies V2 beyond nodes and
edges. Nothing here is decided, except the two small core decisions in What V2
Needs Now.

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

## Stored and Derived Links

- **Wires are stored.** Someone drew a wire, so it is document data.
- **Spatial links are derived.** A router computes proximity and adjacency links
  from positions on each tick. Only the rules are stored, such as a signal range or
  which faces count.

This fits the three kinds of state in invariant 5 of
[207](207-v2-architecture-invariants.md): a derived link is runtime state and is
never saved. Multiplayer syncs positions and rules, and each peer derives the same
links from them.

## Message Metadata

A message carries its value and optional routing metadata:

- strength, such as Redstone's 0 to 16, or a proximity falloff;
- distance;
- direction, or the face it arrived on;
- the source node.

An object that does not care reads only the value, so a button works unchanged. A
light that fades with distance reads the strength.

A signal that loses strength with each hop dies out, so it cannot loop forever.
Redstone's limited range is that rule. Feedback loops that never stop are the risk
of message-driven updates that the behavior examples note.

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

## What V2 Needs Now

Worlds are shell work: experimental, and not for live performance until they meet
the core bar
([207](207-v2-architecture-invariants.md#live-performance-stable)). Two small
decisions belong in core from the first version, because they are hard to add
later:

1. **Routing is an interface in `@patchies/core`,** with wires as the first
   implementation and names (`s` and `r`) as the second. Spatial routers get their
   positions and neighbors from a generic spatial index, so the generic canvas core
   still knows nothing about messages (invariant 14).
2. **The message envelope has room for optional metadata** from the first version.

Without these, every world would later have to fake wires.

## Open Questions

- Which world comes first as an experiment: proximity, a Redstone-style grid, or
  gravity?
- How does a world handle a node with no spatial meaning, such as a `js` node with
  three inlets?
- Can one patch mix routers without subpatches, such as wires plus proximity on the
  same canvas?
- Does Scratch-style control flow belong here, or in its own spec?
- How do agents work in spatial worlds: by moving nodes, or through router-aware
  commands?

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
