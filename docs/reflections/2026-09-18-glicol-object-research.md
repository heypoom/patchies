# Glicol Object Feasibility Research (2026-09-18)

## Question

How difficult would it be to add a `glicol` object to Patchies with a full code
editor, similar in product shape to the existing Strudel/compiled-audio editor
nodes? How much more would it cost to reproduce the complete `glicol.org`
experience?

## Recommendation

Build it, but start with a two-to-four-day technical spike and plan to own a
small Glicol browser wrapper.

The useful Patchies product is feasible: a Glicol DSL editor with run/stop,
structured errors, an optional audio inlet, a stereo audio outlet, message
control, sample loading, and Patchies' expanded/sidebar editor layouts. The Rust
engine already runs in a browser AudioWorklet and its JavaScript API accepts an
existing `AudioContext` plus an explicit output destination. Patchies already
has the shared audio runtime, code-editor UI, audio graph routing, and required
cross-origin-isolation headers.

The published `glicol@0.4.0` wrapper should not be integrated unchanged. It is
over three years old, has shared-context and lifecycle behavior that conflicts
with Patchies, and contains several source-confirmed multi-instance and
long-editor risks. A thin Patchies-owned wrapper, based on the upstream MIT
sources and keeping the engine/WASM unchanged initially, is lower risk than
building around those behaviors and then trying to contain them.

Do not define the first version as “all of `glicol.org` inside a node.” The site
also includes Hydra visuals, time/frequency visualizers, sample drop handling,
console-based reference help, guides/demos, and decentralized Yjs collaboration
with a group “be-ready” protocol. Those are application features, not an
exported editor component. The official repository describes these features but
does not contain a reusable full-site editor package; its `js/main.js` is a
minimal CodeMirror 5 demo around global Glicol functions.

## Difficulty and estimate

These are elapsed engineering estimates for someone already familiar with
Patchies. They are ranges, not commitments; the spike decides whether the lower
or upper end is realistic.

| Tier | Scope | Estimate | Difficulty |
| --- | --- | ---: | --- |
| Technical spike | Package/build proof, shared-context-safe wrapper, two simultaneous instances, long-code test, run/stop/destroy/recreate, basic audio routing | 2–4 engineer-days | Medium |
| MVP editor/runtime | Runtime-managed `AudioNodeV2`, Patchies editor, run/stop and message inlet, stereo outlet, line errors, persistence/undo, docs/schema/prompt/registry wiring, focused tests | 1.5–2.5 weeks | Medium–high |
| Polished Patchies editor | VFS sample loading/drop, transport/BPM sync, settings, console/help, syntax highlighting/completions, Safari fallback, lifecycle/performance hardening, offline assets | 3–6 weeks total | High |
| Full `glicol.org` parity | Hydra integration, visualizers, interactive guides/demos, collaborative Yjs/WebRTC editing and ready protocol, site-specific shortcuts and sample UX | 8–12+ weeks total | Very high and probably the wrong boundary |

The core audio object is closer to `chuck~` architecturally than to the current
Strudel integration. Strudel is UI-owned and reroutes a global destination gain
after evaluation (`ui/src/lib/components/StrudelEditor.svelte:54-159`). Glicol
already exposes an `AudioWorkletNode`, so it should be a runtime-managed
`AudioNodeV2` whose Svelte component is only a view/controller.

## What Glicol provides

### Engine architecture

Glicol is a Rust workspace with separate parser, synthesis, main-engine, and
WASM crates (`rs/Cargo.toml:1-31`). The browser package puts the compiled WASM
inside an `AudioWorkletProcessor`; the worklet instantiates WASM, supplies the
worklet sample rate and a random seed, accepts code/control/sample messages, and
writes a two-channel output buffer (`js/npm/glicol-engine.js:24-178`). The Rust
engine owns the parsed AST and graph and computes graph changes when code is
updated (`rs/main/src/lib.rs:34-75,163-212`).

The main public JavaScript surface is small:

