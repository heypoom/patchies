# PixiJS 8 Objects Feasibility Research (2026-08-25)

## Question

Can Patchies add two PixiJS 8 objects?

- `pixi`: a composable, worker-side render-pipeline object.
- `pixi.dom`: a main-thread object with native mouse/pointer interactivity.

## Conclusion

Yes, with two deliberately different integrations. PixiJS 8 explicitly supports
Web Workers through `WebWorkerAdapter`, and explicitly documents sharing one
WebGL context with another renderer using `WebGLRenderer`, `resetState()`, and
manual `render()`. That makes `pixi` feasible in Patchies' render worker.

`pixi.dom` is also feasible, but it must own a main-thread canvas (or render to
one) and use Pixi's normal event system. That event system binds its native
listeners to an `HTMLElement`; an `OffscreenCanvas` in a worker cannot provide
that native DOM event target. Keeping it separate is the correct product and
technical boundary.

## `pixi`: composable worker render node

### Supported foundation

Pixi's environment guide says to set `DOMAdapter` to `WebWorkerAdapter` before
creating Pixi objects, then initialize asynchronously; the resulting canvas is
an `OffscreenCanvas`. This directly supports worker-side scene construction and
asset fetching. [PixiJS environments guide](https://pixijs.com/8.x/guides/concepts/environments/)

Patchies already creates one `OffscreenCanvas` and one WebGL2 context in the
render worker, then renders every graph node into its own `regl` FBO
([`fboRenderer.ts`](../../ui/src/workers/rendering/fboRenderer.ts)). Pixi's
official Three.js integration shows the compatible pattern: create a
`WebGLRenderer`, initialize it with the existing WebGL context,
`clearBeforeRender: false`, then call `resetState()` before
`render({ container: stage })`. [PixiJS: Mixing Three.js and PixiJS](https://pixijs.com/8.x/guides/third-party/mixing-three-and-pixi/)

Therefore the worker renderer should use Pixi's explicit `WebGLRenderer`, not
`Application`/auto-detection: it must share Patchies' WebGL2 context and cannot
use a separately created or WebGPU renderer. Pixi recommends WebGL for
production and labels its WebGPU renderer experimental. [PixiJS renderers guide](https://pixijs.com/8.x/guides/components/renderers/)

### Required composition design

The `FBORenderer` calls each render function while that node's destination FBO
is bound. Pixi's ordinary `render({ container })` targets its view by default,
so it should not be assumed to retain Patchies' current FBO. Pixi's supported
public render target is a `RenderTexture`, passed as `target` in `render()`.
[PixiJS renderer guide](https://pixijs.com/8.x/guides/components/renderers/)

Recommended implementation shape:

1. Create a persistent worker-side Pixi `WebGLRenderer` against
   `FBORenderer.gl`, plus a `Container` stage and a Pixi `RenderTexture` sized
   to the node FBO.
2. On each Patchies frame, update user code/ticker state from the render
   pipeline's transport time; do not let a second Pixi animation loop become
   authoritative.
3. Call `pixiRenderer.resetState()` before Pixi renders, and render the stage
   to the Pixi `RenderTexture` with explicit clear semantics.
4. Copy/blit that WebGL texture into the currently assigned regl FBO, then call
   `renderer.regl._refresh()` before another Patchies renderer uses regl.

The first three steps use public Pixi APIs. The texture-to-regl-FBO bridge needs
a small interoperability spike because Pixi publicly accepts a `RenderTexture`
as a destination but does not promise a public raw-WebGL-framebuffer export.
This is an integration risk, not a feasibility blocker: Patchies already does
the same class of raw WebGL blit after rendering Three.js into its own target in
[`threeRenderer.ts`](../../ui/src/workers/rendering/threeRenderer.ts). Prefer a
documented Pixi WebGL texture/framebuffer access path if available in the pinned
version; otherwise contain the one internal Pixi access behind the Pixi worker
renderer and lock that version.

The proposed `resetState()` call is necessary but not sufficient: it invalidates
Pixi's cached GL state before Pixi renders. Patchies must also refresh regl
after Pixi changes GL bindings/state. Pixi's own guide specifically requires
state resets at renderer boundaries. [PixiJS: Mixing Three.js and PixiJS](https://pixijs.com/8.x/guides/third-party/mixing-three-and-pixi/)

### Node contract and scope

`pixi` can follow the existing worker renderer pattern (`ThreeRenderer`,
`ReglRenderer`): one scene/renderer per node, one explicit `render(time)` entry
point, and the normal Patchies FBO output so downstream video edges, feedback,
previews, capture, and `bg.out` work unchanged. It should start with no native
Pixi interaction and with a documented supported subset of Pixi APIs.

Asset URLs can work in a worker because the Pixi worker adapter supplies the
environment APIs, but test every intended asset type. In particular Pixi v8 no
longer loads URL strings through `Texture.from`; code should use the async
`Assets.load()` path. [PixiJS v8 migration guide](https://pixijs.com/8.x/guides/migrations/v8/)

Because Pixi GPU objects hold resources, graph rebuild/removal must call
renderer and scene/resource cleanup rather than rely on garbage collection.
[PixiJS garbage-collection guide](https://pixijs.com/8.x/guides/concepts/garbage-collection/)

## `pixi.dom`: interactive main-thread object

Pixi has a federated, DOM-like event system for mouse, touch, and pointer input.
Objects receive events when `eventMode` is `static` or `dynamic`; default
`passive` does not make the object itself interactive. [PixiJS events guide](https://pixijs.com/8.x/guides/components/events/)

The Pixi `EventSystem` attaches listeners to a target `HTMLElement`; its API
states that setting that DOM element is required for the event system to
function. [PixiJS `EventSystem` API](https://pixijs.download/release/docs/events.EventSystem.html)
Consequently `pixi.dom` should live on the main thread with an
`HTMLCanvasElement`, its own `Application` or `WebGLRenderer`, and Pixi's
normal event system. It can expose the canvas in the Patchies HTML/canvas-video
path, analogous to existing main-thread external media surfaces. It should not
attempt to share the worker's WebGL context: WebGL contexts are thread-owned,
and the documented Pixi context-sharing pattern is for renderers in the same
execution context.

Full interactivity needs explicit canvas layering and pointer policy: whether
the Pixi canvas is only interactive in output/presentation mode, whether it
captures a pointer during drag, how keyboard focus is handled, and how it
coexists with Patchies' flow-canvas controls. These are product decisions, not
Pixi limitations. Forwarding DOM events to a worker is possible as custom
Patchies plumbing, but it is not equivalent to using Pixi's native event
system, so it should not be the initial `pixi.dom` design.

## Important constraints

- Pin a concrete PixiJS 8 release. The current 8.x documentation and its
  public `RenderTexture` APIs establish the architecture, but the raw
  texture/FBO bridge must be verified against the exact release.
- Configure the worker adapter before the first Pixi construction. It is a
  process-global adapter selection. [PixiJS environments guide](https://pixijs.com/8.x/guides/concepts/environments/)
- Avoid `Application`'s auto-ticker for `pixi`; Patchies' worker loop owns
  scheduling, pause behavior, transport time, cook policy, and rendering
  cadence. Pixi supports manual rendering after asynchronous initialization.
  [PixiJS application guide](https://pixijs.com/8.x/guides/components/application/)
- The `pixi` object must force WebGL. A WebGPU Pixi renderer cannot share
  Patchies' existing WebGL2 context.
- Start with single color output, no DOM/video texture sources, and no native
  events in the worker. Add multi-render-target output, worker input forwarding,
  or DOM-dependent assets only after dedicated tests.

## Recommended validation spike

Before committing to the object API, implement a private throwaway worker test
that performs these checks against the exact Pixi version:

1. Initialize `DOMAdapter.set(WebWorkerAdapter)` and a `WebGLRenderer` on an
   existing worker WebGL2 context.
2. Render a `Graphics` scene into a same-size Pixi `RenderTexture` and blit it
   into a regl FBO.
3. Render a regl node before and after it, using Pixi `resetState()` before the
   Pixi draw and regl cache refresh afterward; compare the resulting pixels.
4. Resize, rebuild, and destroy the Pixi renderer repeatedly; assert no stale
   frame or WebGL errors.
5. Verify `Assets.load()` for the supported worker-safe image formats and test
   Chromium, Firefox, and Safari versions that Patchies supports.
6. Separately mount `pixi.dom` over a real HTML canvas and test pointer down,
   hover/cursor, drag capture, touch, keyboard focus, and coexistence with the
   Patchies editor.

## Decision

Proceed with a small integration spike, then add the two objects as separate
implementations. `pixi` is technically feasible for the existing worker render
graph, with the FBO interop seam as the only material engineering uncertainty.
`pixi.dom` is technically feasible for full native interaction but should be a
main-thread canvas object, not a worker render node with forwarded events.
