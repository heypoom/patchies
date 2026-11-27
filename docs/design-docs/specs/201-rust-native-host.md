# 201. Rust Native Host

Status: Exploration. Nothing is implemented. This file keeps the context of a
design conversation. It is not a committed plan.

## Idea

A Patchies native host written in Rust runs patches with no browser, no webview,
no Electron, and no Tauri. It is a concrete version of the native player in
[199. Portable Patchies Runtime](199-portable-patchies-runtime.md).

The native host must be built on top of `patchies_core`, an embeddable Rust crate
described in [202. patchies_core](202-patchies-core.md). The standalone native app
is one client of it.

The host provides:

- an embedded JavaScript and TypeScript runtime, so messaging and basic features work;
- audio through web-audio-api-rs, with `AudioWorklet` support in some form;
- video through a native WebGPU implementation.

Patchies' core runs on the host unchanged:

- `@patchies/message`: messaging;
- `@patchies/canvas`: the infinite canvas, with the WebGPU painter;
- `@patchies/renderer`: the WebGPU output renderer;
- `@patchies/audio`: `dsp~` on `AudioWorklet`, and basic Pure Data-style objects
  such as `phasor~`.

## Building Blocks

The host is roughly what Deno already is, Rust plus V8, with Patchies-specific
pieces added.

| Piece                     | Option                                            | Notes                                                                                                                                                          |
| ------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JavaScript and TypeScript | `deno_core`, Deno's embeddable Rust wrapper of V8 | V8 is the realistic engine to embed. Bun and Node are not designed to be embedded in another program. Deno is in maintenance mode; see JavaScript Engine Risk. |
| WebGPU                    | Dawn or wgpu-native                               | Both implement `webgpu.h`, so the host binds one C interface and can switch engines.                                                                           |
| Audio                     | web-audio-api-rs, in-process                      | The host calls it directly from Rust, with no Node bridge.                                                                                                     |
| Windows and input         | winit                                             |                                                                                                                                                                |
| Text                      | cosmic-text or swash                              | Replaces Canvas 2D `fillText` for the text atlas.                                                                                                              |
| Images and video          | the `image` crate; ffmpeg later                   | Video decoding can wait.                                                                                                                                       |

### Dawn or wgpu

| Engine      | Matches       | JavaScript bindings                        | WGSL compiler |
| ----------- | ------------- | ------------------------------------------ | ------------- |
| Dawn        | Chrome        | written by the host                        | Tint          |
| wgpu-native | Firefox, Deno | `deno_webgpu` provides them, built on wgpu | Naga          |

Dawn gives shaders the same validation as Patchies in Chrome. wgpu gets the host
running sooner. Binding through `webgpu.h` keeps the choice open.

`deno_webgpu` is part of Deno, which is in maintenance mode, so its free
JavaScript bindings now come with maintenance in doubt. That strengthens the case
for Dawn, which Google maintains as part of Chrome.

## JavaScript Engine Risk

