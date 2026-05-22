# 145. iOS Safari Render Worker Hardening

## Goal

Make render-worker failures visible and keep one visual node from freezing the rest of the FBO render graph on iOS Safari.

## Problem

On current iOS Safari, adding a `hydra` or `shaderpark` object can leave other worker-rendered nodes such as `glsl` frozen while the main thread continues running. A `three` object can continue rendering in the same patch, which suggests the worker loop is alive but the shared WebGL state or command queue can become unhealthy for regl-based nodes.

Safari/WebKit has known rough edges around worker `OffscreenCanvas` and WebGL context loss or blanking. The render worker should surface those failures instead of silently retaining the last frame.

## Approach

- Report render-worker global errors to the normal internal logger.
- Add worker-side context-loss/context-restore diagnostics for the shared `OffscreenCanvas`.
- Catch per-node render exceptions so one node draw cannot abort the rest of the frame.
- Throttle repeated per-node render errors to avoid flooding logs at 60fps.
- On iOS Safari, refresh regl state after high-risk raw WebGL renderers.
- On iOS Safari, flush after high-risk nodes (`hydra` and `shaderpark`) to reduce WebKit command-queue stalls.
- Outside iOS Safari, keep the normal render path and avoid per-node `getError()` polling.

## Non-Goals

- Do not move rendering back to the main thread.
- Do not change the graph scheduler or node ordering.
- Do not add a fallback DOM renderer for `hydra` or `shaderpark`.
