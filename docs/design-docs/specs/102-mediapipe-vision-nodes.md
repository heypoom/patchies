# 102. MediaPipe Vision Detection Nodes

## Overview

Native Patchies nodes for real-time vision ML using `@mediapipe/tasks-vision`, running in isolated per-node web workers. Connects to any video source (e.g. `webcam`, `video`, `screen`) via a video inlet and emits structured detection results as messages.

**Nodes:**
- `handpose` — hand skeleton + palm detection (HandLandmarker)
- `bodypose` — full-body pose estimation (PoseLandmarker)
- `facemesh` — facial landmark detection (FaceLandmarker)
- `segmenter` — body segmentation mask (ImageSegmenter)
- `objectdetect` — object detection with bounding boxes (ObjectDetector)

---

## Architecture

```
webcam ──video──► handpose ──message──► [downstream nodes]
                    │
                    ▼
              MediaPipeNodeSystem
              (singleton, rAF loop)
                    │ ImageBitmap (per frame)
                    ▼
              handpose.worker.ts
              (MediaPipe Tasks API)
                    │ structured result
                    ▼
              MessageContext.send()
```

### Key Components

```
ui/src/lib/mediapipe/
  MediaPipeNodeSystem.ts       # Singleton manager (mirrors WorkerNodeSystem pattern)
  MediaPipeWorkerBase.ts       # Shared worker setup/teardown logic
  types.ts                     # Shared TypeScript types (results, options, messages)
  workers/
    handpose.worker.ts
    bodypose.worker.ts
    facemesh.worker.ts
    segmenter.worker.ts
    objectdetect.worker.ts

ui/src/lib/components/nodes/
  MediaPipeNodeLayout.svelte   # Shared Svelte layout (status badge, settings panel, handles)
  HandPoseNode.svelte
  BodyPoseNode.svelte
  FaceMeshNode.svelte
  SegmenterNode.svelte
  ObjectDetectNode.svelte
```

---

## Shared Infrastructure

### MediaPipeNodeSystem (singleton)

Mirrors `WorkerNodeSystem`:

- Maintains a registry of active MediaPipe node instances (node ID → worker + state)
- Runs a global `requestAnimationFrame` loop
- On each tick: dispatches `requestWorkerVideoFramesBatch` events so GLSystem captures `ImageBitmap` frames from connected source nodes
- Delivers `ImageBitmap` to each node's worker via `postMessage` (with transfer)
- Receives results from workers and routes them to the node's `MessageContext`
- Handles frame skipping: only dispatches every Nth frame based on `skipFrames` setting

```ts
class MediaPipeNodeSystem {
  static getInstance(): MediaPipeNodeSystem;
  register(nodeId: string, options: MediaPipeNodeOptions): void;
  unregister(nodeId: string): void;
  updateConnections(edges: Edge[]): void;
  updateSettings(nodeId: string, settings: Partial<TaskSettings>): void;
  deliverVideoFrames(nodeId: string, frames: (ImageBitmap | null)[], timestamp: number): void;
}
```

### Worker Message Protocol

**Main → Worker:**
```ts
{ type: 'init'; task: MediaPipeTask; options: TaskOptions }
{ type: 'frame'; bitmap: ImageBitmap; timestamp: number }
{ type: 'updateSettings'; settings: Partial<TaskOptions> }
{ type: 'destroy' }
```

**Worker → Main:**
```ts
{ type: 'ready' }
{ type: 'error'; message: string }
{ type: 'result'; data: TaskResult }
{ type: 'fps'; value: number }
```

### MediaPipeWorkerBase

Shared class used inside every worker. Handles:

1. **WASM loading workaround** for module workers (see below)
2. `FilesetResolver` setup (shared across all task types in same worker)
3. Frame skip logic
4. FPS tracking
5. Error handling and recovery

```ts
abstract class MediaPipeWorkerBase<TTask, TResult> {
  protected abstract initTask(vision: WasmFileset, options: TaskOptions): Promise<TTask>;
  protected abstract detectFrame(task: TTask, bitmap: ImageBitmap, timestamp: number): TResult;
  protected abstract formatResult(raw: TResult): TaskResult;

  async init(options: TaskOptions): Promise<void>;
  processFrame(bitmap: ImageBitmap, timestamp: number): void;
  destroy(): void;
}
```

### WASM Module Worker Workaround

MediaPipe internally calls `importScripts()`, which is not supported in module workers. The workaround (validated in prototype):

