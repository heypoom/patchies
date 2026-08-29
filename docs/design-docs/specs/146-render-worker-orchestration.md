# 146. Render Worker Orchestration

`FBORenderer` coordinates the render-worker lifecycle, but it must not own independent infrastructure implementations. Keeping allocation, graph analysis, presentation, and transport compatibility in the class makes unrelated changes risky and obscures render-frame control flow.

## Decision

Keep `FBORenderer` as the stateful coordinator for the render graph and frame loop. Extract independent responsibilities into focused worker helpers:

- `FboResources` owns FBO texture capability detection, allocation, resolution calculation, and GPU resource destruction.
- `fboAllocation` determines attachment counts and allocates FBO attachments.
- `videoGraph` merges wireless video edges and recalculates ordering and feedback storage.
- `VideoSourceResolver` resolves graph inlets, passthrough aliases, and external textures for rendering and capture.
- `buildRenderGraph` reconciles graph changes, FBOs, previews, video channels, and feedback resources.
- `NodeRendererRegistry` owns non-shader renderer creation, lifecycle, and capability routing.
- `ShaderRendererFactory` creates GLSL and ShaderPark renderers.
- `FFTTextureStore` maintains analyzer textures and GLSL sampler bindings.
- `WorkerSettingsRegistry` routes settings updates while renderers initialize.
- `renderFrame` coordinates one frame's cooking, node execution, output presentation, and feedback blits.
- `drawToFinalOutput` applies cover-mode cropping and presents a resolved texture to the output canvas.
- `workerClock` exposes the render-worker transport facade and installs the Hydra-compatible global `time` accessor.
- `renderFboNode` builds node-specific input and uniform parameters, then executes the FBO draw under the node draw profiler.

Helpers receive only the state they need. They do not create a second render loop or own render-graph state. Public `FBORenderer` methods remain stable so renderer implementations and worker message handling continue to use the same integration surface.

## Follow-up

Continue extracting stateful coordination domains from `FBORenderer`, beginning with render-loop and viewport/output orchestration.
