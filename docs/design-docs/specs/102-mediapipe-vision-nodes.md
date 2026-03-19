# 102. MediaPipe Vision Detection Nodes

## Overview

Native Patchies nodes for real-time vision ML using `@mediapipe/tasks-vision`, running in isolated per-node web workers. Connects to any video source (e.g. `webcam`, `video`, `screen`) via a video inlet and emits structured detection results as messages.

**Nodes:**

- `vision.hand` — hand skeleton + palm detection (HandLandmarker)
- `vision.body` — full-body pose estimation (PoseLandmarker)
- `vision.face` — facial landmark detection (FaceLandmarker)
- `vision.segment` — body segmentation mask (ImageSegmenter)
- `vision.detect` — object detection with bounding boxes (ObjectDetector)

These form the new **Vision** object pack.

---

## Architecture

```
webcam ──video──► vision.hand ──message──► [downstream nodes]
                      │
                      ▼
              MediaPipeNodeSystem
              (singleton, rAF loop)
                      │ requestMediaPipeVideoFramesBatch (eventBus)
                      ▼
                  GLSystem.ts
                      │ captureMediaPipeVideoFramesBatch (→ render worker)
                      ▼
               render worker
               (captures ImageBitmap from source node textures)
                      │ mediaPipeVideoFramesCapturedBatch (→ main thread)
                      ▼
                  GLSystem.ts
                      │ MediaPipeNodeSystem.deliverVideoFrames()
                      ▼
              vision.hand worker
              (MediaPipe HandLandmarker)
                      │ { type: 'result', data }
                      ▼
              MessageContext.send()
```

This mirrors the `WorkerNodeSystem` batch frame delivery path exactly. No new render worker logic needed — we reuse the existing `captureWorkerVideoFramesBatch` infrastructure by adding a parallel event type.

### Key Components

```
ui/src/lib/mediapipe/
  MediaPipeNodeSystem.ts       # Singleton manager (mirrors WorkerNodeSystem)
  MediaPipeWorkerBase.ts       # Shared worker base class
  types.ts                     # Shared TS types (results, options, worker messages)
  workers/
    hand.worker.ts
    body.worker.ts
    face.worker.ts
    segment.worker.ts
    detect.worker.ts

ui/src/lib/components/nodes/
  MediaPipeNodeLayout.svelte   # Shared layout (handles, status, settings panel)
  VisionHandNode.svelte
  VisionBodyNode.svelte
  VisionFaceNode.svelte
  VisionSegmentNode.svelte
  VisionDetectNode.svelte
```

---

## Shared Infrastructure

### MediaPipeNodeSystem (singleton)

Mirrors `WorkerNodeSystem`. Responsibilities:

- Registry of active instances: node ID → `{ worker, messageContext, sourceNodeIds, frameCounter, skipFrames }`
- Global `requestAnimationFrame` loop (starts on first register, stops when empty)
- On each tick: dispatches `requestMediaPipeVideoFramesBatch` to PatchiesEventBus
- Frame skipping per node: only includes a node in the batch when `frameCounter % skipFrames === 0`
- `deliverVideoFrames()`: posts `ImageBitmap` to the node's worker (with transfer)
- Receives worker results via `onmessage` and calls `messageContext.send(data, { to: 0 })`
- `updateConnections(edges)`: keeps `sourceNodeIds` up to date per node

```ts
class MediaPipeNodeSystem {
  static getInstance(): MediaPipeNodeSystem;
  register(nodeId: string, options: MediaPipeNodeOptions): void;
  unregister(nodeId: string): void;
  updateConnections(edges: Edge[]): void;
  updateSettings(nodeId: string, settings: Partial<TaskOptions>): void;
  deliverVideoFrames(nodeId: string, frames: (ImageBitmap | null)[], timestamp: number): void;
}

interface MediaPipeNodeOptions {
  task: MediaPipeTask;
  taskOptions: TaskOptions;
  messageContext: MessageContext;
  skipFrames: number;
}
```

### Wiring into GLSystem (3 additions)

**`ui/src/lib/eventbus/events.ts`** — add new event type (same shape as `RequestWorkerVideoFramesBatchEvent`):

```ts
export interface RequestMediaPipeVideoFramesBatchEvent {
  type: 'requestMediaPipeVideoFramesBatch';
  requests: Array<{
    targetNodeId: string;
    sourceNodeIds: (string | null)[];
    resolution?: [number, number];
  }>;
}
```

**`ui/src/lib/canvas/GLSystem.ts`** — add event listener (mirrors `requestWorkerVideoFramesBatch`):

