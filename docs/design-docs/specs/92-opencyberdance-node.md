# 92. OpenCyberdance Node

**Status**: Design Complete
**Created**: 2026-03-07

## Overview

A `cyberdancer` node that renders animated 3D dancer characters from the [OpenCyberdance](https://opencyberdance.pages.dev) project directly in the Patchies rendering pipeline. The node runs the Three.js character engine on the rendering worker, receives native Patchies messages to control animation parameters, and outputs native video frames into the FBO pipeline.

Assets (GLB models) are served remotely from `https://opencyberdance.pages.dev` — nothing is bundled into Patchies.

---

## Architecture

The node follows the exact same pattern as `ThreeRenderer`: Three.js runs inside the rendering worker sharing the WebGL2 context with regl, then blits its render target into the regl FBO.

```
Main Thread                     Rendering Worker
──────────────────────────────  ─────────────────────────────────────
CyberdancerNode.svelte          CyberdancerRenderer
  │  sends messages ──────────► handleMessage()
  │                               │ routes to World / Character API
  │                               │
  │  receives video frames ◄───── renderFrame()
  │  (native FBO output)            │ world.render()
                                   │ blit Three.js → regl FBO
                                   ▼
                                 FBORenderer (regl, WebGL2)
```

The `CyberdancerRenderer` owns a stripped-down `World` instance managing the Three.js scene, camera, characters, and animation loop. It has no DOM, no GUI panel, no voice controller.

---

## Message API

The node speaks the same protocol as the `opencyberdance-embed` iframe bridge, translated into native Patchies messages.

### Inlets

**Inlet 0 — control (message)**

All control messages arrive here. Each message is an object with a `type` field:

#### Dancer selection

```js
{ type: 'dancer:select', dancer: 'female:3' }
// dancer: 'male:1'–'male:9', 'female:1'–'female:9'
```

Loads the corresponding GLB model from `https://opencyberdance.pages.dev/v2-models/{gender}-{n}.glb`. Triggers `animation:started` output when ready.

#### Transport

```js
{ type: 'transport:play' }
{ type: 'transport:pause' }
{ type: 'transport:seek',  time: number }    // seconds
{ type: 'transport:speed', percent: number } // 0–300 (100 = normal)
```

#### Parameters

```js
{ type: 'param:energy',    part: 'upper' | 'lower' | 'reset', percent: number }  // 0–300
{ type: 'param:curve',     part: 'body' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg' | 'all', percent: number } // 0–100
{ type: 'param:shifting',  part: 'left' | 'right' | 'body', percent: number }    // 0–100
{ type: 'param:space',     percent: number } // 0–100
{ type: 'param:axis',      percent: number } // 0–120
{ type: 'param:rotations', axis: 'x' | 'y' | 'z' | 'all' | 'reset', percent: number } // 0–300
{ type: 'reset' }
```

#### Frame capture control

```js
{ type: 'frame:start', mode: 'locked' | number }  // 'locked' = every frame; number = target fps
{ type: 'frame:stop' }
```

In Patchies the video outlet is always active (it outputs every frame from the FBO pipeline). `frame:start/stop` instead gates whether `frame` messages are additionally sent on the **message outlet** as `ImageBitmap` payloads, for use cases where downstream nodes want raw bitmaps.

### Outlets

**Outlet 0 — video (video)**

Native FBO video output. Plugs into the standard Patchies rendering pipeline (Hydra, GLSL, bg.out, etc.).

**Outlet 1 — events (message)**

Emits status events:

```js
{ type: 'animation:started', dancer: string }  // fired after load or dancer:select completes
{ type: 'animation:stopped' }                  // fired on transport:pause
{ type: 'dancer:select',     dancer: string }  // fired whenever active dancer changes
{ type: 'frame', bitmap: ImageBitmap, timestamp: number }  // only when frame:start is active
```

---

## Implementation

### CyberdancerRenderer (rendering worker)

New file: `src/workers/rendering/cyberdancerRenderer.ts`

Mirrors the structure of `ThreeRenderer`:

```ts
export class CyberdancerRenderer {
  public config: CyberdancerConfig;
  public renderer: FBORenderer;
  public framebuffer: regl.Framebuffer2D | null = null;

  // Three.js instances (shared GL context)
  private THREE: typeof import('three') | null = null;
  private threeWebGLRenderer: import('three').WebGLRenderer | null = null;
  private renderTarget: import('three').WebGLRenderTarget | null = null;

  // Opencyberdance engine (stripped World)
  private world: CyberdanceWorld | null = null;

  static async create(config, framebuffer, renderer): Promise<CyberdancerRenderer>

  renderFrame(params: RenderParams): void
    // → world.tick(delta) → blit renderTarget → regl FBO (same as ThreeRenderer.blitToReglFramebuffer)

  handleMessage(message: Message): void
    // → routes { type, ... } to world methods

  emitEvent(event: object): void
    // → self.postMessage({ type: 'sendMessageFromNode', fromNodeId, data: event, outlet: 1 })

  destroy(): void
}
```

#### renderFrame internals

```ts
renderFrame(params: RenderParams) {
  if (!this.world || !this.threeWebGLRenderer || !this.renderTarget) return;

  this.threeWebGLRenderer.setRenderTarget(this.renderTarget);
  this.world.tick(params.clock.delta); // updates mixers, bone rotations

  this.threeWebGLRenderer.render(this.world.scene, this.world.camera);
  this.blitToReglFramebuffer(); // identical to ThreeRenderer

  this.threeWebGLRenderer.resetState();
  this.renderer.regl._refresh();

  // Optional bitmap emit for frame:start mode
  if (this.world.isCapturing) {
    this.emitFrame();
  }
}
```

### CyberdanceWorld (stripped engine)

New file: `src/workers/rendering/cyberdance/world.ts`

The `World` class from opencyberdance-embed, stripped of all DOM/UI concerns:

| Removed | Replacement |
|---|---|
| `Panel` + lil-gui | Direct handler wiring in constructor |
| `VoiceController` | Deleted |
| `Stats` | Deleted |
| `fadeIn()` / `fadeOut()` — DOM class manipulation | No-ops (instant teardown) |
| `window.innerWidth/Height` | Fixed size from `renderer.outputSize` |
| `window.world = this` | Deleted |
| `addResizeHandler()` | Receives `resize` message from worker |
| `soundManager` (ding.ts) | Stub (no-op) |
| `updateDebugLogCamera()` | Deleted |
| `addSeekBarUpdater()` | Deleted (seek state tracked internally) |
| nanostores (`$currentScene`, `$duration`, `$time`) | Replaced with plain instance fields |

What remains: scene setup, camera, lights, character management, `updateParams()`, `tick()`.

#### Asset loading

The preloader resolves model paths as:

```ts
const BASE_URL = 'https://opencyberdance.pages.dev';

// 'v2-models/male-1.glb' → 'https://opencyberdance.pages.dev/v2-models/male-1.glb'
const path = `${BASE_URL}/${source}`;
```

DRACO decoder stays on `https://www.gstatic.com/draco/v1/decoders/` (CDN, works from worker).

### FBORenderer integration

`src/workers/rendering/fboRenderer.ts`:

```ts
// In buildFBOs() match:
.with({ type: 'cyberdancer' }, (node) => this.createCyberdancerRenderer(node, framebuffer))

// New map:
public cyberdancerByNode = new Map<string, CyberdancerRenderer | null>();

// New method:
async createCyberdancerRenderer(node: RenderNode, framebuffer): Promise<RenderFunction> {
  const renderer = await CyberdancerRenderer.create(
    { nodeId: node.id },
    framebuffer,
    this
  );
  this.cyberdancerByNode.set(node.id, renderer);

  return (params) => renderer.renderFrame(params);
}
```

### renderWorker.ts

Add message handler for forwarding control messages into the renderer:

```ts
.with('sendMessageToNode', () =>
  fboRenderer.sendMessageToNode(data.nodeId, data.message)
)
// already exists — no change needed; CyberdancerRenderer.handleMessage() is
// called via fboRenderer.sendMessageToNode() → same path as Three/Canvas nodes
```

### CyberdancerNode.svelte

Node component in `src/lib/components/nodes/`:

- **Single inlet**: message (control)
- **Two outlets**: video (index 0), message/events (index 1)
- No code editor — fully data-driven by messages
- Shows current dancer name and play/pause state as node label
- Dropdown to select dancer directly from the node UI (sends `dancer:select` internally)

```svelte
<script lang="ts">
  let { id, data } = $props();

  let dancer = $state(data.dancer ?? 'male:1');
  let isPlaying = $state(false);

  // Forward dancer selection to rendering worker
  $effect(() => {
    sendToWorker(id, { type: 'dancer:select', dancer });
  });

  // Listen for events from outlet 1
  onMessage((msg) => {
    if (msg.type === 'animation:started') isPlaying = true;
    if (msg.type === 'animation:stopped') isPlaying = false;
  });
</script>
```

---

## Source Files to Port

From `.references/opencyberdance-embed/src/`:

| File | Action |
|---|---|
| `character.ts` | Port as-is — pure animation logic |
| `overrides.ts` | Port as-is — keyframe math |
| `transforms.ts` | Port as-is |
| `keyframes.ts` | Port as-is |
| `math.ts` | Port as-is |
| `parts.ts` | Port as-is |
| `bones.ts` | Port as-is |
| `bone-rotation.ts` | Port as-is |
| `postures.ts` | Port as-is |
| `floats.ts` | Port as-is |
| `analyze.ts` | Port as-is |
| `camera.ts` | Port as-is (presets only, no DOM) |
| `dispose.ts` | Port as-is |
| `utils.ts` | Port as-is (delay, debounce) |
| `types.ts` | Port as-is |
| `freeze.ts` | Port as-is |
| `preloader.ts` | Port with URL base change |
| `command.ts` | Port — strip voice/log, keep param math |
| `switch-dance.ts` | Port — strip fadeIn/fadeOut DOM calls |
| `world.ts` | Port — major strip (see table above) |
| `ik/` | Port as-is |
| `step-input.ts` | Port types only (ChoiceKey) |
| `panel.ts` | **Delete** |
| `voice.ts` | **Delete** |
| `ding.ts` | **Delete** (or stub) |
| `plotter.ts` | **Delete** |
| `fps.ts` | **Delete** |
| `perf.ts` | Keep `profile()` utility or delete |
| `prompt.ts`, `prompts.ts` | **Delete** |
| `store/*.ts` | Replace with plain fields on World |
| `iframe-bridge.ts` | **Delete** — replaced by CyberdancerRenderer.handleMessage |
| `view/*.vue` | **Delete** |
| `embed-params.ts` | **Delete** |
| `main.ts` | **Delete** |

All ported files live in `src/workers/rendering/cyberdance/`.

---

## Files to Create

```
src/workers/rendering/
├── cyberdancerRenderer.ts         # Main renderer class (mirrors threeRenderer.ts)
└── cyberdance/
    ├── world.ts                   # Stripped World
    ├── character.ts
    ├── overrides.ts
    ├── transforms.ts
    ├── keyframes.ts
    ├── parts.ts
    ├── camera.ts
    ├── preloader.ts               # URL base → opencyberdance.pages.dev
    ├── command.ts
    ├── switch-dance.ts
    ├── math.ts
    ├── bones.ts
    ├── bone-rotation.ts
    ├── postures.ts
    ├── floats.ts
    ├── analyze.ts
    ├── dispose.ts
    ├── utils.ts
    ├── types.ts
    ├── freeze.ts
    └── ik/
        ├── ccd-ik.ts
        ├── ccd-ik-helper.ts
        └── ik.ts

src/lib/components/nodes/
└── CyberdancerNode.svelte

static/content/objects/
└── cyberdancer.md
```

## Files to Modify

- `src/workers/rendering/fboRenderer.ts` — add `cyberdancerByNode`, `createCyberdancerRenderer()`, `{ type: 'cyberdancer' }` match arm
- `src/lib/nodes/node-types.ts` — add `'cyberdancer'`
- `src/lib/nodes/defaultNodeData.ts` — default config `{ dancer: 'male:1' }`
- `src/lib/components/object-browser/get-categorized-objects.ts` — add to Visual category
- `src/lib/ai/object-descriptions-types.ts` — add to type list
- `src/lib/ai/object-prompts/index.ts` — register prompt

---

## Design Decisions

| Aspect | Decision |
|---|---|
| Asset hosting | Remote from `https://opencyberdance.pages.dev` — zero bundling |
| DRACO decoder | CDN `gstatic.com` — works from web worker |
| GL context sharing | Shared with regl (same as ThreeRenderer) |
| Fade transitions | Removed — instant teardown/setup |
| Panel / GUI | Removed — all control via messages |
| Voice | Removed |
| `reset` command | Resets params + reloads character; no voice/fade |
| `config` message | `hideUI` / `cameraControl` → no-ops; `silenceDing` → no-op |
| `frame:start/stop` | Gates bitmap messages on outlet 1; video outlet always live |
| Event outlet | outlet 1 emits `animation:started`, `animation:stopped`, `dancer:select` |
| Node UI | Dancer picker dropdown + play state indicator; no code editor |
