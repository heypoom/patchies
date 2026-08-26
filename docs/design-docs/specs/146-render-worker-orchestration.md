# 146. Render Worker Orchestration

`FBORenderer` coordinates the render-worker lifecycle, but it must not own independent infrastructure implementations. Keeping allocation, graph analysis, presentation, and transport compatibility in the class makes unrelated changes risky and obscures render-frame control flow.

## Decision

Keep `FBORenderer` as the stateful coordinator for the render graph and frame loop. Extract independent responsibilities into focused worker helpers:

- `FboResources` owns FBO texture capability detection, allocation, resolution calculation, and GPU resource destruction.
- `videoGraph` merges wireless video edges and recalculates ordering and feedback storage.
- `OutputPresenter` applies cover-mode cropping and presents a resolved texture to the output canvas.
- `workerClock` exposes the render-worker transport facade and installs the Hydra-compatible global `time` accessor.

Helpers receive only the state they need. They do not create a second render loop or own render-graph state. Public `FBORenderer` methods remain stable so renderer implementations and worker message handling continue to use the same integration surface.

## Follow-up

Renderer-specific creation and reuse policy is the next major extraction candidate. It should move behind a renderer registry/factory that owns per-renderer maps and deferred renderer cleanup, while `FBORenderer` retains only orchestration calls.