```ts
this.eventBus.addEventListener('requestMediaPipeVideoFramesBatch', (event) => {
  this.send('captureMediaPipeVideoFramesBatch', { requests: event.requests });
});
```

And add response handler in `handleRenderWorkerMessage` (mirrors `workerVideoFramesCapturedBatch`):

```ts
.with({ type: 'mediaPipeVideoFramesCapturedBatch' }, (data) => {
  import('$lib/mediapipe/MediaPipeNodeSystem').then(({ MediaPipeNodeSystem }) => {
    const system = MediaPipeNodeSystem.getInstance();
    for (const result of data.results) {
      system.deliverVideoFrames(result.targetNodeId, result.frames, data.timestamp);
    }
  });
})
```

**Render worker** — add handler for `captureMediaPipeVideoFramesBatch` that reuses the same frame capture logic as `captureWorkerVideoFramesBatch`, responding with `mediaPipeVideoFramesCapturedBatch`.

**Wire `updateConnections`** — in the same place `WorkerNodeSystem.updateVideoConnections(edges)` is called on edge changes, also call `MediaPipeNodeSystem.getInstance().updateConnections(edges)`.

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

Abstract base class used inside every worker. Handles:

1. **WASM loading workaround** for module workers (see below)
2. Task initialization via abstract `initTask()`
3. Frame dispatch via abstract `detectFrame()`
4. FPS tracking (posts `{ type: 'fps' }` every second)
5. Error handling with CPU delegate fallback

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

MediaPipe calls `importScripts()` internally, which is unsupported in module workers. Workaround (validated in prototype):

```ts
const vision = await FilesetResolver.forVisionTasks(WASM_CDN_BASE);
const loaderCode = await fetch(vision.wasmLoaderPath).then(r => r.text());
(0, eval)(loaderCode);        // sets globalThis.ModuleFactory in worker scope
delete vision.wasmLoaderPath; // prevents MediaPipe from calling importScripts()
```

Encapsulated entirely in `MediaPipeWorkerBase.init()`.

**WASM CDN base:** `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm`
**Model CDN base:** `https://storage.googleapis.com/mediapipe-models/`

Pin `@0.10.0` (version validated in prototype). Install: `bun add @mediapipe/tasks-vision`.

---

## Frame Pipeline

1. `MediaPipeNodeSystem`'s rAF loop fires
2. For each registered node where `frameCounter % skipFrames === 0`: add to batch
3. Dispatches `requestMediaPipeVideoFramesBatch` to PatchiesEventBus
4. GLSystem forwards to render worker as `captureMediaPipeVideoFramesBatch`
5. Render worker captures `ImageBitmap` from source node textures (same logic as worker nodes)
6. Render worker responds with `mediaPipeVideoFramesCapturedBatch`
7. GLSystem calls `MediaPipeNodeSystem.deliverVideoFrames()` for each result
8. `deliverVideoFrames()` posts `{ type: 'frame', bitmap, timestamp }` to the node's worker (transferred)
9. Worker runs MediaPipe detection synchronously
10. Worker posts `{ type: 'result', data }` back
11. `MediaPipeNodeSystem` calls `messageContext.send(data, { to: 0 })` (or routes to video outlet for `vision.segment`)

Frame format: `ImageBitmap`. `VideoFrame` is a future optimization (zero-copy, worker-transferable).

---

## Shared Svelte Layout: MediaPipeNodeLayout.svelte

All five node components use this layout. Props:

```ts
{
  nodeId: string;
  selected: boolean;
  title: string;             // e.g. 'vision.hand'
  status: 'idle' | 'initializing' | 'running' | 'error';
  error?: string;
  fps?: number;
  schema: SettingsSchema;    // task-specific settings schema
  settingsData: Record<string, unknown>;  // current node data values
  onSettingChange: (key: string, value: unknown) => void;
  onRevertSettings: () => void;
  // outlet count varies per node
  messageOutletCount?: number;  // default 1
  hasVideoOutlet?: boolean;     // for vision.segment
}
```

Renders:

- **Video inlet handle** (orange)
- **Message outlet handle(s)** (gray)
- **Video outlet handle** (orange, only when `hasVideoOutlet`)
- **Node label** (object type name)
- **Status pill**: idle (zinc) / initializing (amber, pulsing) / running (green) / error (red)
- **FPS** (tiny, shown when running)
- **Settings button** → collapsible panel using `ObjectSettings.svelte` with `settingsPrefix=""`
- **Error text** (when status is error)

