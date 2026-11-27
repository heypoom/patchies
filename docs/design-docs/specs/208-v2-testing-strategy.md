# 208. V2 Testing Strategy

Status: Exploration. This is the testing approach for Patchies V2, set before V2 is
built. It applies from day one, even though it slows development down.

## Problem

Patchies V1 breaks often, despite careful code and unit tests added later. For
example, `expr~` (`ui/static/content/objects/expr~.md`) seems to be broken by one
of the refactorings. V2 needs serious, automated, black-box testing from day one,
including snapshot and screenshot tests, on the browser host and the native host.

## Tests Drive Patchies Like Agents Do

The canvas editor has no DOM to query, so tests cannot find a button by its label.
Three things V2 builds anyway double as the test harness:

| Built for                                                                                            | Also serves tests as                                                                       |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| The operations protocol ([205](205-agent-integration.md)): create, connect, send, query              | a black-box driver: tests build patches and send messages through the commands agents use  |
| Commands from actors ([207](207-v2-architecture-invariants.md))                                      | a test is another actor, like a human or an agent                                          |
| The canvas controller's nodes, hit regions, and camera ([197](197-canvas-editor-and-dom-islands.md)) | a queryable semantic tree, such as "where is `slider-k3f9` on screen?", instead of the DOM |

The same semantic tree is what screen readers need, for example through AccessKit,
so accessibility and testability share one structure.

Pointer input goes through the controller in patch coordinates, so a test can click
and drag like a person on both hosts.

## Test Layers

| Layer                       | Catches                                | How                                                                                                                                                                                                         |
| --------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Object conformance       | objects silently broken by a refactor  | Each object's definition ships test cases: input messages, expected message output, and offline render checks for audio and video objects.                                                                  |
| 2. Golden message traces    | routing and scheduling regressions     | A recorded patch and input events, compared against the expected message trace ([203](203-patchies-v2-roadmap.md)).                                                                                         |
| 3. Audio snapshots          | DSP changes                            | Offline renders through `OfflineAudioContext` in the browser and web-audio-api-rs natively, compared with tolerances and spectral comparison where implementations differ ([201](201-rust-native-host.md)). |
| 4. Visual snapshots         | rendering and painter regressions      | Offscreen renders at a fixed size, DPR, and time, read back and compared with a tolerance.                                                                                                                  |
| 5. End-to-end on both hosts | features breaking from the user's side | Playwright in the browser. A Node test runner drives the native host through the same protocol.                                                                                                             |
| 6. Performance budgets      | slow regressions                       | The 1,000,000-button benchmark, CPU at 120 Hz, idle cost, and startup, tracked over time and failing over budget.                                                                                           |
| 7. Two hosts per primitive  | host-specific bugs                     | Every primitive runs on both hosts in CI. The V2 prototype's second host caught a real bug.                                                                                                                 |

### Object Conformance

- Every object ships executable test cases with its definition.
- The examples in each object's docs, under `ui/static/content/objects/`, are
  runnable. A broken doc example is a failing test.
- Objects written by coding agents must include conformance cases. In the core and
  shell model ([207](207-v2-architecture-invariants.md)), these cases are the
  guardrail that keeps vibe-coded objects from breaking things.

### Visual Snapshots

Snapshots use the visual equivalence contract measured by the dual-painter spike
([197](197-canvas-editor-and-dom-islands.md)): per node type, a mean per-pixel
difference under 1.5, and under 4% of pixels differing by more than 16. Geometry
positions, text layout, and hit regions must match exactly. Pixel identity is not
the goal, because Chrome's own Canvas 2D raster paths differ from each other.

## Determinism

- **Time:** the clock is a host service (invariant 9 in spec 207), so tests freeze or
  step it, such as `iTime = 2.0` in the GLSL spike.
- **Randomness:** seeded.
- **GPU:** baselines in CI render on SwiftShader, a software renderer that Dawn
  supports, in both Chrome and the native host. That gives the same pixels on any CI
  machine. Real-GPU runs on macOS check performance separately. Verify that headless
  Chrome's WebGPU works with SwiftShader on the chosen CI runners.
- **Windows:** native end-to-end tests use hidden or offscreen windows and never
  take over the screen or keyboard focus. The V2 prototype found that a focused host
  window can receive a person's keystrokes.

## Flakiness Policy

- Tolerances, never retries. A flaky test is fixed or quarantined, not retried until
  it passes.
- Baseline changes are reviewed as images: a pull request that changes a baseline
  shows before, after, and the difference.

## Definition of Done

V2's goal is stability for live performance from the first version
([207](207-v2-architecture-invariants.md#live-performance-stable)), so core and shell
have different bars.

- **Any feature or object:** conformance cases and at least one end-to-end test on
  both hosts.
- **Core systems and core objects** also need:
  - soak tests: the object or system running for hours under load on both hosts, with
    no crashes, leaks, growing memory, or dropped audio;
  - fault tests: bad input, malformed messages, and broken user code, such as a GLSL
    shader that fails to compile or a `js` loop that throws, recover without taking
    down the patch. So does a lost GPU device, forced with `device.destroy()`
    ([198](198-webgpu-render-core.md#device-loss));
  - review by hand. Core code is never vibe-coded.
- **Shell objects** are marked experimental. They need conformance cases, and they
  must be contained: a failing shell object cannot take down the patch.
- An object moves from shell to core only by meeting the core bar.
- The slowdown is accepted deliberately.

## Starting Points

The V2 prototype already has the pieces: offscreen render targets, injected clocks,
a scripted native host, and pixel readback ([203](203-patchies-v2-roadmap.md),
Milestone 0). The GLSL spike's corpus and pixel-diff harness are a model for visual
tests against a reference ([198](198-webgpu-render-core.md)).

## Open Questions

- Which CI runners have a GPU for performance budgets, and which run SwiftShader for
  baselines?
- Where do baseline images live: in the repository, Git LFS, or an artifact store?
- How are object conformance cases written: in the object definition, in its docs,
  or both?
- Do browsers other than Chrome join the matrix, and when?

## Related Specs

- [197. Canvas Editor and DOM Islands](197-canvas-editor-and-dom-islands.md): the
  painter tolerance contract and the controller.
- [201. Rust Native Host](201-rust-native-host.md): comparing audio against browsers.
- [203. Patchies V2 Roadmap](203-patchies-v2-roadmap.md): two hosts per primitive and
  golden traces.
- [205. Agent Integration](205-agent-integration.md): the operations protocol.
- [207. V2 Architecture Invariants](207-v2-architecture-invariants.md): invariant 13.
- [210. Performance Transparency](210-performance-transparency.md): cost tiers per
  object, measured by the performance budget benchmarks.
