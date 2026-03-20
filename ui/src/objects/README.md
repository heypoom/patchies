# Objects Directory

This directory contains self-contained object modules. Each module lives in its own subdirectory and owns all related files: components, workers, system classes, types, and prompts.

## Convention

```text
src/objects/<module>/
  components/        # Svelte node components
  workers/           # Web worker files (*.worker.ts)
  types.ts           # Shared types for this module
  *System.ts         # Singleton system/manager class (if needed)
  *Base.ts           # Shared base class (if needed)
  prompts.ts         # AI object prompts for this module
```

Module files are imported using the `$objects` alias:

```ts
import { MySystem } from '$objects/mymodule/MySystem';
import MyNode from '$objects/mymodule/components/MyNode.svelte';
```

## Modules

### `mediapipe/`

MediaPipe ML vision nodes: `vision.hand`, `vision.body`, `vision.face`, `vision.segment`, `vision.detect`.

- `types.ts` — shared types and worker message protocol
- `MediaPipeWorkerBase.ts` — abstract base class for all vision workers (WASM workaround, FPS tracking, GPU→CPU fallback)
- `MediaPipeNodeSystem.ts` — singleton managing workers, the rAF frame loop, and result routing
- `workers/` — one worker per task type (`hand.worker.ts`, `body.worker.ts`, etc.)
- `components/` — Svelte node components + shared `MediaPipeNodeLayout.svelte`
- `prompts.ts` — AI object prompts for all vision nodes

### `serial/`

Serial port communication nodes.

### `projmap/`

Projection mapping nodes.

### `curve/`

Curve/automation nodes.

### `pads/`

Pad/trigger nodes.

### `table/`

Table data nodes.