Node appearance is minimal — no preview canvas. Visualization is the user's responsibility.

### Settings via ObjectSettings.svelte

Each node uses `ObjectSettings.svelte` directly with `settingsPrefix=""` so undo/redo tracks keys directly in node data (e.g. `numHands`, not `settings.numHands`):

```svelte
<ObjectSettings
  {nodeId}
  schema={HAND_SETTINGS_SCHEMA}
  values={data}
  settingsPrefix=""
  onValueChange={(key, value) => {
    updateNodeData(nodeId, { [key]: value });
    mediaPipeSystem.updateSettings(nodeId, { [key]: value });
  }}
  onRevertAll={handleRevertAll}
  onClose={() => showSettings = false}
/>
```

---

## Output Data Shapes

### vision.hand (outlet 0 — message)

```ts
interface HandOutput {
  hands: Array<{
    handedness: 'Left' | 'Right';
    score: number;
    landmarks: Point3D[];       // 21 keypoints, normalized [0,1] x/y, z relative
    worldLandmarks: Point3D[];  // 21 keypoints in meters
  }>;
  timestamp: number;
}
```

### vision.body (outlet 0 — message)

```ts
interface BodyOutput {
  poses: Array<{
    landmarks: Point4D[];       // 33 keypoints, normalized, with visibility
    worldLandmarks: Point4D[];  // 33 keypoints in meters
  }>;
  timestamp: number;
}
```

### vision.face (outlet 0 — message)

```ts
interface FaceOutput {
  faces: Array<{
    landmarks: Point3D[];       // 478 landmarks, normalized
    blendshapes?: Array<{ categoryName: string; score: number }>;
    transformationMatrix?: number[]; // 4x4, if enabled
  }>;
  timestamp: number;
}
```

### vision.segment

- **Outlet 0 — video**: mask as greyscale `ImageBitmap`, fed into GLSystem via `setBitmap()`. Always active.
- **Outlet 1 — message** (optional, toggled by `outputMessage` setting):

```ts
interface SegmentOutput {
  width: number;
  height: number;
  mask: Uint8Array | Float32Array; // Uint8Array (category) or Float32Array (confidence)
  maskType: 'category' | 'confidence';
  timestamp: number;
}
```

The message outlet avoids wasteful `Uint8Array` serialization by default — users enable it only when they need the raw data.

### vision.detect (outlet 0 — message)

```ts
interface DetectOutput {
  detections: Array<{
    label: string;
    score: number;
    boundingBox: { originX: number; originY: number; width: number; height: number };
  }>;
  timestamp: number;
}
```

```ts
interface Point3D { x: number; y: number; z: number }
interface Point4D { x: number; y: number; z: number; visibility: number }
```

---

## Node Settings

All settings stored directly in `data` (not `data.settings`), tracked with `settingsPrefix=""`.

### Common to all nodes

| Setting | Field type | Default | Description |
|---------|-----------|---------|-------------|
| `skipFrames` | `SliderField` 1–10 | 1 | Process every Nth frame |
| `delegate` | `SelectField` | `'GPU'` | `CPU` or `GPU` |

### vision.hand

| Setting | Field type | Default | Options |
|---------|-----------|---------|---------|
| `numHands` | `SliderField` 1–4 | 2 | Max simultaneous hands |
| `model` | `SelectField` | `'lite'` | `lite`, `full` |

### vision.body

| Setting | Field type | Default | Options |
|---------|-----------|---------|---------|
| `numPoses` | `SliderField` 1–4 | 1 | Max simultaneous poses |
| `model` | `SelectField` | `'lite'` | `lite`, `full`, `heavy` |

### vision.face

| Setting | Field type | Default | Options |
|---------|-----------|---------|---------|
| `numFaces` | `SliderField` 1–4 | 1 | Max simultaneous faces |
| `blendshapes` | `BooleanField` | `false` | Output 52 ARKit blendshapes |

### vision.segment

| Setting | Field type | Default | Options |
|---------|-----------|---------|---------|
| `maskType` | `SelectField` | `'category'` | `category`, `confidence` |
| `outputMessage` | `BooleanField` | `false` | Also output mask data as message |

### vision.detect

| Setting | Field type | Default | Options |
|---------|-----------|---------|---------|
| `maxResults` | `SliderField` 1–20 | 5 | Max detections per frame |
| `scoreThreshold` | `SliderField` 0–1 | 0.5 | Min confidence threshold |

---

## Inlets & Outlets

