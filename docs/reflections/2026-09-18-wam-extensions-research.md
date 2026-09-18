# WAM Extensions Feasibility Research (2026-09-18)

## Question

How difficult would it be to support the Note, Video, Asset, and
ModulationTarget WAM extensions in Patchies' existing `wam~` object?

## Recommendation

Do not implement all four as one feature.

First build a small shared WAM-extension host and WAM event-edge foundation,
then implement **Note** and **ModulationTarget** together. Implement **Asset**
as a separate VFS project after deciding what a durable asset URI means in an
exported/shared patch. Treat **Video** as a rendering architecture project, not
as another `WamAudioNode` method.

Recommended order:

1. Add extension discovery, instance registration, teardown, and WAM event
   connections between `wam~` nodes.
2. Add Note and ModulationTarget on that event graph.
3. Add Asset after specifying picker, URI, persistence, export/import, and
   permission behavior.
4. Run a Video proof of concept with one generator and one Patchies boundary.
   Decide the main-thread/worker boundary from measured results before
   promising general Video support.

The extension interfaces are short, but they are not a stable equivalent of
the WAM 2 core API. The official WAM site links to a repository whose package
describes itself as “Unofficial extensions,” is version `0.2.4`, has no tests,
and whose latest commit is from January 2023. Capability discovery is only the
presence of an optional property on `window.WAMExtensions`; there is no version
or feature negotiation. Pin the source revision and test against named plugins
instead of treating the current shapes as a durable standard. See the
[official extensions overview](https://www.webaudiomodules.com/docs/usage/extensions/),
[extension package metadata](https://github.com/boourns/wam-extensions/blob/7dde855bbdc92712a2c827b037a03e0261d3c477/package.json),
[global registry](https://github.com/boourns/wam-extensions/blob/7dde855bbdc92712a2c827b037a03e0261d3c477/src/WAMExtensions.ts),
and [repository README](https://github.com/boourns/wam-extensions/blob/7dde855bbdc92712a2c827b037a03e0261d3c477/README.md).

## Relative difficulty

These estimates are engineering ranges for someone familiar with Patchies.
They include focused tests and one or two real plugin fixtures, but not a broad
community compatibility campaign.

| Work | Difficulty | Estimate | Main reason |
| --- | --- | ---: | --- |
| Global extension bootstrap and lifecycle registry | Medium | 1–2 days | Must exist before remote module evaluation and clean up replaced instances |
| WAM event-edge foundation | Medium–high | 3–5 days | `wam~` currently accepts events but cannot emit/connect WAM event streams or expose instance IDs |
| Note after the foundation | Low–medium | 3–5 days | Small synchronous metadata contract; graph mapping, reversed Note semantics, and real-plugin coverage are the work |
| ModulationTarget after the foundation | Medium–high | 1–2 weeks | Target metadata is easy; routing, locking, reconnection, and multi-target semantics are not |
| Asset, local VFS only | Medium | 4–7 days | Store/resolve primitives exist, but picker and request lifecycle do not |
| Asset with portable/shared-patch semantics | Medium–high | 1.5–3 weeks total | URI remapping, export/import, permissions, and missing-asset UX need a product contract |
| Video proof of concept | High | 2–4 weeks | Must prove a viable main-thread/worker context and texture boundary |
| General Video support | Very high | 4–8+ weeks | Host-owned WebGL2 graph, dynamic ports, GPU lifecycle, worker bridging, context loss, and performance |

The Video estimate is deliberately open-ended. I do not know whether a
zero-copy implementation is possible without moving either the WAM video
delegates or a significant part of Patchies' render graph across the worker
boundary. The spike must answer that with traces and frame-time measurements.

## What Patchies has today

The current object is a good WAM **audio** host:

- it creates one host group per `AudioContext`, imports a WAM entry URL, and
  creates an instance;
- it wraps the plugin with stable input/output `GainNode`s;
- it schedules incoming Patchies MIDI and parameter automation events;
- it reads parameter metadata and state; and
- it independently creates/destroys the plugin GUI and audio instance.

See [`WamAudioNode.ts`](../../ui/src/objects/wam~/WamAudioNode.ts),
[`wam~.md`](../../ui/static/content/objects/wam~.md), and
[`186-web-audio-modules.md`](../design-docs/specs/186-web-audio-modules.md).

The extension work crosses boundaries the first release intentionally omitted:

- `WamInstance` and `WamPluginAudioNode` do not expose the core WAM
  `instanceId`, `connectEvents()`, or `disconnectEvents()` capabilities.
- `wam~` has a message inlet but no event/message outlet.
- `AudioService` explicitly skips message edges, so it never establishes core
  WAM event connections between two WAM instances.
- `wam~` exposes only one audio inlet and outlet and is not registered in the
  Patchies video render graph.
- extension registration is page-global, while the current WAM host state is
  private to `WamAudioNode.ts` and scoped per `AudioContext`.

The standard WAM node contract supplies the missing primitive:
`connectEvents(toId)` connects one WAM event output to another instance and
`disconnectEvents()` tears it down. The same contract exposes `instanceId`,
full parameter metadata, scheduling, and destruction. See the pinned
[WAM API `WamNode` interface](https://github.com/webaudiomodules/api/blob/ea39fccecc57db352980ac36bcd7ea8ae4de25e0/src/types.d.ts).

## Common extension-host foundation

All four contracts are installed on `window.WAMExtensions`. Plugins call the
extension object directly from main-thread JavaScript and identify themselves
with their WAM `instanceId`; none of these calls travel through the WAM event
queue. The registry only declares optional extension properties and initializes
the global object. See
[`WAMExtensions.ts`](https://github.com/boourns/wam-extensions/blob/7dde855bbdc92712a2c827b037a03e0261d3c477/src/WAMExtensions.ts).

Patchies therefore needs a shared coordinator that exists before the remote
plugin module is imported and that owns:

- one pinned implementation of each enabled extension;
- a mapping between Patchies node IDs and live WAM instance IDs;
- registration/unregistration when a WAM is loaded, replaced, or destroyed;
- graph synchronization when edges or live instances change;
- cancellation tokens for asynchronous extension work, matching the stale-load
  protections already present in `WamAudioNode`; and
- error isolation so one remote callback cannot break graph reconciliation or
  the render loop.

This coordinator should not put concrete WAM extension branches throughout
`AudioService`. Add a small generic event-connection capability to
`AudioNodeV2`, or keep the whole WAM event graph in an object-owned service and
feed it normalized edge changes. The important invariant is that the visual
edge, the core WAM event connection, and the extension's graph mapping are
created and removed together.

## 1. Note extension

### Contract

The data contract is:

```ts
type NoteDefinition = {
  number: number
  name?: string
  blackKey: boolean
}
```

An instrument calls `setNoteList(pluginId, notes)`. A sequencer calls
`addListener(pluginId, callback)`. The host calls
`addMapping(destinationId, sourceIds)` to say which sound-generating WAMs are
driven by that sequencer. Each mutation synchronously recomputes delivery. If
several sources are present, the first source in host-provided order that has a
note list wins; lists are not merged. See the complete
[Note extension source](https://github.com/boourns/wam-extensions/blob/7dde855bbdc92712a2c827b037a03e0261d3c477/src/notes/NoteExtension.ts).

The official description is specifically UI metadata: a drum machine or
sampler publishes the relevant MIDI note numbers/names so a connected piano
roll can adapt its display. Actual notes still use normal WAM MIDI event
routing. See the
[official Note overview](https://www.webaudiomodules.com/docs/usage/extensions/#1---the-note-extension).
The author's example sampler publishes its list, while the piano-roll example
registers a listener:
[sampler producer](https://github.com/boourns/burns-audio-wam/blob/30869512b1efe5743576cb43e124f62c14b43018/src/plugins/drumsampler/src/Node.ts) and
[piano-roll consumer](https://github.com/boourns/burns-audio-wam/blob/30869512b1efe5743576cb43e124f62c14b43018/src/plugins/pianoroll/src/PianoRoll.tsx).

### Patchies gap

Installing `NoteExtension` alone would have little value. A WAM sequencer
inside `wam~` cannot currently send its emitted MIDI event stream to another
`wam~`, because the object has no event outlet and Patchies does not call core
`connectEvents()`. Note mappings also must be derived from the same directed
event edges and refreshed after load/replacement, when instance IDs change.

The small contract has several host-policy gaps:

- no validation for MIDI note range or duplicate notes;
- mandatory `blackKey` presentation data even though a host could derive it;
- no merging when a sequencer targets several instruments;
- precedence depends on host-provided source order; and
- `clearMapping()` clears state without notifying listeners.

### Proposed boundary and verification

Add a WAM event outlet to the visual object and map a `wam~`-to-`wam~` event
edge to both `connectEvents(target.instanceId)` and
`notes.addMapping(source.instanceId, [target.instanceId])`. Reverse that mapping
carefully: the Note “destination” is the sequencer receiving metadata, while
the normal event destination is the instrument receiving MIDI.

Test one piano-roll WAM and one sampler WAM through load, connect, reconnect,
replacement, multiple targets, and destruction. Verify that removing the edge
clears the piano-roll metadata and WAM event connection. The current
`clearMapping()` behavior means Patchies may need explicit per-destination
removal rather than a blanket clear.

**Assessment:** easy extension logic, medium integration because the useful
product depends on the shared event-edge foundation.

## 2. Asset extension

### Contract

The extension defines two asset categories, `"AUDIO"` and `"DATA"`, and this
record:

```ts
type WamAsset = {
  uri: string
  name: string
  content?: Blob
}
```

Plugins register a synchronous `fetchAssetList()` delegate. Hosts optionally
provide `pickAsset(pluginId, type, callback)`,
`loadAsset(pluginId, uri)`, and
`saveAsset(pluginId, type, content, name?)`. See the complete
[Asset extension source](https://github.com/boourns/wam-extensions/blob/7dde855bbdc92712a2c827b037a03e0261d3c477/src/assets/AssetExtension.ts)
and the
[official Asset overview](https://www.webaudiomodules.com/docs/usage/extensions/#3---the-asset-extension).

The author's drum-sampler example stores an asset URI in WAM state, asks the
host to resolve it, then decodes the returned optional `Blob`. This confirms
that the URI, not the bytes, is the stable plugin-facing reference:
[drum sampler asset loading](https://github.com/boourns/burns-audio-wam/blob/30869512b1efe5743576cb43e124f62c14b43018/src/plugins/drumsampler/src/Kit.ts).

### Patchies gap

Patchies already has most low-level storage primitives.
`VirtualFilesystem.storeFile()` stores a browser `File` and returns a VFS path;
`resolve()` returns a `File | Blob`. See
[`VirtualFilesystem.ts`](../../ui/src/lib/vfs/VirtualFilesystem.ts) and
[`types.ts`](../../ui/src/lib/vfs/types.ts). That makes a basic mapping
straightforward:

- return a VFS path as `WamAsset.uri`;
- resolve a VFS path into `content` for `loadAsset()`; and
- wrap a saved `Blob` in a `File`, store it, and return the new VFS URI.

The difficult part is the product contract that the extension leaves open:

- There is no reusable “pick one VFS asset” dialog; the current file tree and
  per-object drop/relink UIs are not a host callback API.
- `AUDIO`/`DATA` is too coarse to derive exact MIME, extension, or validation.
- The API has no progress, cancellation, structured errors, size limits,
  checksum, or permissions model.
- `pickAsset()` returns `void` while accepting an async plugin callback, so the
  owner of callback failures is unspecified.
- `content` is optional and a saved URI may point to browser-local storage,
  linked filesystem content, a remote URL, or patch-embedded content with very
  different portability.
- Patch-embedded VFS entries currently store string content and enforce small
  text-oriented byte budgets; binary media saved through `storeFile()` is
  local/URL-provider content, not automatically embedded in the patch. See
  [`types.ts`](../../ui/src/lib/vfs/types.ts) and
  [`PatchImportPlanner.ts`](../../ui/src/lib/vfs/PatchImportPlanner.ts).
- The extension stores delegates but never calls `fetchAssetList()` itself.
  Patchies must decide whether and when to collect dependencies for patch
  export, sharing, deletion warnings, and relinking.

Before implementation, specify whether a shared/exported patch copies every
registered WAM asset into the patch, preserves remote URLs, or leaves local VFS
references that can become unavailable. This affects saved WAM state and cannot
be repaired transparently after the fact.

### Proposed boundary and verification

Implement Asset in a VFS-owned adapter used by the shared extension host, not
inside each `WamAudioNode`. Scope every request to a currently live instance ID
and reject requests from destroyed/replaced instances. Add a general VFS picker
that filters by asset category and returns a durable URI.

Test local, remote, missing, and revoked-permission assets; same-name saves;
large blobs; cancelled picks; plugin replacement during an open picker; patch
reload; and the chosen export/import behavior.

**Assessment:** modest code surface, medium–high product and persistence risk.

## 3. ModulationTarget extension

### Contract

A modulation WAM registers this delegate:

```ts
type ModulationTargetDelegate = {
  connectModulation(params: WamParameterInfoMap): Promise<void>
}
```

The host detects the target, obtains its normal WAM parameter-info map, and
passes that map to the modulator. The extension also allows the host to provide
`lockParametersForAutomation(pluginId, paramIds)`. See the
[ModulationTarget source](https://github.com/boourns/wam-extensions/blob/7dde855bbdc92712a2c827b037a03e0261d3c477/src/modulationTarget/ModulationTargetExtension.ts)
and
[official Modulation overview](https://www.webaudiomodules.com/docs/usage/extensions/#4---modulation-extension).

The extension does not transport values. Example modulators emit ordinary
`wam-automation` events, which require the host to make a normal core WAM event
connection to the target. The author's Randomizer registers the delegate and
emits automation; the envelope follower asks the host to lock its chosen
parameter:
[Randomizer example](https://github.com/boourns/burns-audio-wam/blob/30869512b1efe5743576cb43e124f62c14b43018/src/plugins/randomizer/src/index.tsx) and
[envelope follower example](https://github.com/boourns/burns-audio-wam/blob/30869512b1efe5743576cb43e124f62c14b43018/src/plugins/envmod/src/Node.ts).

### Patchies gap

Patchies already calls `getParameterInfo()` for the parameter inspector and can
schedule automation **into** one WAM, but it discards most parameter metadata
and does not connect event outputs between WAMs. Modulation requires:

- the same WAM event outlet and `connectEvents()` foundation as Note;
- the complete `WamParameterInfoMap`, not Patchies' current `{ id, label }`
  projection;
- reconnection when either WAM is asynchronously replaced;
- a lock model that coordinates plugin modulation with the inspector, message
  `set`, saved state, and future Patchies automation; and
- deterministic teardown/unlocking.

The contract itself does not identify the target in `connectModulation()`,
provide a disconnect callback, or define multiple simultaneous targets. It
does not define what a lock prohibits, which modulator wins, how two modulators
share a parameter, or how locks coexist with host automation. The example
plugin calls the optional host lock function without guarding it, so practical
compatibility requires implementing it.

### Proposed boundary and verification

For the first release, allow one active target per modulation WAM. On an event
edge from a registered modulator to a WAM target:

1. connect the standard WAM event stream;
2. fetch the target's full parameter map;
3. call the source delegate's `connectModulation(map)`; and
4. track the source's lock set in the host coordinator.

Reject or visibly mark a second target until the upstream contract defines
multi-target identity. Define “lock” narrowly: it records automation ownership
and disables conflicting Patchies/manual writes for those parameter IDs while
the edge exists. Unlock on edge removal, source/target replacement, and
destruction, including stale async completions.

Test randomizer, LFO/envelope, reconnect, target parameter changes, target
replacement, concurrent lock requests, invalid parameter IDs, and automation
timestamps through the actual AudioWorklet event graph.

**Assessment:** medium–high despite a 27-line extension class; the real work is
event routing and an ownership policy the contract does not supply.

## 4. Video extension

### Contract

A Video WAM registers a delegate with:

```ts
type VideoExtensionDelegate = {
  connectVideo(options: {
    width: number
    height: number
    gl: WebGL2RenderingContext
  }): void
  config(): { numberOfInputs: number; numberOfOutputs: number }
  render(
    inputs: (WebGLTexture | undefined)[],
    currentTime: number
  ): (WebGLTexture | undefined)[]
  disconnectVideo(): void
}
```

The host owns the WebGL2 context, size, graph, texture routing, frame clock, and
render loop. Plugins synchronously return textures each frame. Video WAMs are
still audio WAMs, so they may use audio/MIDI while generating video. See the
[Video extension source](https://github.com/boourns/wam-extensions/blob/7dde855bbdc92712a2c827b037a03e0261d3c477/src/video/VideoExtension.ts),
[official Video overview](https://www.webaudiomodules.com/docs/usage/extensions/#2---the-video-extension),
and the author's
[Butterchurn delegate](https://github.com/boourns/burns-audio-wam/blob/30869512b1efe5743576cb43e124f62c14b43018/src/plugins/video_butterchurn/src/index.tsx).

The extension's own `connections` map is unused. It does not define topology,
cycles, texture formats, color space, alpha, ownership/deletion, resize,
context-loss recovery, or error isolation. Those are host responsibilities.

### Patchies gap

Patchies already has the larger and more capable render graph, including
topological sorting, feedback edges, per-node framebuffers, multiple outputs,
and preview/output routing. See
[`types.ts`](../../ui/src/lib/rendering/types.ts),
[`graphUtils.ts`](../../ui/src/lib/rendering/graphUtils.ts), and
[`GLSystem.ts`](../../ui/src/lib/canvas/GLSystem.ts).

However, its WebGL renderer and textures live in a dedicated render worker.
`GLSystem` on the main thread owns a `RenderWorker`, sends the built graph to
it, and receives transferable frame products; the worker creates the WebGL2
context from an `OffscreenCanvas` in
[`fboRenderer.ts`](../../ui/src/workers/rendering/fboRenderer.ts). Extension
delegates register on the main-thread `window` and expect direct calls with a live
`WebGL2RenderingContext` plus context-owned `WebGLTexture` objects. A WebGL
context or texture cannot simply be passed through Patchies' existing worker
message protocol: the WebGL specification exposes `WebGLTexture` in Window and
Worker realms but does not mark it transferable, while the HTML structured-data
standard requires platform objects to opt into transfer explicitly. See the
[WebGL object interfaces](https://registry.khronos.org/webgl/specs/latest/1.0/)
and
[HTML transferable-object rules](https://html.spec.whatwg.org/multipage/structured-data.html#transferable-objects).

That creates three possible architectures, none trivial:

1. **Move WAM delegates into the render worker.** This preserves texture-local
   rendering but remote WAM modules may assume `window`, DOM, GUI, and their
   main-thread audio module instance. The extension API provides no proxy
   protocol.
2. **Move WAM video rendering, or the whole render graph, to the main thread.**
   This preserves direct delegate calls but risks a major performance and
   architecture regression for every Patchies video node.
3. **Run a separate main-thread WAM WebGL2 subgraph and bridge boundary frames
   to/from the Patchies worker.** This contains the change but requires
   readback/transfer/upload or `ImageBitmap` bridges, adds latency and copies,
   complicates feedback, and prevents direct texture sharing across mixed
   Patchies/WAM chains.

There are additional object-model changes: `wam~` currently has static audio
ports while `config()` reports dynamic counts of video inputs/outputs only
after the remote module loads. The visual node, generated schema, edge cleanup,
render-node registry, preview, culling-independent lifecycle, resolution
changes, and instance replacement all need to handle those late ports.

### Required spike

Build only this proof first:

1. load one known Video generator WAM;
2. provide it a host-owned WebGL2 context;
3. render to one `wam~` video outlet and display it through Patchies;
4. destroy/recreate and resize it without leaked GPU objects;
5. measure CPU/GPU frame time and transfers at 720p and 1080p; and
6. add one Patchies-to-WAM input boundary to expose copy/latency cost.

Do not begin with arbitrary multi-input/multi-output processing. If the bridge
cost is unacceptable, stop and write a rendering architecture decision before
changing `GLSystem`. A dedicated Video-WAM host object may also be clearer than
making every audio `wam~` carry a dormant second runtime, but that is a product
decision for the follow-up spec.

**Assessment:** very high. This is the only extension that conflicts with a
fundamental Patchies execution boundary.

## Dependencies and delivery slices

```text
Pinned global extension host
  ├─ instance ID + lifecycle registry
  ├─ WAM event outlet + core connectEvents/disconnectEvents
  │    ├─ Note graph mapping
  │    └─ Modulation target metadata + locks
  ├─ VFS adapter + picker + durable URI policy
  │    └─ Asset
  └─ rendering architecture spike
       └─ Video
```

A practical delivery plan is:

### Slice A: event-capable WAM host

- Preserve the WAM instance ID and full WAM node interface.
- Add a typed WAM event outlet and graph-owned event connect/disconnect.
- Install the pinned extension registry before any remote WAM import.
- Prove two WAMs can emit MIDI/automation to each other and reconnect after
  either URL changes.

### Slice B: Note and ModulationTarget

- Mirror event edges into Note mappings.
- Pass full target parameter info to registered modulation delegates.
- Ship a one-target lock policy and surface locked parameters in settings.
- Test with the author's sampler/piano-roll and randomizer/envelope examples.

### Slice C: Asset

- Write the asset URI/export decision first.
- Add a reusable VFS picker and scoped async request coordinator.
- Integrate load/save/list collection and relinking/export behavior.

### Slice D: Video spike, then decision

- Prototype the separate-context bridge first because it has the smallest
  blast radius.
- Measure it before choosing between a bridge, worker proxy, main-thread render
  move, or explicit non-support.

## Compatibility and test matrix

The first implementation should pin
`boourns/wam-extensions@7dde855bbdc92712a2c827b037a03e0261d3c477`
or vendor the small TypeScript classes. Do not load the extension contract from
a mutable remote URL. The global must preserve unrelated keys if a plugin has
already initialized `window.WAMExtensions`.

For every extension, test:

- extension global exists before module evaluation;
- two instances of the same WAM have independent instance IDs and state;
- URL replacement removes old delegates/mappings/locks;
- a stale asynchronous callback cannot affect a replacement instance;
- deletion removes every global map entry and event connection;
- a plugin without the extension still behaves as an ordinary WAM; and
- a throwing or malformed remote delegate is contained and reported.

For release confidence, keep a small pinned fixture set in automated browser
tests. I do not know how many current community-registry WAMs use these
extensions or whether they all implement revision `7dde855`; the official page
says only that a few examples exist. Registry-wide compatibility must therefore
be measured, not assumed.

## Primary sources

- [WAM extensions overview](https://www.webaudiomodules.com/docs/usage/extensions/).
- [`boourns/wam-extensions` at `7dde855`](https://github.com/boourns/wam-extensions/tree/7dde855bbdc92712a2c827b037a03e0261d3c477).
- [WAM core API at `ea39fcc`](https://github.com/webaudiomodules/api/tree/ea39fccecc57db352980ac36bcd7ea8ae4de25e0).
- [Extension author's example WAMs at `3086951`](https://github.com/boourns/burns-audio-wam/tree/30869512b1efe5743576cb43e124f62c14b43018).
- Patchies files linked inline, especially
  [`WamAudioNode.ts`](../../ui/src/objects/wam~/WamAudioNode.ts),
  [`AudioService.ts`](../../ui/src/lib/audio/v2/AudioService.ts),
  [`GLSystem.ts`](../../ui/src/lib/canvas/GLSystem.ts), and
  [`VirtualFilesystem.ts`](../../ui/src/lib/vfs/VirtualFilesystem.ts).