- constructor options: `audioContext`, `isLiveCoding`, `loadSamples`,
  `connectTo`, and `onLoaded` (`js/npm/index.js:20-27`);
- `run(code)` and `stop()` (`js/npm/index.js:163-177,226-228`);
- lightweight parameter messages through `sendMsg(msg)`
  (`js/npm/index.js:179-193`);
- `setBPM()` and `liveCodingMode()` (`js/npm/index.js:195-205`);
- sample loading by URL, picker, or decoded data
  (`js/npm/index.js:235-362`).

The official docs confirm that an application may supply its own `AudioContext`
and `connectTo` node, and that repeated `run()` calls update the existing graph
rather than blindly replacing every engine node. See [As a Web Audio Node](https://glicol.js.org/node)
and [Glicol DSL](https://glicol.js.org/dsl).

### Editor architecture

There is no packaged “Glicol editor” component. The checked-in demo initializes
CodeMirror 5 over a textarea, adds run/stop/help keybindings, and calls global
`window.run()`/`window.stop()` functions (`js/main.js:1-49`). Its syntax mode is
a set of simple regular expressions (`js/src/glicol-mode.js:1-55`). Patchies
should reuse its own CodeMirror 6 `CodeEditor` and port only the language tokens,
help/completion data, and shortcuts that are valuable.

Patchies already has most of the desired editor shell:

- `CodeEditor.svelte` accepts run, persistence, extensions, and structured
  line-error data (`ui/src/lib/components/CodeEditor.svelte:130-183`), and draws
  error-line tooltips (`ui/src/lib/components/CodeEditor.svelte:46-124`).
- `SimpleDspLayout.svelte` already provides inline, expanded, and sidebar
  editor layouts plus settings and console slots. Its language is currently
  hard-coded to JavaScript, so either that component must accept a language
  prop or Glicol needs a sibling layout (`ui/src/objects/audio-code/SimpleDspLayout.svelte:97-109,170-198`).
- `RuntimeAudioCodeState` already separates persisted code/editor metadata from
  an audio runtime (`ui/src/objects/audio-code/RuntimeAudioCodeState.ts:6-66`).

### Inputs, outputs, and control surface

An MVP can expose:

1. one message inlet for code and commands (`run`, `stop`, `setBpm`, and perhaps
   raw `sendMsg`);
2. one optional signal inlet;
3. one stereo signal outlet;
4. optionally one message outlet for ready/error/status events.

Glicol's AudioWorklet node is created with a stereo output, and the worklet
writes the first and second halves of the output buffer to left and right
channels (`js/npm/index.js:54-70`; `js/npm/glicol-engine.js:172-173`). Although
the node has a Web Audio input, the published worklet currently copies only
`inputs[0][0]` and explicitly marks stereo/multichannel input as a TODO
(`js/npm/glicol-engine.js:142-149`). The first Patchies version should therefore
label its inlet as mono or omit it until the spike proves an actual DSL use case
for `~input`. It must not advertise stereo processing.

The Glicol docs support custom samples and BPM control, but sample data is loaded
through browser file APIs or remote URLs. A polished Patchies implementation
should load from the Patchies VFS, decode on the main thread, then call an owned
`addSampleFromDataArray` equivalent rather than opening an unmanaged file picker.
See [Samples](https://glicol.js.org/use-samples).

## Why the npm wrapper needs ownership

The npm registry currently publishes only `glicol@0.4.0`; `npm view` reports it
was last modified on 2023-05-20. The upstream repository snapshot used for this
research is commit
[`0317db2e3f157b911bfc28c72ad5db90db963f24`](https://github.com/chaosprint/glicol/commit/0317db2e3f157b911bfc28c72ad5db90db963f24)
from 2025-01-23. The repository itself calls Glicol highly experimental and
warns that the API may change before 1.0
([README lines 187–188](https://github.com/chaosprint/glicol/blob/0317db2e3f157b911bfc28c72ad5db90db963f24/README.md#L187-L188)).

### 1. It suspends Patchies' shared `AudioContext`

The constructor stores the supplied context and immediately calls
`audioContext.suspend()`
([source](https://github.com/chaosprint/glicol/blob/0317db2e3f157b911bfc28c72ad5db90db963f24/js/npm/index.js#L30-L43)).
The URL sample-loading path suspends and later resumes it again
([source](https://github.com/chaosprint/glicol/blob/0317db2e3f157b911bfc28c72ad5db90db963f24/js/npm/index.js#L278-L309)).
Patchies intentionally has one shared context (`ui/src/lib/audio/v2/AudioService.ts:71-77`),
so constructing or loading a Glicol object could silence or resume every audio
object in the patch. A Patchies wrapper must never change context state.

### 2. A second instance can collide on the processor name

Every `Engine` constructor creates a new Blob URL and calls
`audioWorklet.addModule()` (`js/npm/index.js:38-43`), while every such module
unconditionally calls `registerProcessor('glicol-engine', ...)`
(`js/npm/glicol-engine.js:178`). The Web Audio specification requires
`registerProcessor` to throw `NotSupportedError` when that name is already
registered in the context's worklet global scope. See
[Web Audio API, `registerProcessor`](https://www.w3.org/TR/webaudio-1.0/#dom-audioworkletglobalscope-registerprocessor).

Patchies must load/register the processor once per `AudioContext`, then create
multiple `AudioWorkletNode` instances from that registration. The current
worklet instantiates a WASM instance in each processor after receiving `load`,
which suggests independent engines can still work, but this must be proven with
two simultaneous nodes in the spike.

### 3. The fast path is unsafe for full-editor code

On non-Safari browsers where `SharedArrayBuffer` exists, the wrapper creates two
2,048-byte ring buffers for code and parameters (`js/npm/index.js:45-61`). Its
writer only checks whether *some* space is available and `RingBuffer.push()`
copies the minimum of available bytes and input length
(`js/npm/index.js:163-170`; `js/npm/ringbuf.js:92-111`). There is no message
length/framing in `TextParameterWriter`/`TextParameterReader`
(`js/npm/ringbuf.js:7-50`). Code larger than the available space can therefore
be truncated, and rapid writes can be combined or cut at an arbitrary byte.

This matters especially in Patchies: development and deployed builds already
set COOP/COEP headers, so Chromium and Firefox are likely to take this SAB path
(`ui/vite.config.ts:43-55`; `ui/static/_headers:1-3`). The owned wrapper should
start with structured `MessagePort` messages or a framed/resizable queue; do not
inherit the current queue simply because the site describes SAB as the faster
path.

### 4. Lifecycle cleanup is incomplete

The package exposes no `destroy()` method. Its `reset()` method is empty, the
constructor does not retain/revoke its Blob URL, and the wrapper never closes
the worklet port (`js/npm/index.js:38-43,207-213`). `stop()` only runs empty code.
Patchies' runtime explicitly supports async creation and per-node destruction
(`ui/src/lib/audio/v2/interfaces/audio-nodes.ts:60-85,132-137`) and calls a
node-specific `destroy()` when removing or superseding a node
(`ui/src/lib/audio/v2/AudioService.ts:326-402`). Glicol needs to disconnect its
worklet, stop/reset the engine, clear handlers, close the port, and release all
object-owned references without stopping the shared context.

### 5. Error reporting is console-oriented and has a broken path

Worklet errors are sent as an encoded 256-byte buffer
(`js/npm/glicol-engine.js:160-170`; `rs/wasm/src/lib.rs:90-128`). The wrapper
parses them and writes styled browser-console output; it has no structured error
callback (`js/npm/index.js:107-134`). More seriously, normal `run(code)` does not
assign `this.code`, but the parsing-error handler calls `this.code.split(...)`
(`js/npm/index.js:120,163-177`). Invalid DSL submitted through the documented
`run()` path can therefore make the error renderer throw.

The wrapper should decode the engine response into `{ line, column, message }`
and publish it to `CodeEditor`'s `lineErrors` plus Patchies' virtual console. It
should also test the upstream claim that invalid updates leave previous audio
running. The Rust source itself contains a warning that an error can still
update some nodes (`rs/main/src/lib.rs:1`).

### 6. Audio-input allocation needs a soak test

When an input is connected, every worklet render quantum calls the WASM
allocator for a new 128-sample buffer (`js/npm/glicol-engine.js:142-149`). I do
not know whether that allocator reuses or reclaims the memory. This is not proof
of a leak, but it makes a ten-to-thirty-minute connected-input memory/CPU soak
test a required spike item before exposing the inlet.

### 7. Packaging is Vite-specific and repository/published assets differ

The published entry imports `./glicol_wasm.wasm?init`, a Vite-specific asset
query (`js/npm/index.js:2`), converts the imported value to a string, extracts a
URL from it, and fetches the URL (`js/npm/index.js:141-160`). The current
repository checkout contains `glicol_wasm_bg.wasm`, while the published 0.4.0
tarball contains `glicol_wasm.wasm` (2,235,795 bytes). The package has no types,
`exports`, or browser-specific manifest fields (`js/npm/package.json:1-28`).

Patchies already uses Vite WASM and worklet bundling plugins, but compatibility
with current Vite 7 and production/offline builds is unknown. The spike must
build the actual Patchies production artifact, not only run Vite development.

## Proposed Patchies architecture

### Runtime

Create an object-owned `GlicolNode` under `ui/src/objects/glicol/` that:

- implements `AudioNodeV2` and sets `runtimeManaged = true`;
- creates a stable output `GainNode` synchronously so Patchies can connect edges
  before WASM finishes loading;
- loads/registers a Patchies-owned worklet module once for the shared context;
- creates one processor/WASM engine per Glicol object;
- connects only to the stable gain, never to `audioContext.destination`;
- resolves `create()` only after a ready message and ignores or queues commands
  before readiness;
- handles code, stop, BPM, live-coding mode, parameter messages, and decoded
  sample data in `send()`;
- translates engine errors into runtime data for the Svelte view;
- destroys all graph, message-port, event, and WASM-owned resources without
  changing shared context state.

This follows the Patchies lifecycle instead of the current Strudel pattern.
`AudioService` already registers a node before awaiting async `create()`, then
connects pending edges and safely discards superseded nodes
(`ui/src/lib/audio/v2/AudioService.ts:326-380`). The `chuck~` implementation is a
useful precedent for a code-driven engine with a stable gain, lazy library load,
pending audio inputs, message output, and explicit cleanup
(`ui/src/objects/chuck~/ChuckNode.ts:23-77,323-410`).

### View

Create a Glicol Svelte view using Patchies' normal `CodeEditor`, expanded/sidebar
editor targets, virtual console, `CodeEditor` code commits, and settings tracker.
The first version should use plain text plus comments if porting the legacy mode
would delay the spike. Syntax highlighting, completion from `glicol-api.json`,
Alt/Option-D help, and inline numeric controls can follow after the runtime is
proven.

Use the existing object-module wiring rather than special cases:

- Svelte node registry (`ui/src/lib/nodes/node-types.ts`);
- audio registry (`ui/src/lib/audio/v2/nodes/index.ts`);
- defaults, schema, docs, prompt, code-file mapping, object pack, and license
  data;
- headless runtime tests, UI message-path tests, and production bundle checks.

### Samples and transport

Treat samples and transport as second-phase features. Glicol's built-in remote
sample loader is pinned to a jsDelivr path and the package's file picker bypasses
Patchies' VFS (`js/npm/index.js:235-362`). A Patchies-native implementation
should decode VFS assets and transfer the resulting channel data into the
engine. BPM can initially be a setting/message; transport synchronization needs
an explicit product decision about phase and restart behavior rather than merely
copying a numeric BPM.

## Spike exit criteria

Proceed to the MVP only if the spike proves all of these in a Patchies
production build:

1. Creating a Glicol node does not suspend, resume, or otherwise change the
   shared `AudioContext` state.
2. Two Glicol objects can run different programs simultaneously, route to
   different downstream nodes, stop independently, and survive deleting and
   recreating either object.
3. At least a 10 KB program arrives byte-for-byte on both cross-origin-isolated
   and no-SAB/Safari-style paths; rapid consecutive runs do not concatenate or
   truncate messages.
4. Run, stop, invalid-code recovery, and ready/error events are deterministic.
   Invalid code keeps the last valid graph audible if that is the selected
   behavior.
5. Worklet/WASM assets load in development, production preview, deployed/offline
   packaging, and after a service-worker update.
6. A 30-minute two-instance soak does not show unbounded memory or CPU growth.
   Repeat with a connected signal inlet before shipping that inlet.
7. Destroyed nodes release their graph connections and ports and do not receive
   later messages.

If processor registration or package asset loading fails, vendor the small JS
wrapper/worklet and build the WASM asset from the pinned upstream commit. Do not
rewrite the Rust audio engine unless a reduced test proves the engine itself is
the blocker.

## Licensing and maintenance

The Glicol repository and npm package declare MIT
([LICENSE](https://github.com/chaosprint/glicol/blob/0317db2e3f157b911bfc28c72ad5db90db963f24/LICENSE)).
The bundled/customized `ringbuf.js` file declares MPL-2.0 at its header
([source](https://github.com/chaosprint/glicol/blob/0317db2e3f157b911bfc28c72ad5db90db963f24/js/npm/ringbuf.js#L1-L4)).
If Patchies vendors or modifies that file, retain its notice and review the
MPL file-level source obligations. Also add Glicol and any directly distributed
third-party code to Patchies' license data. This is an engineering observation,
not legal advice.

Maintenance risk is more important than license risk. The npm release predates
the latest repository commit by about twenty months, the package has no tests
(`js/npm/package.json:6-8`), and the repository warns that the project and API
are experimental. Pin the exact upstream commit/WASM checksum, keep the wrapper
small, and document how to rebuild and update it.

## Full-site parity is a separate product

The official README lists these `glicol.org` features:

- console quick reference;
- automatic and drag/drop sample loading;
- styled error reporting while previous music continues;
- JavaScript/Hydra visuals;
- declarative/LCS graph updates;
- decentralized Yjs collaboration with a “be-ready” mechanism.

See
[README lines 24–50](https://github.com/chaosprint/glicol/blob/0317db2e3f157b911bfc28c72ad5db90db963f24/README.md#L24-L50).
The deployed site additionally loads the Glicol v0.13.4 browser script and Hydra
as global CDN scripts. These features are tightly coupled to a standalone app
and its global state. Porting all of them into one Patchies node would duplicate
capabilities Patchies already has and introduce a second collaboration model
inside the patch collaboration model.

The sensible boundary is therefore: ship a first-class Glicol audio/editor
object, integrate it with Patchies' VFS, runtime, transport, editor layouts, and
message graph, and let users connect the existing Hydra/visualizer objects when
they want visuals. Revisit shared-code collaboration only as a Patchies-wide
editor feature.

## Primary sources

- [Glicol repository](https://github.com/chaosprint/glicol) at commit
  `0317db2e3f157b911bfc28c72ad5db90db963f24`, cloned locally under
  `.references/glicol`.
- [Glicol web app](https://glicol.org/).
- [Glicol.js documentation](https://glicol.js.org/), especially
  [DSL updates](https://glicol.js.org/dsl),
  [Web Audio routing](https://glicol.js.org/node), and
  [sample APIs](https://glicol.js.org/use-samples).
- [Published `glicol@0.4.0` package](https://www.npmjs.com/package/glicol),
  verified from the npm registry on 2026-09-18.
- [Web Audio API specification](https://www.w3.org/TR/webaudio-1.0/#dom-audioworkletglobalscope-registerprocessor).
- Patchies source paths cited inline above.
