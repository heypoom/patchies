# 202. patchies_core

Status: Exploration. Nothing is implemented. This file keeps the context of a
design conversation. It is not a committed plan.

## Poom's Vision

`deno_core` lets any app embed Deno. `patchies_core` should let any app embed
Patchies: its audio output, its video output, and its patches. People should be
able to build their own domain-specific Patchies hosts, or ask Claude to vibe-code
one.

This comes from an interest in indie HCI and unusual interfaces, such as
[Septabee](https://septabee.miraheze.org/wiki/Main_Page). For a custom instrument
or controller, the interface is the interesting part: odd hardware, sensors, and
layouts. A patch is the brain behind it. The precedent is
[libpd](https://github.com/libpd/libpd), which embeds Pure Data anywhere, and
[libpd-wasm](https://github.com/hyrfilm/libpd-wasm), which runs it on the web.

The native host in [201. Rust Native Host](201-rust-native-host.md) must be built
on top of `patchies_core`. The standalone native app is one client of it, the
same way the patchies.app editor is one client of the browser primitives in
[200. Patchies V2 Primitives](200-patchies-v2-primitives.md).

### Open: Which Host Architecture Shapes It

Spec 201 leaves open whether the native host is a Rust program embedding V8 or a
Node host with Rust addons, and the V2 prototype found the Node host with a patched
`dawn.node` viable and faster than Chrome. The choice changes what `patchies_core` is:

| Native host                | What `patchies_core` is                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Rust host embedding V8     | A Rust crate that embeds V8 through `deno_core` and runs the TypeScript core, as this spec describes                  |
| Node host with Rust addons | The `@patchies/core` package running in Node, plus Rust addons through napi-rs for windows, audio, and Dawn's surface |

The embedding API, the libpd-style shape, and the host-driven modes apply either
way. Non-JavaScript hosts, such as Swift or Unity apps, still need a library with an
embedded engine, so a Rust crate stays useful even if the standalone app uses Node.

## Founding Principle: Always a JavaScript Runtime

`patchies_core` always requires a JavaScript runtime. Patchies does not target
resource-constrained devices such as an ESP32.

|                     | Pure Data and RNBO                                   | Patchies                                                                     |
| ------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| Smallest target     | microcontrollers: RNBO exports C++, libpd is small C | anything with a modern JavaScript runtime: desktops, laptops, a Raspberry Pi |
| Editor              | a native app                                         | fully in the browser                                                         |
| Ecosystem           | its own objects and externals                        | the web: Strudel, Hydra, npm, WebGPU, AI APIs                                |
| Core implementation | C, or generated C++                                  | TypeScript, one implementation everywhere                                    |

Patchies loses embeddability on embedded devices. It gains browser-nativeness: the
editor runs fully in the browser, unlike Max and Pure Data, and benefits from the
web ecosystem.

Consequences:

- The core stays TypeScript. `patchies_core` is a Rust shell, a JavaScript engine,
  and the same TypeScript core the browser runs, so the hosts cannot drift apart.
- JavaScript is not optional. There is no reduced core without user `js`.

## Rust, Not C

`patchies_core` is a Rust crate, like `deno_core`. Rust makes the native host
easier and safer to build:

- V8 isolates are not `Send`. Rust's types keep each isolate on its thread,
  including the audio render thread.
- The GPU device, surfaces, and textures have lifetimes that Rust enforces.
- Real-time audio rules, such as no allocation or locking in the render callback,
  are easier to keep in Rust code than in C.
- The native host spike already found traps the type system helps with: each
  isolate's thread needs a tokio runtime context, and the GPU device should be
  owned by Rust, not by a JavaScript object that garbage collection can free.

Hosts written in other languages get bindings over the Rust crate:

- a thin C interface, generated with cbindgen, for C, C++, Unity, and Godot;
- UniFFI-generated bindings for Swift, Kotlin, and Python.

The Rust API is primary. The C interface is a thin, later layer over it.

## Packaging Per Host Type

| Embedding host                                       | How it gets Patchies                                                                                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| A JavaScript host: Node, Deno, Electron, a browser   | Imports the TypeScript core as a package, `@patchies/core`, with native addons for audio and GPU where needed. No second V8: it uses the host's own. |
| A Rust host                                          | Depends on the `patchies_core` crate, which embeds its own JavaScript engine.                                                                        |
| A host in another language: Swift, C++, Unity, Godot | Uses `patchies_core` through the C interface or UniFFI bindings.                                                                                     |

Two V8 instances rarely coexist in one process. Packaging per host type avoids the
clash: `patchies_core` embeds V8 only where the host has no JavaScript engine.

## Embedding API

The shape follows libpd. libpd does not own the audio device or a window. The host
calls a process function with its own buffers. Messages go through named send and
receive hooks. The API is small enough for an agent to build a host around it.

```rust
let mut core = PatchiesCore::new(Config {
    gpu: GpuMode::Shared(device),
    audio: AudioMode::HostDriven { sample_rate: 48_000 },
})?;

let patch = core.load_patch(patch_json)?;

core.send("freq", Message::Float(440.0));
core.on_receive("out", |message| println!("{message:?}"));

// The host drives everything.
core.process_audio(&input, &mut output);
core.render_video(&target_texture);
core.tick(time);
core.input(event);
```

The names are a sketch. The surface is:

- loading and unloading patches;
- sending messages to named receivers and subscribing to named senders;
- host-driven audio, video, clock, and input;
- capability declaration, so objects the host cannot run load as placeholders
  (spec 201).

### Two Modes

- **The host owns the loop.** An embedding app calls `process_audio`,
  `render_video`, and `tick` itself. Audio goes into its own engine, video into its
  own textures, and it feeds input events from its own sensors or hardware.
- **Patchies owns the loop.** `patchies_core` opens its own audio device and drives
  its own frames. The standalone native host uses this mode with its own window.

## What It Contains

| Part              | In `patchies_core`                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| JavaScript engine | V8 through `deno_core`, behind a small interface of host functions so it can be swapped                               |
| TypeScript core   | the headless runtime, messaging, renderer, and audio packages from spec 200                                           |
| WebGPU            | wgpu or Dawn, owned by Rust                                                                                           |
| Audio             | web-audio-api-rs                                                                                                      |
| Host services     | the native implementation of the shared Patchies API from spec 201: timers, clock, `kv`, `vfs`, module loading, `fft` |
| Capabilities      | what this host provides, for object loading and placeholders                                                          |

It does not contain windows, the editor UI, file pickers, or a mandatory audio
device. The standalone native host adds those.

### Host Interfaces Validated

The V2 prototype (spec 201) ran the same TypeScript in Chrome and in a Node host
with Dawn. Its host-services interface, in `packages/core/src/host.ts`, held up:

- timers;
- a frame callback;
- a clock;
- input events;
- a logger;
- an audio context factory.

Without DOM or Node types, core cannot name `console` or `performance`, which
forces logging and clocks through host services.

Text rasterizing and the render target belong to the canvas primitive's own host
interface, not to core:

- `GlyphRasterizer`: Canvas 2D in the browser, fontdue in the native Rust addon.
  fontdue has no subpixel positioning yet, so native text is slightly coarser.
- `RenderTarget`: the browser canvas context, a readback texture, or a Dawn surface.

## Evidence From the Native Host Spike

The native host spike (spec 201) built the same stack: `deno_core` 0.413 with V8
150.4, wgpu 30 on Metal, winit 0.30, and web-audio-api 1.8, on an M3 Max.

- **Size:** 48.0 MB stripped, 12.0 MB xz. About 38–40 MB of it is V8 and `deno_core`,
  including 10.8 MB of ICU data. Dropping ICU, and with it `Intl`, saves about 11 MB.
  wgpu is about 1.6 MiB and web-audio-api with cpal about 0.5 MiB.
- **JavaScript on the audio thread works.** web-audio-api's `AudioWorkletProcessor`
  trait runs `constructor()` and `process()` on the render thread, and the processor
  does not need to be `Send`, so a V8 isolate lives there directly. A JavaScript
  processor cost 2.6 µs per 128-sample block on average and 10–64 µs at worst,
  against a 2,902 µs budget.
- **Build worklet isolates before connecting them.** Creating an isolate took
  3.9 ms on the render thread and caused one underrun at startup. Build it from a
  snapshot or pool, or warm it on another thread. Use one worklet isolate per audio
  context, not per node.
- **The GPU device is owned by Rust,** so the avTools crash, where garbage
  collection freed the device's JavaScript owner, cannot happen. Over 3,500 forced
  garbage collections in 30 s caused no crash and no audio underruns.

## Hard Parts

- **Sharing the GPU device with the host.** `render_video` into the host's texture
  needs no copies only if both use the same WebGPU implementation on the same
  device. Otherwise frames cross through native texture sharing: IOSurfaces or
  Metal textures on macOS, shared DirectX handles on Windows, as Syphon does.
- **Host-driven audio.** `process_audio` needs web-audio-api-rs to render in real
  time into buffers the host provides, not only to its own device. It has offline
  rendering and a mode with no output device. Whether it supports this pull style in
  real time needs checking.
- **iOS.** Apple does not allow third-party apps to generate machine code at
  runtime, which V8's JIT needs. Use V8 in jitless mode, which runs JavaScript much
  slower, or JavaScriptCore, which Apple allows. The swappable engine interface
  makes this possible. Desktops, Android, and a Raspberry Pi are fine.
- **The JavaScript engine's future.** `deno_core` is in maintenance mode (spec 201).
  The engine interface keeps it replaceable.
- **API stability.** The Rust API, and later the C interface, become a promise as
  soon as other apps embed them.

## Open Questions

- Can web-audio-api-rs render host-provided buffers in real time, or does
  `patchies_core` need its own audio graph driver?
- Which WebGPU implementation does `GpuMode::Shared` accept: wgpu devices, Dawn
  devices, or both through `webgpu.h`?
- How small can the TypeScript core and its startup snapshot get for embedding?
- Does the C interface ship in the first version, or only the Rust crate?

## Related Specs

- [169. Build Your Own Patcher Vision](169-build-your-own-patcher-vision.md) and
  [170. Agent-Extensible Patchies Vision](170-agent-extensible-patchies-vision.md):
  custom hosts and agent-built extensions.
- [199. Portable Patchies Runtime](199-portable-patchies-runtime.md): host adapters
  and capability tags.
- [200. Patchies V2 Primitives](200-patchies-v2-primitives.md): the TypeScript
  packages `patchies_core` runs.
- [201. Rust Native Host](201-rust-native-host.md): the standalone native host,
  built on `patchies_core`.

## Suggested Order

1. Turn the native host spike into a `patchies_core` crate with a minimal
   `PatchiesCore` type: load a patch, send and receive messages, and run in the
   "Patchies owns the loop" mode.
2. Rebuild the standalone native host as a thin client of the crate.
3. Add host-driven audio and video, and test them from a small example host.
4. Ask Claude to build a domain-specific host, such as a custom controller app,
   from the crate's documentation alone, to test whether the API is small enough.
5. Add the C interface and UniFFI bindings.
