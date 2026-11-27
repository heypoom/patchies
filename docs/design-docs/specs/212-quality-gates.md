# 212. Quality Gates

Status: Exploration. This spec sets the hard criteria a change must pass so that no
feature makes Patchies V2 worse. It expands the performance budgets layer of
[208](208-v2-testing-strategy.md#test-layers). Nothing here is implemented.

## Problem

A feature can work and still make the app worse: a larger bundle, a slower start, a
dropped frame while dragging, memory that never comes back. Each regression is
small, and together they add up. V2 is meant to be stable for live performance
([207](207-v2-architecture-invariants.md#live-performance-stable)), so these need
hard gates, not judgment calls.

## Principles

- **Gate on frame cost, not only frame rate.** At 120 Hz, a frame that takes 2 ms
  and one that takes 7 ms both show 120 fps. Frame rate drops only once the headroom
  is gone. Gates track milliseconds of work per frame on each thread, and use frame
  rate to catch dropped frames.
- **Percentiles and the worst frame, not averages.** An average of 118 fps can hide
  a 200 ms freeze every ten seconds.
- **Counters before timers.** Counters such as submits per frame, bind groups
  created, `writeBuffer` calls, heap bytes per node, and chunks loaded do not drift
  with machine load, and run on any CI runner.
- **Side by side against the base branch.** Back-to-back runs on one Mac drifted by
  up to 15 points of CPU in the native host spike. So the base build and the pull
  request build run at the same time on the same machine, and the gate checks the
  difference. Absolute caps are a second line.
- **Fixed reference patches,** checked into the repository: empty, Milestone 0, the
  V2 demo (abstractions, `glsl`, `wgsl`, q5), 1,000,000 buttons, an audio patch, and
  a video-heavy patch.
- **Both hosts,** as for every test layer
  ([208](208-v2-testing-strategy.md#test-layers)).

## The Gates

The numbers below are proposals, starting from what the spikes measured on an M3
Max at 120 Hz. Each becomes a budget once a real V2 build sets a baseline.

### Load Size

| Measure                                                       | Gate                                                                                                                               |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| JavaScript and WebAssembly loaded for an empty patch, gzipped | an absolute cap, plus a ratchet: no pull request grows it by more than 2 KB without an accepted exception                          |
| What an empty patch must not load                             | q5, `glsl-to-wgsl`, Hydra, audio worklets, CodeMirror language packs. A chunk-graph check fails if any is reachable from the entry |
| Each object's chunk                                           | a budget per object, shown beside its cost tier in the object browser ([210](210-performance-transparency.md))                     |
| Each primitive for embeds                                     | its own cap, so a small embed stays small ([200](200-patchies-v2-primitives.md))                                                   |
| The native app download                                       | a ratchet from the spike's 37.1 MB zip                                                                                             |

### Time to Interactive

The clock starts when the entry module begins to run, so it excludes the network.
It stops at a `patchies:interactive` mark, set when the first frame is presented,
the scheduler has ticked, and the editor has handled a synthetic pointer event.

| Patch      | Measured in the spike                                    | Gate                                                                                 |
| ---------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Empty      | 156–176 ms in Chrome, from navigation                    | at most 150 ms from the entry module                                                 |
| V2 demo    | 209–254 ms in Chrome, 359–385 ms native                  | at most 300 ms in the browser, 400 ms native                                         |
| 1M buttons | the add spread over 96 frames, 1.28 s, longest gap 33 ms | interactive within 200 ms, the rest added in the background, no frame gap over 33 ms |

Each object that loads lazily reports its own time, such as q5's first frame or a
shader's first compile, so one slow object cannot hide in a patch total.

### Frame Time

Scenarios at 120 Hz: the patch running still, dragging a node, panning, a slider
drag, 1M buttons zoomed out, and the demo with q5 running.

| Measure                     | Gate                                                                                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Average frame rate          | at least 115 fps                                                                                                |
| p99 frame interval          | at most 12.5 ms, one and a half vsyncs                                                                          |
| Worst frame over a 60 s run | at most 25 ms                                                                                                   |
| Missed vsyncs               | at most 0.5% of frames                                                                                          |
| Work per frame, per thread  | side by side against the base branch: fails if the median grows by more than 10% or 0.3 ms, whichever is larger |

The threads are the UI thread, the render worker, and the audio thread
([198](198-webgpu-render-core.md#threads)).

### Idle Cost

- **A patch where nothing animates uses about 0% CPU and presents no frames.** The
  editor renders only when something changes.
- **An animated patch is compared side by side:** a pull request fails if it adds 2
  or more points of CPU. For scale, the device facade for q5 saved about 8.5 points
  natively ([198](198-webgpu-render-core.md#libraries-that-share-the-device)).

### GPU Discipline

Counters, deterministic and cheap, so they run on every commit:

- one submit per frame, including libraries that share the device;
- no bind groups or pipelines created in a steady frame;
- a `writeBuffer` budget per reference patch;
- on the native host, no GPU promise left pending every frame, because each one
  keeps `dawn.node`'s poll loop spinning.

### Memory

| Measure                            | Gate                                                                                           |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| Heap per node, headless            | at most 224 B for untouched nodes, the lazy-objects result                                     |
| Idle footprint per reference patch | a ratchet                                                                                      |
| Memory returns after undo          | add, switch, and remove nodes, then undo: GPU memory returns to within 10% of where it started |
| Growth during a soak               | no upward trend over an hour, on both hosts                                                    |

The undo check would have caught a finding from the native host spike: GPU memory
stepped from 43.7 MB to 275 MB as the background video node was switched, and
dropped only once.

### Audio

- No xruns during an hour-long soak.
- No xruns under editing load: dragging, adding 1,000 nodes, recompiling a shader.
- On the native host, the audio callback's p99 time stays under its budget.

### Correctness

The test layers and the definition of done in
[208](208-v2-testing-strategy.md#definition-of-done) are gates too, run on the
schedule below.

## When Each Gate Runs

| When               | Where                                                       | Gates                                                                                                |
| ------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Every commit       | any CI runner                                               | load size and the chunk-graph check, GPU counters, heap per node, conformance, SwiftShader snapshots |
| Every pull request | a performance runner: a Mac with a GPU and a 120 Hz display | frame time, time to interactive, and idle cost, side by side against the base branch                 |
| Nightly            | the performance runner                                      | soak, memory after undo, audio xruns, device loss                                                    |
| Before a show      | the performer's machine                                     | the show check ([210](210-performance-transparency.md#show-check))                                   |

## Exceptions and Ratchets

- **A regression can be accepted deliberately.** The pull request states the number
  and why it is worth it, and the budget moves to the new number.
- **Budgets tighten when a gate improves,** so a win is kept rather than spent by the
  next change.
- **No retries.** A noisy timing gate gets more rounds or a wider side-by-side band,
  never a rerun until it passes ([208](208-v2-testing-strategy.md#flakiness-policy)).

## Open Questions

- Where does the performance runner live? A dedicated Mac mini is likely.
- What is the empty-patch size cap? It needs a real V2 build, not a guess.
- How many side-by-side rounds make a timing gate reliable without making pull
  requests slow?
- Which gates also run on a low-end machine, such as an 8 GB laptop, where the GPU
  shares system memory?

## Related Specs

- [198. WebGPU Render Core](198-webgpu-render-core.md): threads, frame budgets, and
  the device facade.
- [200. Patchies V2 Primitives](200-patchies-v2-primitives.md): small embeds.
- [201. Rust Native Host](201-rust-native-host.md): the second host.
- [207. V2 Architecture Invariants](207-v2-architecture-invariants.md): the
  live-performance rule.
- [208. V2 Testing Strategy](208-v2-testing-strategy.md): the test layers and the
  definition of done that these gates extend.
- [210. Performance Transparency](210-performance-transparency.md): cost tiers and
  the show check.
- [211. Hot Path Kernels](211-hot-path-kernels.md): a kernel stays only if these
  budgets show a win.