The host embeds V8 through `deno_core`. In
[denoland/deno#37030](https://github.com/denoland/deno/issues/37030), opened
October 15, 2026, a Deno maintainer announced that Deno is moving to maintenance
mode after the company joins Cloudflare:

- 2.9.x LTS releases with bug and security fixes until October 2027;
- no new feature work, and feature pull requests closed without merging;
- no decision for after October 2027, with work on moving Deno into a foundation
  and a community fork being coordinated.

The issue does not mention `deno_core` or `rusty_v8`, its V8 bindings. Both are
maintained by the Deno team. As of November 27, 2026:

- `deno_core` was moved into the main `denoland/deno` repository. Its own repository
  was archived on February 27, 2026, so `deno_core` falls under the maintenance plan.
- `rusty_v8` (`denoland/rusty_v8`, MIT) is still active but slowing. Its latest
  release is v152.2.0 from August 20, 2026. It has had 2 commits since the
  announcement: a V8 roll on November 17 and an isolate-handle fix on October 21.

The expensive part of embedding V8 is keeping up with V8 releases and security
fixes, which is the work a maintenance-mode project may slow down.

| Option                         | Trade-off                                                                                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deno_core`                    | Fastest start. Maintained at least through October 2027, possibly longer through a foundation or a fork. MIT, so forkable. Risk: falling behind on V8 updates. |
| `rusty_v8` directly            | Fewer layers, but the same organization, the same risk, and more work.                                                                                         |
| Node's embedding API (libnode) | Backed by the Node.js project. Harder to embed from Rust, and heavier.                                                                                         |
| QuickJS through `rquickjs`     | Small and simple to embed, but no JIT, so user `js` runs much slower. Possibly fine for message logic, not heavy work.                                         |
| JavaScriptCore                 | Maintained by Apple and WebKit, and used by Bun. Awkward to embed outside Apple platforms.                                                                     |

The plan:

- Keep `deno_core` for the spike and early versions.
- Keep the engine behind a small interface of host functions, so it can be swapped.
- Revisit the choice when the foundation or fork plans are clearer, well before
  October 2027.

## Host Architectures

Two architectures can run the same Patchies packages natively.

| Architecture               | How                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Rust host embedding V8     | A Rust program embeds V8 through `deno_core` and exposes host functions. The rest of this spec describes it. |
| Node host with Rust addons | Node is the runtime. Native pieces are Node addons written in Rust with napi-rs.                             |

### Node Host With Rust Addons

Node is awkward to embed in Rust: there is no official shared library to link,
its embedding API is C++ with no official Rust wrapper, its libuv event loop must
be merged with the window and audio loops, and `libnode` is tens of MB. Flipping
the relationship avoids all of that. Node is the host, and Rust plugs into it.

| Piece              | As a Node addon                                                 |
| ------------------ | --------------------------------------------------------------- |
| JavaScript runtime | Node itself                                                     |
| WebGPU             | `webgpu` on npm: Dawn's official Node binding                   |
| Audio              | `node-web-audio-api`, a napi-rs addon wrapping web-audio-api-rs |
| Window and input   | a small Rust addon using winit                                  |
| Text               | a Rust addon                                                    |

[dawn-gpu/node-webgpu](https://github.com/dawn-gpu/node-webgpu), published on npm
as `webgpu`, is BSD-3-Clause and actively released: 0.6.0 in August, 0.6.1 in
September, and 0.6.2 on October 2, 2026, with prebuilt binaries for Windows,
Linux, and macOS. Recent commits include Dan Sinclair, who works on Dawn and Tint
at Google. It renders offscreen only, with no window or canvas surface.

Compared with the Rust host:

- **Pros:** Node is backed by the Node.js project and the OpenJS Foundation, so
  the JavaScript engine risk goes away. Dawn and Web Audio bindings already exist.
  User `js` gets npm compatibility. This is avTools' architecture.
- **Cons:**
  - Distribution ships Node plus the addons, packaged with Node's
    single-executable-app support, which is larger than a Rust host.
  - Node's worker threads are not real-time priority, so how `node-web-audio-api`
    runs `AudioWorklet` matters. It is undocumented, so measure it.
  - Windows need the macOS main thread, which Node's event loop also uses.
  - Sandboxing portable `js` is harder. User code can reach the filesystem and
    network unless the host restricts it. In a Rust host, only exposed functions exist.

Given Deno's maintenance status, the Node host is probably the safer native path.
The V2 prototype confirmed it: a Node host with a source-built, patched `dawn.node`
beat Chrome on
CPU and memory (see V2 Prototype under Spike Results). The Rust host embedding V8
remains an option if Node's overhead, size, or sandboxing becomes the problem.

### Binary Size

Binary size matters least of the comparisons. Performance, resource use, and
stability matter more.

Measured on macOS arm64 from the real binaries:

| Piece                                         | Raw          | gzip        | xz          |
| --------------------------------------------- | ------------ | ----------- | ----------- |
| Node.js 22.23.4                               | 113.0 MB     | 36.9 MB     | 23.5 MB     |
| Dawn: `webgpu` 0.6.2 `dawn.node`, arm64 slice | 10.2 MB      | 2.8 MB      | 1.9 MB      |
| `node-web-audio-api` 2.3.0, arm64             | 5.4 MB       | 2.6 MB      | 1.8 MB      |
| **Node host total**                           | **128.6 MB** | **42.3 MB** | **27.2 MB** |

- `dawn.node` ships as a universal macOS binary (21.9 MB). The arm64 slice is 10.2 MB.
- On Windows, Dawn also needs `dxcompiler.dll` (17.1 MB) and `d3dcompiler_47.dll`
  (4.9 MB), about 34 MB for WebGPU.
- Both npm packages bundle every platform's binaries, so a packaged app should
  include only its own platform's files.

Why Node is large: its binary has 33.3 MB of machine code and 41.2 MB of constant
data. The constant data is mostly the full ICU Unicode and locale data, plus Node's
built-in JavaScript and startup snapshot. Node also compiles in OpenSSL, HTTP and
HTTP/2 parsers, undici, libuv, c-ares, SQLite, zlib, brotli, zstd, WASI, and the
inspector. A Node build with reduced or no ICU is smaller.

`deno_core` is roughly V8 plus thin glue, with no TLS, HTTP, filesystem, or
standard library unless the host adds them. ICU data can still move its size by
tens of MB. The full `deno` binary is over 100 MB for the same reasons as Node.

| Host                                           | Raw     | Compressed   | Basis                             |
| ---------------------------------------------- | ------- | ------------ | --------------------------------- |
| Rust host: `deno_core`, wgpu, web-audio-api-rs | 48.0 MB | 12.0–18.3 MB | measured in the native host spike |
| Node host: Node, Dawn, web-audio-api-rs        | ~129 MB | ~27–42 MB    | measured                          |
| Electron 45.5.0                                | 265 MB  | 120 MB       | measured in the native host spike |

### Compared With Electron

Estimates. Spike Results below has the measured numbers:

- **Performance:** the native host presents straight to the OS through Dawn or
  wgpu instead of through Chrome's compositor, which cost 25–40% of a core at
  120 Hz in the spikes. WebGPU calls go directly to the driver instead of being
  serialized to Chrome's GPU process. JavaScript runs at the same speed: it is V8
  either way.
- **GPU memory:** Chrome kept about 6.5–8 full-screen surfaces per WebGPU canvas.
  A native swapchain usually needs 2–3 images, probably a third of the memory or less.
- **RAM:** an idle Electron app typically uses 100–300 MB across its main, renderer,
  and GPU processes. A native host is one process.
- **Stability:** Electron wins. Chromium's GPU code is hardened by billions of users.
  Dawn brings Chrome's driver workarounds, which favors Dawn over wgpu.
  web-audio-api-rs is less proven. Chrome restarts its GPU process after a GPU
  crash, while a single-process host loses everything unless it handles device
  loss carefully and possibly runs audio in a separate process.

### Real-Time Interactivity on a JavaScript Host

Node or Deno with Dawn and web-audio-api-rs can run a real-time interactive app.
The risks are not JavaScript speed. They are garbage collection pauses, frame
pacing, and keeping audio off the JavaScript thread.

- GPU work costs little JavaScript: the spikes stayed under about 0.1–0.9 ms per
  frame at 1,000,000 nodes, through instancing and few calls.
- web-audio-api-rs renders on its own real-time thread. JavaScript only changes
  parameters and schedules events, as in browsers.
- Hit-testing in JavaScript took about 1 µs per lookup at 1,000,000 nodes.

| Risk                           | Why it matters                                                                                                 | Mitigation                                                                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Garbage collection pauses      | Minor collections take about 1 ms. A major collection on a large heap can take 10 ms or more.                  | No per-frame allocation: reuse typed arrays and pool messages. Keep large state native or on the GPU. Measure with a real patch. |
| Frame pacing                   | There is no `requestAnimationFrame`. With vsync, presenting can block, and on Node that blocks the event loop. | Present without blocking, or pace frames from the host.                                                                          |
| Window events on macOS         | Windows need the main thread, which Node's event loop also uses.                                               | Merge the loops, as avTools does.                                                                                                |
| JavaScript on the audio thread | `AudioWorklet` and `dsp~` code is exposed to garbage collection and JIT warm-up.                               | A small separate isolate, or DSP compiled to WASM or written in Rust.                                                            |
| Cost per native call           | Each N-API call costs roughly tens to hundreds of nanoseconds, which adds up in hot loops.                     | Batch: one call per frame with a typed array of changes, or shared memory.                                                       |

Where heavy work runs:

| Work                                                      | Where                                              |
| --------------------------------------------------------- | -------------------------------------------------- |
| Particles, image processing, heavy maths on many elements | GPU compute (POPs, WGSL)                           |
| DSP and synthesis                                         | Rust or WASM on the audio thread                   |
| Video decoding, ML inference, file parsing                | native code through FFI, returning results in bulk |
| Text shaping and atlas rasterizing                        | native, such as cosmic-text                        |
| Patch logic, messages, user `js`                          | JavaScript                                         |

Node's N-API addons through napi-rs are mature. Deno's FFI (`Deno.dlopen`) is fast
and simple, but Deno is in maintenance mode.

### avTools' Dawn Integration

From reading avTools' `packages/native-webgpu` README, validation notes, build
manifest, and build script, not its C++ or Rust sources:

- Dawn is built from source at a pinned commit through `dawn-gpu/node-webgpu` at
  tag v0.6.1, using depot_tools, `gclient`, CMake, Ninja, and a Go toolchain, with
  two local patches. It runs only on Apple Silicon Macs.
- JavaScript reaches Dawn through Node 22.20.0 and `dawn.node`, plus an avTools
  extension for windows, text, and Syphon.
- For TouchDesigner, avTools also builds a C library, `libavtools_runtime.dylib`,
  that embeds V8 and Dawn directly through Dawn's napi_v8 layer, with no Node.
  This is the closest precedent for the Rust host.

Lessons for the native host:

- Native windows need the macOS main thread, and events must be polled.
- Getting a drawable fails while the window is hidden or minimized, while
  offscreen rendering continues. Handle that case.
- The original Dawn Node binding crashed after V8 garbage-collected the object
  owning the GPU. avTools tests forced garbage collection while the device is alive.
- avTools compares rendered frames byte-for-byte against a reference for 15 scenes.
- A short soak test grew memory by about 9 MiB, described as "not leak proof".
  State run lengths with RAM numbers.

Its reported numbers, from short runs on an M1 Max that it says are not guarantees:
publishing three 1080p Syphon streams, Node and Dawn ran at 57 fps with 3.1 ms of
CPU per frame and 4.2 ms latency, against 11 fps, 19.6 ms, and 92 ms for its
earlier Deno route that copied frames through the CPU. Frames should stay on the
GPU with no CPU readback.

## Audio

### web-audio-api-rs

[web-audio-api-rs](https://github.com/orottier/web-audio-api-rs) is a pure Rust,
MIT-licensed implementation of the Web Audio API for non-browser use. It outputs
through cpal (CoreAudio, WASAPI, ALSA, Oboe), with JACK, PipeWire, ASIO, and cubeb
options. IRCAM's [node-web-audio-api](https://github.com/ircam-ismm/node-web-audio-api)
wraps it for Node under BSD-3-Clause and runs the official Web Platform Tests:

- 5,232 subtests pass and 345 fail as of November 23, 2026, about 94%.
- The `AudioWorklet` suite had 259 passes and 41 failures in mid-2024. Its
  threading is not documented.
- Browsers do not fully pass these tests either. A February 2024 snapshot showed
  unexpected results in Chrome for 70 of about 8,300 checks, in Firefox for 565 of
  about 7,700, and in Safari for 110 of about 8,300. That is a different metric
  from the counts above.

Building on web-audio-api-rs, or contributing to it, beats writing a Web Audio
implementation from Chromium and Firefox sources.

### AudioWorklet

The node graph is the solved part. Patchies' audio depends on JavaScript and WASM
running on the real-time thread.

- Run a second, small V8 isolate on the audio thread. web-audio-api-rs's audio
  callback calls each processor's `process()` in that isolate. A small heap keeps
  garbage collection pauses short, the same approach browsers use for
  `AudioWorklet`.
- WASM engines such as ChucK, Csound, SuperSonic, and Strudel's superdough could
  run on the audio thread in V8 or in a WASM runtime such as wasmtime. Their
  Emscripten glue assumes a browser `AudioWorklet`, so each needs adapting.

### WASM as the Portable DSP Format

Compile `dsp~` code and Pure Data-style objects such as `phasor~` to WASM once.
The same WASM runs in the browser's `AudioWorklet` and in the native host, either
in V8 or in a WASM runtime with no garbage collection.

RNBO exports patches as C++. Patchies exports DSP as WASM.

### Comparing Audio With Browsers

Correctness and real-time behavior are tested separately.

**Correctness** uses `OfflineAudioContext`, which renders a graph to a buffer as
fast as possible. The same graph rendered in Chrome and in the host gives two
sample arrays to compare, like a pixel diff:

- maximum sample difference and signal-to-noise ratio, for nodes that should
  match closely, such as gain, delay, and mixing;
- spectrum comparison, for nodes where implementations legitimately differ.

Implementations differ by design in several places:

- oscillator band-limiting;
- interpolation when resampling for `playbackRate`;
- `DynamicsCompressorNode`, where browsers differ noticeably;
- HRTF panning, where each implementation uses its own measured dataset;
- convolver latency and FFT partitioning;
- SIMD rounding and denormal handling.

The target is the spread between browsers: the host's distance from Chrome should
be no larger than Firefox's distance from Chrome.

**Real-time behavior** is measured on the running host:

- missed deadlines (underruns) under increasing load;
- render time per 128-sample block against the 2.7 ms budget, including the worst case;
- loopback recording through a virtual audio device, such as BlackHole on macOS,
  aligned with the offline render and diffed, so glitches show up as differences;
- scheduling accuracy, by detecting the onsets of clicks scheduled with
  `start(t)` and comparing them with the requested times;
- latency from scheduling a sound to hearing it in the loopback.

A golden corpus of real Patchies patches, rendered offline in Chrome as reference
audio, lets CI compare the host against what Patchies actually needs.

### Browser Sources as Reference

Reading Chromium and Firefox code to understand an algorithm is fine. Copying code
brings its license with it:

- Chromium uses a BSD-style license.
- Firefox uses MPL-2.0, which requires sharing changes to copied files.

Both fit next to an MIT core under the rules in
[200. Patchies V2 Primitives](200-patchies-v2-primitives.md). Track where copied
code came from. This is not legal advice.

## Two Kinds of `js`

The native host splits user JavaScript into two kinds, like Max's `js` object and
its `node.script` object. RNBO supports neither, only its own DSP language.

|                | Portable `js`                                                                                  | Browser `js`                                             |
| -------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Can use        | the Patchies API: messages, timers, audio and video handles, maybe `fetch`                     | everything the browser has, including the DOM and `eval` |
| Runs in        | the native host and the browser                                                                | the browser only                                         |
| Sandboxing     | strong natively: a V8 isolate exposing only the host's functions, like Deno's permission model | none: page privileges                                    |
| Capability tag | none                                                                                           | `requires: ['dom']`                                      |

The browser enforces the portable surface too. If portable `js` in the browser can
reach `window`, authors write browser-only code by accident and patches fail
natively. Portable `js` in the browser runs in a Worker that exposes only the
Patchies API. The existing worker-based JavaScript runner in `ui/src/workers/js`
is already close to this.

## Shared Patchies API

The browser and the native host implement the same Patchies API. The code
executor is already portable: `JSRunner` runs user code with `new Function`,
which exists in every V8 host, and `JSModuleResolver` is pure path logic with its
loader injected. What is not portable is the set of services injected into user
code, most of which call browser APIs directly.

Collect those services into one host-services interface. The browser
implementation is today's code, mostly moved rather than rewritten. The native
host implements the same interface with its own adapters.

| Service                   | Browser today                                                  | Native host                                                    |
| ------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| Timers and frame callback | `window.setTimeout`, `requestAnimationFrame`                   | `globalThis` timers and the host's frame loop                  |
| `clock` and the transport | `AudioContext.currentTime`, `performance.now`, Tone.js upgrade | the native audio clock                                         |
| `fft` and audio analysis  | Web Audio analysis, `null` without `window`                    | web-audio-api-rs's analyser node                               |
| `kv` storage              | IndexedDB and a Svelte store for the patch ID                  | files or SQLite                                                |
| `vfs`                     | object URLs, `fetch` of blob URLs, File System Access API      | the real filesystem                                            |
| `npm:` and URL imports    | dynamic `import()` from `esm.sh` at run time                   | a module loader that fetches URLs, or pre-bundled dependencies |
| `llm`                     | `fetch` and the `@google/genai` SDK                            | `fetch`, with an adapter for API key storage                   |
| Bundling                  | `@rollup/browser` (WASM)                                       | the same WASM, or code bundled in the browser                  |
| Render module sync        | `GLSystem`, guarded by `typeof window`                         | the native renderer's module registry                          |

The trickiest services:

- `npm:` imports through esm.sh. Node does not import from `https` URLs natively,
  and esm.sh serves builds for browsers. Pre-bundling or caching dependencies per
  patch also makes patches work offline.
- `fft`, `clock`, and Tone.js depend on web-audio-api-rs behaving like a browser
  `AudioContext`.
- Main-thread `js` runs in the page and can reach `window` and `document`, so it
  is browser `js` in practice. Worker `js` is the closest to portable `js`, but it
  does not yet restrict its globals.

## Object Support

### Capabilities and Placeholders

Each object declares the capabilities it requires, such as `requires: ['dom']`,
`['webgl']`, `['web-speech']`, or `['apple-ml']`. Each host declares the
capabilities it provides. An object loads when its host provides everything it
requires. Capabilities keep the set of supported objects accurate as objects are
ported: once Hydra drops its `webgl` requirement, it appears on the native host.

The native editor starts with a small set of objects, such as `button`, `slider`,
and `js`, and grows as objects are ported.

An object a host cannot run loads as a placeholder:

- It keeps the node's full data and connections untouched, so opening and saving
  a patch on the native host never strips a node the browser needs.
- It shows the object's name, the reason it cannot run here, such as "needs the
  DOM" or "browser only for now", and its ports, so cables still attach.
- Executing it reports an error instead of running.

Placeholders work in both directions. Native-only objects load as placeholders in
the browser the same way.

### Decisions per Object

| Objects                                                     | Native host                                                                                                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dom`, `vue`, `iframe`, browser `js`                        | Placeholder. They need a web engine, which the host rules out.                                                                                          |
| `stt`, `tts` (browser speech APIs)                          | Placeholder. `ai.stt` and `ai.tts` work through web APIs and stay portable.                                                                             |
| `p5`, `canvas.dom`, `three.dom`, `pixi.dom`, `textmode.dom` | Placeholder. Replaced natively by q5, `canvas`, `three`, `pixi`, and `textmode` as they port to WebGPU. `p5` stays the browser's documented slow route. |
| `hydra`, `bchrn`, `regl`, `swgl`, `shaderpark` (WebGL)      | Placeholder until ported to WebGPU. Renderers that cannot be ported to WebGPU are dropped.                                                              |
| `vdo-ninja`, trystero P2P                                   | Browser only for now.                                                                                                                                   |
| `wam~`                                                      | The DSP runs. The plugin GUI never renders.                                                                                                             |
| `mediapipe`                                                 | Not on the native host. The `vision.*` objects get native implementations instead. See Vision Objects.                                                  |
| `strudel`                                                   | Not on the native host.                                                                                                                                 |
| `webcam`, `mic~`, `screen`, MIDI, `serial`, `mqtt`          | Supported through interfaces, implemented natively.                                                                                                     |
| `python`, `peppermint`, `uiua`, `ruby`, `uxn`, `asm`        | Supported. They run as WASM in V8. Pyodide supports Node.                                                                                               |
| `chuck~`, `csound~`, `sonic~`                               | Supported once their worklet glue is adapted.                                                                                                           |
| `video` and file playback                                   | Supported through ffmpeg or OS decoders instead of WebCodecs.                                                                                           |
| AI nodes                                                    | Supported through `fetch`.                                                                                                                              |

### Objects as Interfaces

Objects such as `webcam`, `mic~`, `screen`, MIDI, and `serial` define an interface,
and each host implements it. The browser uses browser APIs. The native host uses
OS APIs such as AVFoundation and ScreenCaptureKit, with OS permission prompts.

An interface object has the same contract in both hosts: the same inlets and
outlets, the same messages, such as choosing a device or setting a resolution,
and the same output type, such as a video texture. How the host captures frames
is its own business. The visual tolerance contract in spec 197 and the audio
comparisons above test these objects on both hosts.

### Vision Objects

The `vision.*` objects use MediaPipe in the browser. MediaPipe does not run on the
native host, so they need native implementations with the same output contract.

Apple's Vision framework provides several of these as built-in features that run
on the Neural Engine and GPU at low power. Core ML is the layer underneath, for
running custom models.

| Object (MediaPipe today)                            | Apple built-in                               | Match with the browser output                                                            |
| --------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `vision.gesture`: 21 hand landmarks, gesture labels | Vision hand pose: 21 joints per hand         | Landmarks match. No gesture labels, so add a small classifier or rules.                  |
| `vision.body`: 33 landmarks, up to 4 people         | Vision body pose: 19 joints in 2D, 17 in 3D  | Different landmark sets, so patches indexing landmarks would break.                      |
| `vision.face`: 478 landmarks, 52 blendshapes        | Vision face landmarks: about 76 points in 2D | Far fewer points. ARKit blendshapes need ARKit with a TrueDepth camera, which Macs lack. |
| `vision.segment`: person mask                       | Vision person segmentation                   | Good match                                                                               |
| `vision.detect`: 90 COCO classes                    | none for general objects                     | Needs a Core ML model, such as a converted YOLO                                          |
| `vision.classify`: 1000 ImageNet classes            | Vision's classifier, with Apple's own labels | Different labels, or run EfficientNet itself through Core ML                             |

Objects as interfaces need the same output in both hosts, which Apple's built-ins
break for body, face, and classify. To keep the contract:

- Run the same MediaPipe models natively, converted to Core ML with `coremltools`
  or run as ONNX, so outputs match exactly. MediaPipe tasks are pipelines, such as
  a face detector, then a landmark model, then tracking and smoothing, so the glue
  must be reimplemented, and some model operations may not convert cleanly.
- Use Apple's built-ins where they already match: hand landmarks and person
  segmentation.

ONNX Runtime keeps vision objects portable. One model file runs with Core ML as its
backend on macOS, which can still use the Neural Engine, DirectML on Windows, and
CUDA on Linux. Pure Core ML or Vision ties the objects to Apple platforms.

Camera frames from AVFoundation arrive as IOSurface-backed buffers. Vision reads
them directly, and Dawn can import IOSurfaces as WebGPU textures, as Chrome does
for video. Frames then stay on the GPU from camera to Vision to WebGPU preview.

### Sharing Frames Between Apps

[Syphon](https://github.com/syphon/syphon-framework) shares GPU frames between
macOS apps through IOSurfaces, with no copies. It has a Metal API with a server to
publish frames and a client to receive them. Dawn runs on Metal on macOS.

**Sending Patchies frames to other apps** is proven: avTools publishes Dawn
WebGPU textures over Syphon with no CPU readback and at most three frames in
flight per channel. It reports three 1080p streams at 57 fps, 3.1 ms of CPU per
frame, and 4.2 ms latency. Its constraints:

- textures must be single-sample RGBA8 or BGRA8 on the same Metal device;
- channels are created on the macOS main thread;
- a `flipped` option gives upright output for receivers such as TouchDesigner.

**Receiving frames from other apps** is feasible, though avTools' notes describe
only publishing. Syphon's client gives a Metal texture backed by an IOSurface,
which Dawn can import as a WebGPU texture. The frame becomes an ordinary `video`
input in the render graph with no copy.

Dawn's IOSurface import is well-trodden because Chrome relies on it. wgpu can wrap
a Metal texture through lower-level interop, but less directly. This favors Dawn.

Object model:

- One interface pair, such as `share.in` and `share.out`, implemented with Syphon
  on macOS and Spout (shared DirectX textures) on Windows. NDI covers sharing over
  a network on every platform.
- Browsers have no Syphon, so these objects declare `requires: ['syphon']` (or the
  matching capability) and load as placeholders in the browser.
- Syphon uses a permissive BSD-style license, which fits the plugin licensing rules
  in spec 200. Verify it before shipping.

## Native Editor

Live code editing is a fundamental requirement of Patchies. Editing Hydra and GLSL
code live in the fullscreen editor must work on the native host too, so code
editing cannot be handed off to an external editor.

### Browser and Native Split

The native host starts with only the fullscreen editing mode, and adds side-of-node
editors later. The browser keeps every editing mode.

|                                         | Browser                                                  | Native host                                          |
| --------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------- |
| Patch canvas, widgets, and object boxes | yes                                                      | yes, with the same display list and controller       |
| Code editing                            | every mode: inline in nodes, detached panels, fullscreen | fullscreen overlay first, side-of-node editors later |
| Panels, menus, settings, object browser | yes, in Svelte                                           | minimal, or edited remotely from the browser         |

The patch canvas and widgets run natively almost unchanged. The WebGPU painter
runs on Dawn or wgpu, winit events become the same controller events, and a native
text library replaces `fillText` for the atlas. Text differs slightly from the
browser, which the visual equivalence contract in spec 197 allows.

### Fullscreen Overlay

The fullscreen overlay draws code over the running visuals, Hydra-style. It suits
the canvas well: the code and the visuals share one GPU canvas, so the text is
another pass over the output, and it needs fewer UI pieces than a full editor.

It needs:

- one canvas-drawn text area, showing one code node at a time;
- a way to switch between code nodes, such as a shortcut that cycles through them
  or picking a node on the canvas;
- the evaluate shortcut (Ctrl+Enter) and error markers;
- readable text over moving visuals, through a translucent backdrop or a text outline;
- the completions popup, since completions are a big part of live coding;
- input method composition, so languages such as Thai work.

It skips panels, sidebars, detached layouts, inline editors inside nodes, and docking.

### Later: Side-of-Node Editors

Editors beside a node use the same component as the fullscreen overlay: the same
CodeMirror state, canvas text view, and completions. They are a later step, not
ruled out. The difference is placement: the fullscreen overlay lives in screen
space alone, while a side-of-node editor lives in the zoomable patch.

| Issue            | Fullscreen overlay               | Editor beside a node                                                                                                         |
| ---------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Zoom             | fixed size, text rasterized once | scales with the patch, so exact text re-rasterizes at every zoom step, with blurrier text during zoom gestures               |
| How many at once | one                              | several, each with its own layout, scroll position, and cursor                                                               |
| Clipping         | the whole screen                 | text and scrolling cut to the editor's box. The display list has no clipping, because it breaks one-draw-per-chunk batching. |
| Overlaps         | nothing on top                   | nodes, cables, and dragged nodes can overlap it, and z-order holds only within a chunk                                       |
| Wheel and drag   | wheel scrolls the code           | wheel scrolls the code or zooms the patch, so it needs a rule such as "scroll when focused, pinch or Ctrl to zoom"           |
| Keyboard         | the editor owns the keyboard     | Delete, arrow keys, and shortcuts go to the focused editor, otherwise to the canvas                                          |
| Focus            | in or out                        | moving between several editors and the canvas                                                                                |

This is integration work, not a different editor: clipping in the display list,
focus management, and zoom-dependent text.

Detached and docked panels are a bigger job. They need window-like UI: dragging,
resizing, docking, tabs, and saved layouts. They stay in the browser unless there
is demand.

### Native UI Approaches

Beyond the fullscreen editor, a native editor needs UI primitives. Ranked from
easy to hard: buttons, toggles, sliders, panels, and tooltips; menus, context
menus, and scrolling lists; per-OS keyboard shortcuts and file drag and drop;
text fields with caret, selection, clipboard, and undo; input methods; accessibility,
for example through AccessKit, which egui uses; and a full code editor.

Many audio-visual tools draw their own UI: TouchDesigner, Max, Ableton Live,
Bitwig, and Blender. Game engines use Dear ImGui, and raylib has raygui. Zed built
GPUI over years to render a code editor on the GPU. Figma draws its canvas with
WebGL but its panels with the DOM.

| Approach                                                    | Trade-off                                                                                                                                       |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Own immediate-mode UI drawn through the display list        | One UI code path for both hosts. A utilitarian look suits a Max-style tool. Text, input methods, and accessibility are entirely Patchies' work. |
| An existing Rust toolkit such as egui, iced, Slint, or GPUI | egui also runs in the browser through WASM. A large move away from Svelte.                                                                      |
| Hybrid                                                      | The browser keeps its Svelte chrome. The native host gets the patch canvas, widgets, object boxes, simple menus, and the fullscreen editor.     |

The hybrid is the starting point. Text fields come first, because object boxes
need them.

### Reusing CodeMirror's State Layer

Only one layer of CodeMirror 6 needs the DOM:

| Layer                                             | Needs the DOM | What it does                                                          |
| ------------------------------------------------- | ------------- | --------------------------------------------------------------------- |
| `@codemirror/state`                               | no            | the document, selections, transactions, and undo history              |
| Lezer parsers and `@codemirror/language`          | no            | incremental parsing, syntax trees, highlighting, folding, indentation |
| commands, search logic, completion and lint logic | mostly no     | editing operations, completion sources, and diagnostics               |
| `@codemirror/view`                                | yes           | drawing text, cursor, and selection, input, input methods, scrolling  |

The native host runs CodeMirror's state, parsers, and commands in its V8, and
replaces only the view with one that draws through the display list.

- Patchies' completion sources, metadata parsing, and lint logic largely carry over.
- Extensions built as view plugins, such as inline value widgets and hover hints,
  need porting to the new view.
- The browser can reuse the same canvas view for its own fullscreen mode, so
  fullscreen editing behaves the same on both hosts.

The canvas view still needs text layout and measurement with a native text
library, cursor and selection drawing, scrolling, the clipboard, and input methods.
winit reports composition events, but the host draws the in-progress composition
itself.

Fallback building blocks, if reusing CodeMirror falls short: cosmic-text's editor,
tree-sitter grammars for JavaScript and GLSL, and ropey for large documents. None
of them brings Patchies' existing completions and metadata support.

## Limits

- **No Canvas 2D.** The Canvas 2D painter does not exist natively, so
  `@patchies/canvas` uses the WebGPU painter only. Memory is less constrained in a
  native desktop app.
- **Different text.** A native text renderer replaces `fillText` for the atlas, so
  labels differ slightly from the browser. The painter contract in
  [197. Canvas Editor and DOM Islands](197-canvas-editor-and-dom-islands.md) is
  visual equivalence, not identical pixels.
- **No DOM islands.** Nodes that need the DOM load as placeholders. See Object
  Support.
- **Fullscreen code editing first.** The native editor supports the fullscreen
  overlay, with side-of-node editors as a later step. Other editing modes, panels, and structural editing stay in the browser,
  which can edit a patch running on the host through the remote editing model in
  spec 199. See Native Editor.

## Costs

- A small runtime to maintain: V8 upgrades through `deno_core`, and Dawn or wgpu
  updates. With Deno in maintenance mode, V8 updates may fall to Patchies or a fork.
- Native binaries per platform, plus code signing and macOS notarization.
- JavaScript bindings for Dawn, if Dawn is chosen.
- Two test targets for every portable object, with the visual tolerance contract
  from spec 197 and the audio comparisons above.

## Open Questions

- Rust host embedding V8, or Node host with Rust addons? The V2 prototype favors
  the Node host with a source-built, patched `dawn.node` (tier B only).
- Dawn or wgpu for the first version? Dawn is favored: it matches Chrome, brings
  Chrome's driver workarounds, and worked in the V2 prototype.
- Which JavaScript engine after October 2027, if Deno's foundation or fork plans
  do not keep `deno_core` maintained?
- Answered: web-audio-api-rs's `AudioWorkletProcessor` trait runs on the render
  thread and drives a V8 isolate there (Spike Results).
- Which Patchies API surface does portable `js` get, and is `fetch` part of it?
- How much of Patchies' CodeMirror setup avoids `@codemirror/view`, and which
  extensions need porting to a canvas view?
- How are WASM DSP modules authored: hand-written, from `dsp~` code, or compiled
  from another language?

## Spike Results

A native host spike built a minimal Rust host with `deno_core` 0.413 (V8 150.4),
wgpu 30 on Metal, winit 0.30, and web-audio-api 1.8 (cpal 0.18), plus an Electron
45.5.0 baseline rendering the same shader and sine. It ran on an Apple M3 Max with
a 3024×1964 display at 120 Hz. Results are in `spikes/native-host/FINDINGS.md` on
branch `claude/native-host-spike-c0d660`, uncommitted.

Most rendering numbers are offscreen or from hidden windows, because windows from
the spike's process were marked occluded while the user worked. CPU while
presenting to a visible window at 120 Hz was not measured. Rendering offscreen is a
lower bound against the earlier Chrome number of 25–40% of a core.

| Metric                                   | Native host (wgpu)                                           | Electron 45.5.0                 | Earlier Chrome spikes         |
| ---------------------------------------- | ------------------------------------------------------------ | ------------------------------- | ----------------------------- |
| Binary or app size                       | 48.0 MB stripped, 18.3 MB gzip, 12.0 MB xz                   | 265 MB, 120 MB zipped           | n/a                           |
| Idle footprint, redraw on demand         | 31–36 MB, one process                                        | 107 MB across 5 processes       | n/a                           |
| Footprint, rendering 2048×1536 at 120 Hz | about 376 MB, of which about 334 MB is Metal driver memory   | about 490–500 MB                | n/a                           |
| Swapchain surfaces at 2048×1536          | 36 MB, 3 drawables, continuous; 24 MB, 2, on demand          | 48–60 MB, 4–5 surfaces (hidden) | about 85 MB, about 7 surfaces |
| CPU, idle on demand                      | 0.2–0.3%                                                     | 1.0%                            | 0%                            |
| CPU, 120 Hz at 2048×1536                 | 5–9% of a core (offscreen)                                   | 26–29%                          | 25–40% (visible)              |
| Startup to first frame                   | about 300–340 ms (visible)                                   | 381–407 ms                      | n/a                           |
| Startup to first audio                   | 129–145 ms                                                   | 409–436 ms                      | n/a                           |
| Audio underruns over 60 s                | 0 with a built-in oscillator; 1 at startup with a JS worklet | not measured                    | n/a                           |

Findings:

- **The expected wins hold where measured.** Rendering costs about a quarter of
  Electron's CPU, idle memory is about a third, swapchain memory is about half of
  Chrome's, first audio arrives about 3× sooner, and the app is about 1/5 the size.
- **Size is almost all V8.** About 38–40 MB of the 48 MB is V8 and `deno_core`,
  including 10.8 MB of ICU data. wgpu is about 1.6 MiB, web-audio-api with cpal
  about 0.5 MiB, and winit about 0.1 MiB. Dawn's prebuilt arm64 Node binding is
  9.97 MB raw and 5.85 MB stripped, so Dawn would add about 4 MB over wgpu.
- **About 320 MB of Metal driver memory** appears in both stacks while frames are
  submitted, and becomes reclaimable a few seconds after rendering stops. A bare
  Swift Metal program shows the same category, so it comes from Apple's driver, not
  wgpu. Redraw on demand matters more for GPU memory than which host is used.
  Without it, the native host uses about 40–55 MB while rendering and Electron about
  170 MB.
- **Occlusion must be handled.** wgpu returns an occluded result immediately, so a
  naive continuous loop burns 95% of a core at 0 fps. Stop requesting redraws on
  winit's occluded event, and skip timeout, outdated, and lost surfaces instead of
  crashing.
- **JavaScript on the audio thread works.** web-audio-api's `AudioWorkletProcessor`
  trait runs `constructor()` and `process()` on the render thread and does not need
  `Send`, so a V8 isolate lives there. A JavaScript processor cost 2.6 µs per
  128-sample block on average and 10–64 µs at worst, against a 2,902 µs budget.
  Creating the isolate took 3.9 ms on the render thread and caused one underrun at
  startup, so build isolates before connecting them.
- **Garbage collection stress was clean.** Over 3,500 forced collections in 30 s
  while rendering and running the worklet caused no crash and no underruns. The GPU
  device is owned by Rust, so the avTools crash cannot happen.
- **Each isolate's thread needs a tokio runtime context,** or the first delayed V8
  task aborts the process.
- **Startup:** opening the audio context takes 120–140 ms on the main thread.
  Opening it on a background thread would bring the first frame to about 200 ms.
  The first launch after each build pays about 800 ms of macOS scanning a new
  unsigned binary.
- **wgpu changes its API between major versions,** which a long-lived host must plan for.
- web-audio-api opened the default device at 44.1 kHz with 6.1 ms output latency,
  and does not expose cpal's device underruns.

Still to measure: CPU while presenting to a visible window at 120 Hz, and Dawn
integrated through a `webgpu.h` build.

### V2 Prototype: Node Host With Dawn

An overnight prototype ran one playable patch from identical TypeScript in Chrome
and in a native Node host: a toggle driving a metro, a bang, an oscillator, and a
gain to the output, with a live scope, and a slider driving a WGSL shader shown as
a node preview and as the full-screen output behind the editor, in one canvas.
Audio was silent all night. Results are in `spikes/v2-prototype/FINDINGS.md` on
branch `claude/native-host-spike-c0d660`, uncommitted. It ran on an M3 Max at
120 Hz, with a 2048×1536 backing size natively and about 2048×1420 in Chrome.

Native tiers:

- **Tier B is the native host:** `dawn.node` built from source
  (`dawn-gpu/node-webgpu` v0.6.2) with a small patch of about 100 lines adding
  `createSurfaceContext(device, metalLayer, w, h)`. It hands JavaScript real
  `GPUTexture`s from Dawn's swapchain on the window's `CAMetalLayer`, so the
  unchanged painter draws into them. Fetching took about 3 minutes and building
  about 1.5 minutes, with 6.3 GB of source. The patch was written from scratch,
  because avTools has no license file. It looks upstreamable as an opt-in native
  surface entry point.
- **Tier A was removed:** stock `dawn.node` from npm exposes no presentation API,
  so frames were copied through the CPU into a second device each frame, about
  12.6 MB per frame with 5–12 ms of latency, at almost three times tier B's CPU.
  Poom chose tier B only, so there is no prebuilt fallback. Its code was removed
  from the prototype (commit `765b36189`), along with the wgpu presenter, which
  shrank the window addon from 6.7 MB to 1.5 MB. Its numbers below are kept as
  history.

| At 120 Hz, patch playing, window visible | Native tier B                         | Native tier A  | Google Chrome 157          |
| ---------------------------------------- | ------------------------------------- | -------------- | -------------------------- |
| CPU                                      | 15.4–15.7%                            | 42.9%          | 32.9–38.6%                 |
| Footprint while playing                  | 478 MB                                | 590–609 MB     | 698–723 MB                 |
| Swapchain surfaces                       | 36 MB                                 | 36 MB          | 68–84 MB                   |
| Footprint while idle                     | 110–122 MB                            | 160 MB         | 455–474 MB                 |
| CPU while idle                           | 2.6–4.3%                              | 2.4–4.1%       | 2.0–2.5%                   |
| 1M buttons zoomed out                    | 118 fps, 16.7%                        | 120 fps, 45.4% | 120 fps, 37.7–37.9%        |
| Adding 1M buttons                        | 1.8 s                                 | 1.8 s          | 1.0 s                      |
| Startup to first frame                   | 380–450 ms from process start         | same           | 150–250 ms from navigation |
| Audio underruns over 60 s                | 0, peak load 1–3%                     | not run        | not measured               |
| Size on disk                             | about 130 MB, of which Node is 108 MB | same           | 56 KB browser bundle       |

About 340 MB of the native footprint while playing is Apple's Metal driver memory,
which every Metal process pays. Native runs used an always-on-top window, and only
runs recorded as visible count.

Gaps in `dawn.node`:

- No presentation API: no surface or canvas context in JavaScript.
- A garbage collection crash: if the JavaScript `GPU` object is collected, a
  scheduled `ProcessEvents()` runs on the freed instance. The host keeps the GPU,
  adapter, and device alive for the life of the process.
- Dawn keeps presenting into a covered window at about 110 fps, where wgpu reports
  occlusion. The host must throttle on occlusion itself.
- Swapchain textures cannot be read back, so snapshots render a frame offscreen.

Node and winit on the macOS main thread:

- `pump_app_events` polled every 8 ms from a `setInterval` works, and is most of
  the idle CPU. An event-driven wake from the native run loop would remove it.
- Node has no vsync signal. Frames run on a 120 Hz `setTimeout` grid, and Dawn's
  `GetCurrentTexture` blocks for 3–5 ms waiting for a drawable. A display link in
  the addon that wakes JavaScript would fix both.
- Staging texture writes before acquiring a drawable leaked about 12 MB per frame
  while the window was covered, because the writes waited for a submit that never came.
- The host must never take keyboard focus from a person using the machine.

Conclusion: a Node host with a source-built, lightly patched `dawn.node` is viable
now. It beats Chrome on CPU, memory, and swapchain memory while running the exact
browser TypeScript with real WebGPU and Web Audio APIs. Its cost is size, about
130 MB against 48 MB for the Rust host. Stock `dawn.node` is not enough, so the host
depends on building and maintaining its own `dawn.node`. Next steps:
upstream or maintain the surface patch, replace event polling with an event-driven
wake, and add a display-link frame clock.

## Related Specs

- [198. WebGPU Render Core](198-webgpu-render-core.md): the renderer the host runs.
- [199. Portable Patchies Runtime](199-portable-patchies-runtime.md): host adapters,
  capability tags, and why native audio is hard.
- [200. Patchies V2 Primitives](200-patchies-v2-primitives.md): the packages the
  host runs.
- [202. patchies_core](202-patchies-core.md): the embeddable crate the host is
  built on.

## Suggested Order

1. Embed `deno_core` and run message-only patches through the headless runtime.
   Add capability tags and placeholders, starting with `button`, `slider`, and `js`.
2. Add WebGPU through `webgpu.h` and render one `wgsl` node to a winit window.
3. Add web-audio-api-rs for built-in nodes, then a V8 isolate on the audio thread
   for `AudioWorklet`.
4. Run one WASM DSP module in both the browser and the host, and compare their
   offline renders.
5. Add `@patchies/canvas` with the WebGPU painter and a native text renderer.
6. Add the fullscreen code overlay: CodeMirror's state layer with a canvas view,
   evaluate, error markers, completions, and input methods.
7. Later, add side-of-node editors: clipping in the display list, focus management,
   and zoom-dependent text.
