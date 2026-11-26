# 204. Multiplayer

Status: Exploration. Nothing is implemented. This file keeps the context of a
design conversation. It is not a committed plan.

## What Exists Today

- Peer-to-peer messaging over WebRTC rooms through trystero: `netsend` and
  `netrecv` ([35. netsend and netrecv](35-netsend-netrecv.md)),
  `ui/src/lib/p2p/P2PManager.ts`, and the network topic doc
  `ui/static/content/topics/network-p2p.md`.
- Shared transport over the same rooms, with one leader and leader handoff
  ([84. Transport Sync for Musical Objects](84-transport-sync-for-musical-objects.md),
  [87. Networked Transport Sync](87-networked-transport-sync.md)).

What does not exist: syncing nodes and edges, syncing code editors, syncing audio
and video state, and presence such as other people's cursors.

## Goal: CRDT Multiplayer From the First Implementation

The first multiplayer implementation is real-time, simultaneous editing on a CRDT.
There is no single-writer phase first, such as cables.gl's pilot model, where one
person edits and everyone else follows. The data model in this spec and in
[207](207-v2-architecture-invariants.md) is designed for simultaneous editing from
day one, so getting it right once avoids a migration later.

## Layers

Multiplayer in Patchies is six layers, each with its own sync model.

| Layer                                  | What syncs                                   | Model                                  | Persistent |
| -------------------------------------- | -------------------------------------------- | -------------------------------------- | ---------- |
| Patch document: nodes, edges, data     | the structure                                | CRDT                                   | yes        |
| Code in nodes                          | the text                                     | CRDT text, with evaluation as an event | yes        |
| Presence: cursors, selection, viewport | who is where                                 | ephemeral state                        | no         |
| Messages (`netsend`, `netrecv`)        | events                                       | exists today over trystero             | no         |
| Clock and audio                        | tempo, beat, and phase, not the audio itself | a Link-style shared timeline           | no         |
| Video                                  | clock, frame number, and uniforms            | same clock and same inputs             | no         |

Sync the document and the clock, and let each peer run its own runtime. Every peer
runs the same patch locally: its own audio, shaders, and object state. Each peer
builds its runtime graph from the shared document through `runtime.setGraph()`
([40. Headless Patcher System](40-headless-patcher-system.md)). Flok and Estuary
work this way for live coding.

## Patch Document

Use Yjs:

- It is pure JavaScript, so the same TypeScript and the same data structure run in
  the browser host and the native host.
- It includes presence ("awareness"), a CodeMirror binding, per-user undo, and
  WebSocket and WebRTC providers.
- Automerge and Loro have Rust cores that would also fit `patchies_core`
  ([202](202-patchies-core.md)), but they bring WASM into the browser.

Mapping:

- Nodes and edges are maps keyed by ID. Node data is split per field, so edits to
  different fields of one node both survive.
- Positions are last-writer-wins.
- Each code node's code is one `Y.Text`.
- Node IDs must be collision-resistant random IDs, not counters. Two peers creating
  `glsl-3` at the same moment is the first bug to avoid.
- Readers tolerate conflicts instead of preventing them. When one peer deletes a
  node while another connects an edge to it, edges whose endpoints are gone are
  ignored.
- Undo is per user. Yjs's undo manager undoes only your own changes, which replaces
  part of [68. Undo and Redo System](68-undo-redo-system.md).

Kept out of the CRDT:

- Large data, such as samples, images, and VFS files, as content-addressed blobs
  fetched by hash from the server or from peers.
- Runtime state, such as counters, sequencer playheads, and internal object state.
  Each peer keeps its own. Objects can opt in to shared state later.

## Code Editors

- The text syncs live through `Y.Text` and the CodeMirror binding, with remote
  cursors and selections.