```ts
const vision = await FilesetResolver.forVisionTasks(WASM_CDN_BASE);
const loaderCode = await fetch(vision.wasmLoaderPath).then(r => r.text());
(0, eval)(loaderCode);       // sets globalThis.ModuleFactory in worker scope
delete vision.wasmLoaderPath; // prevent MediaPipe from calling importScripts()
// Now FilesetResolver works correctly
```

This is encapsulated entirely in `MediaPipeWorkerBase.init()`.

**WASM CDN base:** `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.x/wasm`
**Model CDN base:** `https://storage.googleapis.com/mediapipe-models/`

---

## Frame Pipeline

1. `MediaPipeNodeSystem`'s rAF loop fires
2. Dispatches `requestWorkerVideoFramesBatch` with source node IDs (same as WorkerNodeSystem)
3. GLSystem captures `ImageBitmap` frames from upstream video nodes and returns them
4. `MediaPipeNodeSystem.deliverVideoFrames()` posts bitmap to the node's worker
5. Worker runs MediaPipe detection synchronously
6. Worker posts `{ type: 'result', data }` back to main thread
7. `MediaPipeNodeSystem` calls `messageContext.send(data, { to: 0 })` for the node

Frame format: `ImageBitmap` (proven from prototype; `VideoFrame` can be explored post-MVP as it's worker-transferable and zero-copy).

---

## Shared Svelte Layout: MediaPipeNodeLayout.svelte

All five node components use this layout. It renders:

- **Video inlet handle** (orange, `handleType: 'video'`)
- **Message outlet handle(s)** (gray, `handleType: 'message'`)
- **Status badge**: idle / initializing / running / error
- **FPS display** (small, in corner when running)
- **Settings panel** (collapsible, renders task-specific settings passed as snippet)
- **Error message** (when init fails or detection crashes)

```svelte
<!-- Usage in HandPoseNode.svelte -->
<MediaPipeNodeLayout
  {nodeId}
  {selected}
  title="handpose"
  status={nodeStatus}
  fps={currentFps}
>
  {#snippet settings()}
    <!-- HandPose-specific settings -->
    <label>Max Hands</label>
    <input type="range" min={1} max={4} bind:value={numHands} />
  {/snippet}
</MediaPipeNodeLayout>
```

---

## Output Data Shapes

All results are output as message objects on outlet 0.

### HandPose
```ts
interface HandPoseOutput {
  hands: Array<{
    handedness: 'Left' | 'Right';
    score: number;
    landmarks: Point3D[];        // 21 keypoints, normalized [0,1] x/y, z relative
    worldLandmarks: Point3D[];   // 21 keypoints in meters
  }>;
  timestamp: number;
}
```

### BodyPose
```ts
interface BodyPoseOutput {
  poses: Array<{
    landmarks: Point4D[];        // 33 keypoints, normalized, with visibility
    worldLandmarks: Point4D[];   // 33 keypoints in meters
  }>;
  timestamp: number;
}
```

### FaceMesh
```ts
interface FaceMeshOutput {
  faces: Array<{
    landmarks: Point3D[];        // 478 landmarks, normalized
    blendshapes?: Array<{ categoryName: string; score: number }>;
    transformationMatrix?: number[]; // 4x4, if enabled
  }>;
  timestamp: number;
}
```

### Segmenter
```ts
interface SegmenterOutput {
  width: number;
  height: number;
  mask: Uint8Array | Float32Array; // Uint8Array for category, Float32Array for confidence
  maskType: 'category' | 'confidence';
  timestamp: number;
}
```

### ObjectDetect
```ts
interface ObjectDetectOutput {
  detections: Array<{
    label: string;
    score: number;
    boundingBox: { originX: number; originY: number; width: number; height: number };
  }>;
  timestamp: number;
}
```

Where:
```ts
interface Point3D { x: number; y: number; z: number }
interface Point4D { x: number; y: number; z: number; visibility: number }
```

---

## Node Settings

### Common to all nodes

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `skipFrames` | slider 1–10 | 1 | Process every Nth frame |
| `delegate` | radio CPU/GPU | GPU | Inference backend |
| `model` | dropdown | lite | Model variant (see per-node) |

### HandPose

| Setting | Type | Default | Options |
|---------|------|---------|---------|
| `numHands` | slider 1–4 | 2 | Max simultaneous hands |
| `model` | dropdown | lite | lite, full |

### BodyPose

| Setting | Type | Default | Options |
|---------|------|---------|---------|
| `numPoses` | slider 1–4 | 1 | Max simultaneous poses |
| `model` | dropdown | lite | lite, full, heavy |

### FaceMesh

| Setting | Type | Default | Options |
|---------|------|---------|---------|
| `numFaces` | slider 1–4 | 1 | Max simultaneous faces |
| `blendshapes` | toggle | off | Output 52 ARKit blendshapes |
| `model` | dropdown | (single) | — (only one variant) |

### Segmenter

| Setting | Type | Default | Options |
|---------|------|---------|---------|
| `maskType` | radio | category | category, confidence |
| `model` | dropdown | (single) | — |

### ObjectDetect

| Setting | Type | Default | Options |
|---------|------|---------|---------|
| `maxResults` | slider 1–20 | 5 | Max detections per frame |
| `scoreThreshold` | slider 0–1 | 0.5 | Min confidence |
| `model` | dropdown | (single) | — |

---

## Node Data (persisted in XY Flow)

Each node stores its settings in `data`:

```ts
// HandPoseNode example
interface HandPoseNodeData {
  numHands: number;
  delegate: 'CPU' | 'GPU';
  model: 'lite' | 'full';
  skipFrames: number;
}
```

---

## Inlets & Outlets

All five nodes share the same handle topology:

| Port | Type | Description |
|------|------|-------------|
| Inlet 0 | video | Video source (webcam, video, screen, etc.) |
| Outlet 0 | message | Detection results (structured object, every processed frame) |

---

## Node Checklist

For each of the five nodes:

- [ ] Worker file in `ui/src/lib/mediapipe/workers/{name}.worker.ts`
- [ ] Svelte component in `ui/src/lib/components/nodes/`
- [ ] Register node type in `src/lib/nodes/node-types.ts`
- [ ] Register default data in `src/lib/nodes/defaultNodeData.ts`
- [ ] Add to `src/lib/components/object-browser/get-categorized-objects.ts` (category: Vision)
- [ ] Add to `src/lib/extensions/object-packs.ts` (new Vision pack)
- [ ] AI object prompts in `src/lib/ai/object-prompts/`
- [ ] Add to `src/lib/ai/object-descriptions-types.ts` (OBJECT_TYPE_LIST)
- [ ] Documentation in `ui/static/content/objects/{name}.md`

Shared (once):
- [ ] `MediaPipeNodeSystem.ts`
- [ ] `MediaPipeWorkerBase.ts`
- [ ] `types.ts`
- [ ] `MediaPipeNodeLayout.svelte`
- [ ] Wire `MediaPipeNodeSystem` into the edge-change handler (same as `WorkerNodeSystem.updateVideoConnections`)
- [ ] Wire `deliverVideoFrames` in GLSystem response handler
- [ ] New "Vision" object pack + icon in `pack-icons.ts`

---

## Implementation Notes

### One Worker Per Node Instance

Each node creates its own worker. No GPU context is shared between tasks — this is a MediaPipe limitation (each task instance owns its own WebGL context). The isolation also means one node crashing doesn't affect others.

### Worker Lifecycle

```
onMount → MediaPipeNodeSystem.register(nodeId, options)
        → spawns worker, sends 'init'
        → worker initializes MediaPipe (WASM eval workaround)
        → worker posts 'ready'
        → rAF loop begins delivering frames

onDestroy → MediaPipeNodeSystem.unregister(nodeId)
          → sends 'destroy' to worker
          → worker.terminate()
```

### Settings Changes

When a setting changes (e.g. `numHands`), the node calls `MediaPipeNodeSystem.updateSettings(nodeId, { numHands: 3 })`. The system posts `{ type: 'updateSettings', settings }` to the worker. The worker recreates the task with new options (MediaPipe tasks are not reconfigurable in place).

### Frame Skipping

Implemented in `MediaPipeNodeSystem` before frame dispatch, not in the worker. A per-node frame counter is incremented on every rAF tick; frames are only dispatched when `counter % skipFrames === 0`.

### Error Handling

If the worker posts `{ type: 'error' }` (e.g. GPU delegate unavailable), the node shows an error badge and automatically retries with CPU delegate.

### Future: HolisticLandmarker

MediaPipe's `HolisticLandmarker` runs hand + pose + face in a single optimized graph (no separate workers). A future `holistic` node could wrap this for users who need all three simultaneously with lower overhead. Not in scope for initial implementation.

### Future: VideoFrame

`VideoFrame` (WebCodecs) is worker-transferable and has a zero-copy GPU path. Post-MVP, `MediaPipeNodeSystem` could deliver `VideoFrame` instead of `ImageBitmap` when WebCodecs is available, reducing per-frame copy overhead.
