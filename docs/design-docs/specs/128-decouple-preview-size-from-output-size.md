# 128. Decouple Preview Size from Output Size

## Problem

Node preview dimensions and background output size are currently coupled through
a single `outputSize` property. When `BackgroundOutputCanvas` sets `outputSize` to
`window.innerWidth × window.innerHeight`, it changes **every** node's preview
aspect ratio — breaking patch layouts on different screen sizes.

**Concrete example:** A patch built on desktop (16:9) viewed on a mobile phone (9:16):

- Background should fill the phone screen → needs 390×844 output
- But this makes every node preview 97×211 (tall and narrow), breaking the patch layout

## Design

### Three independent size concepts

| Concept               | Source of truth                                                        | What uses it                                      |
| --------------------- | ---------------------------------------------------------------------- | ------------------------------------------------- |
| **Node FBO size**     | Per-node `@resolution` / `setResolution()`, else `DEFAULT_OUTPUT_SIZE` | FBO texture allocation, shader rendering          |
| **Node preview size** | `nodeFBOSize / PREVIEW_SCALE_FACTOR`                                   | Preview canvas element dimensions, pixel readback |
| **Background size**   | `window.innerWidth × window.innerHeight`                               | Background canvas element, final blit target      |

The key change: **preview size derives from the node's own FBO resolution, not from the global output size.**
The background size is only used for the final display blit.

### Background display: cover mode

When a node renders to background, its FBO (at the node's own resolution)
is scaled to fill the viewport:

- **Cover** (default): Scale up to fill, crop overflow. A 16:9 patch on a
  9:16 phone crops top/bottom. No black bars.
- The aspect ratio mismatch is handled at the display layer, not the render layer.

### Per-node preview sizes

Since each node can have its own FBO resolution, preview sizes naturally vary:

| Node config           | FBO size | Preview size (÷4) |
| --------------------- | -------- | ----------------- |
| Default (no override) | 1008×654 | 252×164           |
| `@resolution 256`     | 256×256  | 64×64             |
| `@resolution 512x256` | 512×256  | 128×64            |
| `@resolution 1/2`     | 504×327  | 126×82            |

This already works conceptually — `@resolution 256` nodes render square
FBOs. The change is that the **preview** also becomes square, instead of
always matching the global aspect ratio.

## Changes required

### 1. `GLSystem.ts` — decouple properties

**Current:**

```typescript
public outputSize = DEFAULT_OUTPUT_SIZE;
public previewSize: [number, number] = [
  this.outputSize[0] / PREVIEW_SCALE_FACTOR,
  this.outputSize[1] / PREVIEW_SCALE_FACTOR
];
```

**After:** Remove the global `previewSize` property. It no longer makes sense
as a single value since each node may have a different preview size. Keep
`outputSize` as the default FBO resolution (unchanged from `DEFAULT_OUTPUT_SIZE`).

`setOutputSize()` becomes `setBackgroundSize()` — only affects the background
canvas blit target, not FBO allocation or previews.

### 2. `fboRenderer.ts` — per-node preview sizes

**Current:** `resolveNodeSize()` returns the FBO size.
Preview size is a single global value.

**After:** When building FBOs, also compute and store each node's preview
size as `resolveNodeSize(resolution) / PREVIEW_SCALE_FACTOR`.
The `PreviewRenderer` reads this per-node preview size instead of the global one.

`setOutputSize()` stops rebuilding all FBOs. Instead, add `setBackgroundSize()`
that only updates the offscreen canvas and background blit dimensions.

### 3. `BackgroundOutputCanvas.svelte` — call setBackgroundSize

**Current:** Calls `glSystem.setOutputSize(window.innerWidth, window.innerHeight)`.

**After:** Calls `glSystem.setBackgroundSize(window.innerWidth, window.innerHeight)`.
This only resizes the background canvas, not any FBOs or previews.

### 4. `PreviewRenderer.ts` — use per-node preview size

**Current:** Falls back to `this.service.previewSize` (global).

**After:** Each FBO node stores its own preview size. `initiateAsyncRead` uses
the node's stored preview size. The `getCustomSize` callback (currently only
used for canvas nodes) can be removed or simplified.

### 5. Node components — read per-node preview size

**Current:** Nodes read `glSystem.previewSize` (e.g., `GLSLCanvasNode.svelte:54-55`).

**After:** Nodes compute their preview size from their own resolution setting:

- If node has `@resolution` or `setResolution()`: use that ÷ `PREVIEW_SCALE_FACTOR`
- Otherwise: use `DEFAULT_OUTPUT_SIZE / PREVIEW_SCALE_FACTOR` (same as today's default)

This could be a helper: `getNodePreviewSize(resolution?: FBOResolution): [number, number]`.

### 6. Hydra renderer — decouple from background resize

**Current:** `setOutputSize()` in fboRenderer calls `hydra.setResolution(width, height)`
for all Hydra instances, resizing them to the background size.

**After:** Hydra renderers keep their resolution at `DEFAULT_OUTPUT_SIZE` (or per-node
override). They don't resize when the background changes.

## Files affected

| File                                               | Change scope                                                                                                   |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/lib/canvas/GLSystem.ts`                       | Remove global `previewSize`, add `setBackgroundSize()`, keep `setOutputSize()` for FBO default only            |
| `src/workers/rendering/fboRenderer.ts`             | Store per-node preview size in `FBONode`, add `setBackgroundSize()`, stop rebuilding FBOs on background resize |
| `src/workers/rendering/PreviewRenderer.ts`         | Read per-node preview size from `FBONode` instead of global                                                    |
| `src/workers/rendering/PixelReadbackService.ts`    | Remove global `previewSize` field                                                                              |
| `src/lib/components/BackgroundOutputCanvas.svelte` | Call `setBackgroundSize()` instead of `setOutputSize()`                                                        |
| `src/lib/components/nodes/GLSLCanvasNode.svelte`   | Derive preview size from node's resolution, not global                                                         |
| `src/lib/components/nodes/HydraNode.svelte`        | Same                                                                                                           |
| `src/lib/components/nodes/ThreeNode.svelte`        | Same                                                                                                           |
| Other GL node components (Regl, SwissGL, etc.)     | Same pattern                                                                                                   |

## What does NOT change

- `DEFAULT_OUTPUT_SIZE` constant — still the default FBO resolution
- `PREVIEW_SCALE_FACTOR` constant — still the divisor
- Per-node `@resolution` / `setResolution()` API — works the same
- Node data schema — resolution is already stored per-node
- `CanvasPreviewLayout.svelte` — still receives width/height props, doesn't care
  where they come from

## Migration

No user-facing migration needed. Patches load the same way. The only visible change:

- Nodes with `@resolution 256` will preview as square (64×64) instead of the current global aspect ratio
- Background output no longer distorts node previews on different screens

## Decisions

1. **Fractional resolutions (`1/2`, `1/4`)** are relative to `DEFAULT_OUTPUT_SIZE` —
   stable and predictable across devices.

2. **Canvas nodes** currently have a `canvasOutputSize` hack (`outputSize / 2`) for sharper
   previews. Migrate this into the per-node preview size system so canvas nodes get sharper
   previews through the same mechanism.

3. **Non-pipeline nodes are out of scope.** P5, canvas.dom, three.dom, textmode.dom etc.
   are not part of the GL rendering pipeline — don't touch them.

4. **Remove `setPreviewSize()` on GLSystem** (line 826) — unused after this change since
   preview sizes are per-node.