| Node | Inlet 0 | Outlet 0 | Outlet 1 |
|------|---------|----------|----------|
| `vision.hand` | video | message (hands array) | — |
| `vision.body` | video | message (poses array) | — |
| `vision.face` | video | message (faces array) | — |
| `vision.segment` | video | video (greyscale mask) | message (mask data, optional) |
| `vision.detect` | video | message (detections array) | — |

---

## Implementation Checklist

### Shared (implement first)

- [ ] `bun add @mediapipe/tasks-vision` (pin `@0.10.0`)
- [ ] `ui/src/lib/mediapipe/types.ts` — all shared TS types
- [ ] `ui/src/lib/mediapipe/MediaPipeWorkerBase.ts`
- [ ] `ui/src/lib/mediapipe/MediaPipeNodeSystem.ts`
- [ ] `ui/src/lib/eventbus/events.ts` — add `RequestMediaPipeVideoFramesBatchEvent`
- [ ] `ui/src/lib/canvas/GLSystem.ts` — add event listener + response handler
- [ ] Render worker — add `captureMediaPipeVideoFramesBatch` handler (reuse frame capture logic)
- [ ] Wire `MediaPipeNodeSystem.updateConnections()` alongside `WorkerNodeSystem.updateVideoConnections()`
- [ ] `ui/src/lib/components/nodes/MediaPipeNodeLayout.svelte`
- [ ] New "Vision" pack in `src/lib/extensions/object-packs.ts`
- [ ] Vision pack icon in `src/lib/extensions/pack-icons.ts`

### Per node (× 5)

- [ ] `ui/src/lib/mediapipe/workers/{name}.worker.ts`
- [ ] Svelte component `ui/src/lib/components/nodes/Vision{Name}Node.svelte`
- [ ] Register in `src/lib/nodes/node-types.ts`
- [ ] Register defaults in `src/lib/nodes/defaultNodeData.ts`
- [ ] Add to `src/lib/components/object-browser/get-categorized-objects.ts` (category: Vision)
- [ ] Add to Vision pack in `object-packs.ts`
- [ ] Add to `src/lib/ai/object-descriptions-types.ts` (OBJECT_TYPE_LIST)
- [ ] AI prompt in `src/lib/ai/object-prompts/` + register in `index.ts`
- [ ] Documentation `ui/static/content/objects/{vision.name}.md`

---

## Implementation Notes

### Worker Lifecycle

```
onMount → MediaPipeNodeSystem.register(nodeId, options)
        → new Worker(workerUrl, { type: 'module' })
        → worker.postMessage({ type: 'init', task, options })
        → worker initializes MediaPipe (WASM eval workaround)
        → worker.postMessage({ type: 'ready' })
        → rAF loop begins (or was already running)

onDestroy → MediaPipeNodeSystem.unregister(nodeId)
          → worker.postMessage({ type: 'destroy' })
          → worker.terminate()
          → messageContext.destroy()
```

### Settings Changes

When a setting changes, the Svelte node calls:

1. `updateNodeData(nodeId, { [key]: value })` — persists to XY Flow
2. `MediaPipeNodeSystem.updateSettings(nodeId, { [key]: value })` — posts `{ type: 'updateSettings' }` to worker

The worker recreates the task with new options (MediaPipe tasks cannot be reconfigured in place). During recreation, frames are queued/dropped.

### Frame Skipping

`MediaPipeNodeSystem` increments a per-node `frameCounter` on every rAF tick. A node is only included in the batch request when `frameCounter % skipFrames === 0`. Frame skipping happens before any frame capture — zero overhead for skipped frames.

### Error Handling

If a worker posts `{ type: 'error' }` (e.g. GPU delegate unavailable), the node's status switches to `'error'`. The system automatically retries `init` with `delegate: 'CPU'`. If CPU also fails, the error message is shown permanently.

### vision.segment Video Output

After the worker returns the mask data, `MediaPipeNodeSystem` (or the node's message handler) creates an `ImageBitmap` from the mask array and calls `glSystem.setBitmap(nodeId, bitmap)`. The node registers itself in GLSystem with `glSystem.upsertNode(nodeId, 'img', {})` on mount, same as other video-output nodes.

### Future: HolisticLandmarker

`HolisticLandmarker` runs hand + pose + face in a single optimized graph. A future `vision.holistic` node could wrap this for users who need all three simultaneously. Not in scope for initial implementation.

### Future: VideoFrame Transfer

Post-MVP, `MediaPipeNodeSystem` could deliver `VideoFrame` instead of `ImageBitmap` when WebCodecs is available, eliminating the per-frame copy. The worker protocol already supports this — just change the transfer type.
