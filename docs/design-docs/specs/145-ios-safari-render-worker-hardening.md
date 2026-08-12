# 145. iOS Safari Render Worker Hardening

## Goal

Make render-worker failures visible and keep one visual node from freezing the rest of the FBO render graph on iOS Safari.

## Problem

On current iOS Safari, adding a `hydra` or `shaderpark` object can leave other worker-rendered nodes such as `glsl` frozen while the main thread continues running. A `three` object can continue rendering in the same patch, which suggests the worker loop is alive but the shared WebGL state or command queue can become unhealthy for regl-based nodes.

Safari/WebKit has known rough edges around worker `OffscreenCanvas` and WebGL context loss or blanking. The render worker should surface those failures instead of silently retaining the last frame.

Production diagnostics identified a more specific failure mode. Loading a dynamic Hydra or ShaderPark worker chunk can re-evaluate the generated render-worker entry on iOS Safari. The second evaluation installs a new `self.onmessage` handler and creates a new `FBORenderer`, while the first renderer's animation loop continues posting frames. New control messages reach the second renderer, but visible frames still come from the first renderer's stale graph.

## Approach

- Report render-worker global errors to the normal internal logger.
- Add worker-side context-loss/context-restore diagnostics for the shared `OffscreenCanvas`.
- Catch per-node render exceptions so one node draw cannot abort the rest of the frame.
- Throttle repeated per-node render errors to avoid flooding logs at 60fps.
- On iOS Safari, refresh regl state after high-risk raw WebGL renderers.
- On iOS Safari, flush after high-risk nodes (`hydra` and `shaderpark`) to reduce WebKit command-queue stalls.
- Outside iOS Safari, keep the normal render path and avoid per-node `getError()` polling.
- Keep worker-global installation in a small entry facade and the stateful renderer implementation in a neutral `render-core` chunk.
- Install the render runtime synchronously behind a worker-global install-once guard. A repeated entry evaluation must not create another `FBORenderer`, message handler, or render loop.
- Keep Hydra, ShaderPark, and other large renderer libraries lazy-loaded.
- Prevent lazy renderer chunks from importing the side-effectful worker entry. Shared imports must target the neutral core chunk.

## Worker Entry Invariant

`GLSystem` constructs the small render-worker entry facade. The facade waits for its statically imported core module, then invokes the synchronous install-once guard. Only the guarded installation may create `FBORenderer`, install `self.onmessage`, and own render-loop lifecycle state.

A production build is valid only when:

- the entry remains a small facade;
- the core implementation is a separate neutral chunk;
- Hydra and ShaderPark remain dynamically imported;
- no non-entry chunk imports the entry facade;
- repeated entry installation against one worker global creates one runtime owner.

## Non-Goals

- Do not move rendering back to the main thread.
- Do not change the graph scheduler or node ordering.
- Do not add a fallback DOM renderer for `hydra` or `shaderpark`.
