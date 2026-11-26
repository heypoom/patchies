# 199. Portable Patchies Runtime

Status: Exploration. Nothing is implemented. This file keeps the context of a
design conversation. It is not a committed plan.

## Idea

Run Patchies patches outside the browser, the way
[RNBO](https://cycling74.com/products/rnbo) runs a subset of Max anywhere.

- The Patchies core is portable JavaScript.
- A browser adapter provides browser capabilities. Some nodes work only in the
  browser because they need the DOM.
- Other hosts, such as a Deno or Node player, run the portable part of a patch.

The common core targets any modern JavaScript runtime.

## Prior Art

- **Deno desktop WebGPU** ([docs](https://docs.deno.com/runtime/desktop/webgpu)):
  WebGPU rendering in a native window with no web engine. It needs Deno 2.9 or
  later, `"unstable": ["webgpu"]` in `deno.json`, and the `raw` desktop backend.
  A native window gives a canvas-like context with `configure()`,
  `getCurrentTexture()`, and `present()`. There is no DOM and no
  `requestAnimationFrame`, so frames are scheduled manually.
- **avTools** ([repo](https://github.com/AvneeshSarwate/avTools)): Avneesh
  Sarwate's audiovisual toolkit. It shares timing and WebGPU/WGSL rendering
  across hosts through adapters, and has a common browser and native MIDI API.
- **avTools native-webgpu**
  ([package](https://github.com/AvneeshSarwate/avTools/tree/main/packages/native-webgpu)):
  p5-style rendering (`background()`, `fill()`, `text()`) on Node 22 with Dawn,
  Rust text rendering, winit windows, and Syphon output. A Deno wrapper remains
  available. Validated only on Apple Silicon Macs. Not published to npm.
- **audiojs/web-audio-api** ([repo](https://github.com/audiojs/web-audio-api)):
  a pure JavaScript Web Audio implementation for Node, tested on Deno and Bun.
  Its `AudioWorklet` runs synchronously, with no thread isolation.

## Architecture

```
┌─ Hosts ─────────────────────────────────────────────────────────┐
│  Browser app (full editor)  │  Native player (Deno/Node)  │ ... │
├─ Host adapters ─────────────────────────────────────────────────┤
│  gpu · surface · audio · clock · files · MIDI · input · storage │
├─ Portable core (plain JavaScript) ──────────────────────────────┤
│  patch graph · objects · message routing · scheduler/transport  │
└─────────────────────────────────────────────────────────────────┘
```

### Portable Core

The headless runtime from [40. Headless Patcher System](40-headless-patcher-system.md):
the patch graph, object lifecycles, message routing, and the clock and transport.
Messaging is callbacks, so it already works anywhere. `PatchRuntime` and
`PatchMessageRuntime` are the start of this core.

### Host Adapters

| Capability | Browser                              | Native (Deno or Node)                           |
| ---------- | ------------------------------------ | ----------------------------------------------- |
| GPU        | `navigator.gpu`                      | Deno WebGPU or Dawn                             |
| Surface    | the one editor canvas                | native window, Syphon, Spout, NDI               |
| Audio      | `AudioContext`                       | web-audio-api or a native-backed implementation |
| Files      | VFS ([52](52-virtual-filesystem.md)) | the real filesystem                             |
| MIDI       | Web MIDI                             | native MIDI                                     |
| Input      | DOM events                           | window events                                   |
| Storage    | localStorage and IndexedDB           | files                                           |
| Text       | Canvas 2D                            | a native text library                           |

### Capability Tags

Each object declares the capabilities it needs, such as `requires: ['dom']` or
`requires: ['gpu', 'audio']`. A host runs only objects whose needs it meets.

- Exporting a patch reports objects that only work in the browser, like RNBO
  reports unsupported Max objects.
- The browser can use the same tags to place objects on the main thread or in
  the render worker.

## Object Portability

| Probably portable                             | Needs work                               | Browser-only                                |
| --------------------------------------------- | ---------------------------------------- | ------------------------------------------- |
| Messages, `expr`, metro, sequencer, transport | `glsl` (WASM translator)                 | `dom`, `vue`, `markdown`, `iframe`          |
| `wgsl`, POPs, `q5` in worker mode             | Audio objects                            | `p5`, `canvas.dom`, `three.dom`             |
| AI nodes (they call `fetch`)                  | Video files (no WebCodecs; needs ffmpeg) | Webcam and screen capture                   |
| Serial and DMX, with native adapters          | Strudel and Tone (built on Web Audio)    | MediaPipe (WASM and WebGL), P2P over WebRTC |

## Remote Editing

The full editor stays in the browser, like Max is for RNBO. The native host has
the patch canvas, widgets, object boxes, and a fullscreen code editor, with
side-of-node editors later ([201](201-rust-native-host.md), Native Editor).
Because the headless runtime separates editing from running, a browser editor can
also connect to a native runtime over a WebSocket and edit a patch that is live on
another machine, such as a Mac mini or a Raspberry Pi.

## Convergence With the Other Tracks

The render worker in [198. WebGPU Render Core](198-webgpu-render-core.md) has no
DOM. Anything designed to run there is most of the way to running in Deno or Node.

- WebGPU exists outside the browser through Dawn and wgpu. WebGL2 effectively does
  not. Nodes on the shared WebGPU device are potentially portable. WebGL2 islands
  are browser-only, which is another reason for a Hydra WGSL backend.
- q5's worker mode and native mode are the same work: a q5 with no DOM that renders
  to a provided device and texture. `q5` is portable and `q5.dom` is browser-only.
- The GLSL translator is WASM, which runs in Deno and Node too.
- The canvas editor ([197](197-canvas-editor-and-dom-islands.md)) runs in both
  hosts. Natively it uses the WebGPU painter only, and DOM islands are browser-only
  ([201](201-rust-native-host.md)).

## Native WebGPU Engines

| Runtime      | WebGPU implementation                            | WGSL compiler |
| ------------ | ------------------------------------------------ | ------------- |
| Chrome, Edge | Dawn (C++)                                       | Tint          |
| Firefox      | wgpu (Rust)                                      | Naga          |
| Deno         | wgpu (Rust)                                      | Naga          |
| Safari       | WebKit's own implementation                      | WebKit's own  |
| Node         | not built in; Dawn has Node bindings (dawn.node) | Tint          |

- Dawn implements `webgpu.h`, a C header that maps one-to-one onto the WebGPU IDL.
  Dawn and wgpu both implement it, and Google ships Dawn as a standalone library.
  Chrome runs Dawn in its GPU process, on Metal on macOS, Direct3D 12 on Windows,
  and Vulkan on Linux, Android, and ChromeOS.
- Node with Dawn is the closest match to Chrome: the same engine and the same WGSL
  compiler. avTools' `native-webgpu` uses this setup. Deno matches Firefox instead.
- Prefer Node with Dawn as the first native host, so shaders that work in Patchies
  in Chrome behave the same natively.

## Why Native Audio Is Hard

Audio has a hard deadline. At 48 kHz with 128-sample blocks, the sound card needs
the next block every 2.7 ms. A missed deadline is an audible click. A late video
frame is only a dropped frame.

Meeting that deadline needs a dedicated high-priority real-time thread, and that
thread must never pause for garbage collection, memory allocation, locks, or I/O.

The browser provides this for free:

- built-in Web Audio nodes written in C++;
- `AudioWorklet`, which runs processors on the browser's real-time audio thread;
- one device API over CoreAudio, WASAPI, ALSA, and PipeWire.

Node and Deno have no audio API:

| Option                                                        | Problem                                                                                                                 |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Pure JavaScript Web Audio (`audiojs/web-audio-api`)           | DSP and worklets run on the main event loop with messages, GPU work, and garbage collection.                            |
| JavaScript DSP in a worker thread with a ring buffer          | Worker threads are not real-time priority, and garbage collection still pauses them.                                    |
| Native-backed Web Audio, such as IRCAM's `node-web-audio-api` | The closest match to the browser. It wraps `web-audio-api-rs`, a Rust implementation of the Web Audio spec. Unverified. |
| Own native bindings (cpal, PortAudio, miniaudio)              | Platform-specific native code shipped separately for macOS, Windows, and Linux.                                         |

Unlike WebGPU, Web Audio has no native header. Chrome's Web Audio is built into
Blink and is not packaged as a library. Libraries exist for device I/O, such as
cubeb (used by Firefox), cpal, miniaudio, PortAudio, and RtAudio. No official
library implements the Web Audio graph and `AudioWorklet`.

Patchies depends on browser audio more than most apps:

- Audio V2 is a Web Audio graph plus native DSP worklets
  ([70. Native DSP Worklets](70-native-dsp-worklets.md)).
- ChucK, Csound, SuperSonic, and Strudel's superdough assume a real `AudioWorklet`
  with `SharedArrayBuffer`.
- Scheduling uses `AudioContext.currentTime` with a look-ahead
  ([81. Clock Scheduling API](81-clock-scheduling-api.md)).

Larger buffers hide hiccups but add latency: 1024 samples is about 21 ms, which
feels sluggish for live performance. The browser has years of tuning behind this
balance. Messaging and video come first in a native host because messages have no
real-time deadline and a late video frame is only dropped.

## Deno Maintenance Status

In [denoland/deno#37030](https://github.com/denoland/deno/issues/37030), opened
October 15, 2026, a Deno maintainer announced that Deno's company is joining
Cloudflare and that Deno is moving to maintenance mode:

- monthly 2.9.x LTS releases with bug and security fixes, supported until October 2027;
- no new feature work, and feature pull requests closed without merging;
- canary-only features that landed after 2.9 reverted so the main branch matches 2.9;
- no decision for after October 2027. On October 21 the maintainer said they are
  working on moving Deno into a foundation, with no news yet. A community group is
  coordinating a fork, and Deno is MIT-licensed.

What this means for a portable runtime:

- Deno desktop WebGPU was unstable and behind a flag. It is now unlikely to
  graduate. Do not build on it. A commenter in the issue called `deno desktop`
  experimental with many bugs, and the page has no maintainer answer about its future.
- `deno_webgpu`, Deno's wgpu bindings, carries the same risk.
- Node with Dawn is the safer first native host. Dawn is maintained by Google as
  part of Chrome, and avTools already uses Node with Dawn.

## Hard Parts

- **Audio**: a pure JavaScript Web Audio that runs worklets synchronously, on the
  same thread as GPU work and messages, glitches under load. A native host needs
  audio on its own thread or process. A Rust-backed `node-web-audio-api` from
  IRCAM may run processing on real audio threads. This is unverified.
- **Native WebGPU maturity**: Deno's WebGPU is unstable and Deno is in maintenance
  mode. avTools' Node and Dawn setup is validated only on Apple Silicon. Deno uses
  wgpu while Chrome uses Dawn, so WGSL validation differs.
- **Testing**: every portable object is tested in both hosts.
- **Media**: fonts, image decoding, and video decoding are free in the browser and
  need native libraries elsewhere.
- **No code generation**: RNBO compiles patches to C++, so they run on
  microcontrollers. Patchies ships its JavaScript runtime, so the target needs a
  modern JavaScript runtime. A Raspberry Pi works. An Arduino does not.

## Related Specs

- [200. Patchies V2 Primitives](200-patchies-v2-primitives.md): the portable
  core and renderer as separate packages.
- [201. Rust Native Host](201-rust-native-host.md): a concrete native host in
  Rust with V8, web-audio-api-rs, and Dawn or wgpu.

## Suggested Order

1. Add capability tags to objects. This is useful in the browser too.
2. Build a small `patchies-run patch.json` CLI in Node that runs message-only
   patches through the headless runtime. Prefer Node to Deno while Deno is in
   maintenance mode.
3. Render one `wgsl` node to a native window with Node and Dawn, using the same
   node code as the browser. If this works with no node changes, the portable
   core is proven.
4. Add audio last, after evaluating a native-backed Web Audio such as
   `node-web-audio-api`.