- Running code is an explicit, broadcast event, as in [Flok](https://flok.cc).
  Half-typed code must not run on every machine. When someone evaluates a node,
  every peer re-runs that node's code locally at the same moment.
- The native editor reuses CodeMirror's state layer ([201](201-rust-native-host.md)),
  and Yjs binds at that level, so collaboration largely carries over. Remote cursors
  need drawing in the canvas view.

## Clock and Audio

Spec 87 uses one leader with handoff. [Ableton Link](https://www.ableton.com/en/link/)
has no leader: peers share a timeline of tempo, beat, and phase, estimate the
offset between their clocks, and align on a quantum such as a bar. Anyone can
change the tempo, and late joiners lock onto the phase.

- Audio itself never syncs. Each peer renders its own sound from the same patch and
  the same clock.
- Output matches only where objects are deterministic:
  - randomness, such as `noise~` and `Math.random`, needs seeds shared through the clock;
  - AI and network nodes differ between peers;
  - live inputs such as microphones and MIDI stay local unless sent as messages.
- Real Link in the native host: Link is an open-source C++ library under GPL-2 with a
  separate commercial license, so it belongs in a plugin under the licensing rules in
  [200](200-patchies-v2-primitives.md). It uses UDP multicast on a local network,
  which browsers cannot do. Link interop with Ableton and other apps is a native-only
  object. Browsers use a Link-like protocol over the network instead.
- Leaderless clock sync over the internet is harder than over a local network.
  Network jitter limits how tight beat alignment can get.

## Video

Sync the clock, frame number, beat, and the uniforms, which arrive as synced
messages. Shaders are deterministic given the same time and inputs, so peers match
closely. Feedback loops and camera input drift or differ, which is acceptable. For
exact output, one peer can stream video over WebRTC, as VDO.Ninja already does.

## Presence

- Cursors in patch coordinates, not screen coordinates, plus viewport, selection,
  and the code node someone is editing. All of it is ephemeral and never in history.
- Sent at 20–30 updates per second and interpolated on the receiving side.
- Drawn on the canvas editor as a display list overlay
  ([197](197-canvas-editor-and-dom-islands.md)), which is cheap there.
- A follow mode jumps to and follows someone's viewport, like Figma's spotlight.

## Transport and Hosts

The browser host and the native host can join the same room:

- Document sync goes through the Go server over a WebSocket, which works the same
  in both hosts.
- Low-latency ephemeral data, such as cursors, messages, and the clock, uses
  WebRTC peer-to-peer where available. trystero is browser-only for now
  ([201](201-rust-native-host.md)), so native peers fall back to the server relay.
- The Go server relays and stores the update log without understanding the CRDT.
  Compacting the log into snapshots needs CRDT logic: run `yrs`, Yjs's Rust port,
  compiled to WASM inside Go with wazero, or let clients upload snapshots.
- Capability placeholders handle mixed rooms. A native peer sees a `dom` node as a
  placeholder but keeps it intact in the shared document, so browser peers still
  have it (spec 201).

## Trust: Join Equals Trust

Joining a room means trusting everyone in it, the same model as trusted embeds in
spec 200. Everyone's code runs on everyone's machine.

- Joining is the consent. The join screen says so plainly, such as "Everyone in this
  room can run code on your computer." There are no per-node prompts afterwards.
- Viewers trust the room too. A read-only viewer still runs the patch locally,
  including its code, so there is no safe watching-only mode.
- Rooms are joined by invite link, not by a guessable name, and the room's owner can
  remove people. trystero rooms today are joined by name.
- In the native host, portable `js` runs in a V8 isolate limited to the functions
  the host exposes, so trust there means trusting code with the Patchies API, not
  the whole machine. In the browser, it means the page's privileges.

Sandboxing untrusted peers stays possible later through the embed `sandbox`
mechanism. It is out of scope.

## Hard Parts

- Version skew: peers on different Patchies versions or plugin sets need a document
  schema version, migrations, and placeholders for unknown objects.
- Offline edits merge on reconnect, but the result can still surprise people, such
  as a node that moved while someone was editing it offline.
- Removing a person from a room does not remove code they already ran on others'
  machines during the session.

## Precedent

No existing node-based patcher combines audio, video, and simultaneous Figma-style
editing. The closest relatives each miss a piece:

| Tool                                                                          | What it is                                                                                | Multiplayer                                                                                                                                 | Missing                                                                                                                           |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [cables.gl](https://cables.gl/docs/5_1_permissions/4_multiplayer/multiplayer) | A browser node patcher for WebGL visuals and audio                                        | Since its June 2022 release, a pilot model: one person edits at a time, others follow live in the renderer and can ask for the pilot's seat | Simultaneous editing. Its docs do not describe conflict handling or sync internals.                                               |
| [Kiwi](https://github.com/musicoll/kiwi) (Musicoll)                           | A Max- or Pure Data-like patcher built for several remote users editing one patch at once | Truly simultaneous                                                                                                                          | Video. Unmaintained since its research project ended in 2018. GPL-3.0, but built on Flip, a sync library that is not open source. |
| [Wax](https://codeberg.org/nnirror/wax)                                       | A browser audio environment inspired by Max                                               | Real-time collaboration on one workspace                                                                                                    | Video                                                                                                                             |
| [Flok](https://flok.cc), Estuary                                              | Collaborative live coding, including Hydra for visuals and Strudel or Tidal for music     | Shared code buffers; Flok uses Yjs                                                                                                          | Nodes: it is text                                                                                                                 |
| netpd, peer-data (Pure Data)                                                  | Networked jamming                                                                         | Shared state and messages                                                                                                                   | Collaborative patch editing                                                                                                       |
| TouchDesigner, Max, Pure Data                                                 | The established tools                                                                     | Networking between instances                                                                                                                | Co-editing                                                                                                                        |

Lessons:

- cables.gl's pilot model is simpler than a CRDT, but Patchies does not start there
  (see Goal).
- Kiwi's team built a new tool rather than adding collaboration to Pure Data,
  reasoning that refactoring Pd would lose its existing community and development
  base. That matches the clean skeleton approach in [203](203-patchies-v2-roadmap.md).
- Kiwi depended on a closed-source sync library, which is a licensing trap. Yjs is
  MIT-licensed, which fits the licensing rules in [200](200-patchies-v2-primitives.md).

Other references:

- tldraw's sync engine, the inspiration in
  [169. Build Your Own Patcher Vision](169-build-your-own-patcher-vision.md), with its
  own approach instead of Yjs.
- Figma's multiplayer: server-authoritative with last-writer-wins per property,
  deliberately not a full CRDT.
- [Ableton Link](https://www.ableton.com/en/link/).
- Patchwork (NIME 2012): many users controlling one modular synthesizer through a
  browser.

## Open Questions

- Which CRDT library: Yjs, Automerge, or Loro? The lean is Yjs. A CRDT is decided
  (see Goal), so a server-authoritative model like Figma's is ruled out.
- How does the Go server compact the update log: `yrs` in WASM, or client snapshots?
- Which objects opt in to shared runtime state, and how?
- Does Link-style leaderless sync replace spec 87's leader model, or sit alongside it?

## Related Specs

- [87. Networked Transport Sync](87-networked-transport-sync.md): today's leader-based clock sync.
- [197. Canvas Editor and DOM Islands](197-canvas-editor-and-dom-islands.md): where presence is drawn.
- [200. Patchies V2 Primitives](200-patchies-v2-primitives.md): trusted and sandboxed embeds, and licensing.
- [201. Rust Native Host](201-rust-native-host.md): capability placeholders and the native code editor.
- [203. Patchies V2 Roadmap](203-patchies-v2-roadmap.md): the V2 index.

## Suggested Order

1. Collision-resistant node IDs.
2. The patch document in Yjs, synced through the Go server, with each peer's runtime
   built from it.
3. Presence and cursors on the canvas editor.
4. Collaborative code with broadcast evaluation.
5. A Link-style shared clock, and Link interop in the native host.
