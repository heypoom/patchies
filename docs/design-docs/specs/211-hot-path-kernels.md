# 211. Hot Path Kernels

Status: Exploration. This spec sets the rule for when Patchies V2 moves code out of
JavaScript, and lists candidates. Nothing here is implemented.

## The Rule

**The core stays TypeScript.** The message system, the object model, the Patchies
API, and everything that touches user code run as JavaScript on every host
([202](202-patchies-core.md)).

**WebAssembly is only for hot paths:** self-contained work that takes so much CPU
that the cost of crossing between JavaScript and WebAssembly is small in
comparison. A kernel moves only when profiling shows it is hot, never on
speculation.

## Why Not a Rust Core

Figma's renderer is C++. The browser runs it as WebAssembly, and the same code
builds natively for servers, tests, and debugging
([Figma rendering, powered by WebGPU](https://www.figma.com/blog/figma-rendering-powered-by-webgpu)).
That works because Figma's core is the whole product: users do not write code that
runs inside it.

In Patchies, user code is the product. `js`, q5, p5, Hydra, and every experimental
object agents write are JavaScript, and messages are arbitrary JavaScript values
passed between them. A Rust core that routes messages would cross into JavaScript
for nearly every delivery, because most nodes that matter are JavaScript. The
crossing would cost more than the routing saves.

A JavaScript engine stays on every host either way, because user code needs one
(spec 202's founding principle).

## The Cost of Crossing

- **In the browser,** calling WebAssembly from JavaScript with numbers is cheap. The
  cost is converting data: strings, objects, and arrays on each call.
- **On the native host,** calls between Rust and V8, through N-API or `rusty_v8`,
  pay for handles and conversions on each call.

So a kernel's interface follows one pattern:

- **Few, batched calls,** such as one per frame or one per tick, never one per node
  or per message.
- **Shared memory instead of objects.** The kernel reads and writes typed arrays in
  WebAssembly memory, and JavaScript passes views of that memory onward. For
  example, the kernel writes a GPU instance buffer into its memory, and JavaScript
  hands that view to `queue.writeBuffer`.
- **No calls into user code** from inside a kernel.

## Candidates

| Kernel                                                  | Why it may be hot                                                                                                                         | Spec |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Packing display lists into GPU instance buffers         | Very large patches: 1,000,000 nodes, data-oriented, one batch per frame                                                                   | 197  |
| The spatial index, and derived links for spatial worlds | The dense-source case: 100,000 nodes that are all sources made 5 million links, with a 2 s first derive and about 70 ms to move 100 nodes | 209  |
| Layout                                                  | Tight loops over boxes, if editor UI grows flexbox-style layout                                                                           | 197  |
| CRDT document sync                                      | Yrs, the Rust port of Yjs, already has WebAssembly bindings, if Yjs becomes a bottleneck on large documents                               | 204  |
| Audio DSP                                               | Already Rust natively through web-audio-api-rs. In the browser, WebAssembly in audio worklets                                             | 201  |

Each is a generic core in the sense of invariant 14
([207](207-v2-architecture-invariants.md)): it knows nothing about the Patchies
model.

Not candidates:

- the message system and scheduling, because they call user code;
- the object model and the Patchies API;
- the GLSL translator, which `glsl-to-wgsl` already does in TypeScript in 0.1 to
  3.2 ms per shader ([198](198-webgpu-render-core.md)).

## One Build, Both Hosts

| Shape                                                        | Browser     | Native host                 | Trade-off                                                                         |
| ------------------------------------------------------------ | ----------- | --------------------------- | --------------------------------------------------------------------------------- |
| TypeScript only                                              | JavaScript  | JavaScript                  | the default for everything that is not hot                                        |
| **Rust compiled to WebAssembly, run on both hosts**          | WebAssembly | the same WebAssembly, in V8 | one artifact, identical behavior; slower than native Rust, roughly 1.2 to 2 times |
| Figma's split: WebAssembly in browsers, native Rust natively | WebAssembly | native Rust                 | fastest natively, but two builds, and calls through N-API on the native host      |

Kernels start as WebAssembly on both hosts. A kernel gets a native build only if it
is still too slow as WebAssembly on the native host, measured.

This does not change the native host's shape. The native host still needs a
JavaScript engine for user code, and Node provides WebGPU through `dawn.node` and
Web Audio through `node-web-audio-api` for free ([201](201-rust-native-host.md)).
If kernels move to Rust and profiling shows Node's own overhead matters, a Rust host
that embeds V8 becomes the better shape. The engine interface in spec 202 keeps
that possible.

## Live Performance

Kernels fit the live-performance rule
([207](207-v2-architecture-invariants.md#live-performance-stable)) when they follow
these points:

- **No garbage collection on the hot path.** A kernel allocates up front and reuses
  its memory, so it adds no collection pauses.
- **Contained failure.** A WebAssembly trap is caught at the batched call, and the
  caller falls back or skips the frame, without taking down the patch.
- **Deterministic output** for the same input, so peers and hosts agree, and golden
  tests work.

## Testing

- **A TypeScript reference first.** Each kernel starts as TypeScript. The
  WebAssembly version is compared against it on recorded inputs, the scientist
  pattern from [203](203-patchies-v2-roadmap.md), and the reference stays as the
  test oracle.
- **Both hosts,** as for any primitive ([208](208-v2-testing-strategy.md)).
- **Performance budgets** show whether the kernel earned its place. If it is not
  measurably faster, it goes back to TypeScript.

## Process

1. Find the hot path with the cost view and profilers
   ([210](210-performance-transparency.md)), not by guessing.
2. Check that the work is self-contained and can run behind batched calls over
   shared memory.
3. Write the kernel in Rust, compiled to WebAssembly, against the TypeScript
   reference.
4. Keep it only if the budgets show a clear win on both hosts.

## Open Questions

- Which kernel comes first: instance-buffer packing for very large patches, or the
  spatial index for spatial worlds?
- How are kernels packaged: one WebAssembly module for all kernels, or one per
  primitive, so embeds load only what they use
  ([200](200-patchies-v2-primitives.md))?
- Does a kernel's memory live in its own WebAssembly memory, or in a shared one that
  several kernels and JavaScript read?
- What is the threshold for "measurably faster"?

## Related Specs

- [197. Canvas Editor and DOM Islands](197-canvas-editor-and-dom-islands.md):
  display lists and instance buffers.
- [198. WebGPU Render Core](198-webgpu-render-core.md): Figma's lessons.
- [200. Patchies V2 Primitives](200-patchies-v2-primitives.md): small embeddable
  packages.
- [201. Rust Native Host](201-rust-native-host.md): the Node host and its bindings.
- [202. patchies_core](202-patchies-core.md): the TypeScript core on every host.
- [207. V2 Architecture Invariants](207-v2-architecture-invariants.md): generic
  cores and live performance.
- [209. Routing Beyond Wires](209-routing-beyond-wires.md): the spatial index.
- [210. Performance Transparency](210-performance-transparency.md): finding hot
  paths.
