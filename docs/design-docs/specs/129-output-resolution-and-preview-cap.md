# 129. Output Resolution and Preview Cap

## Problem

After the spec 128 refactor decoupled preview size from background size, the default FBO resolution stayed at `DEFAULT_OUTPUT_SIZE` (1008x654). When the background output is enabled, the FBO content is upscaled via `blitFramebuffer` with `gl.LINEAR` to fill the screen. This produces noticeably blurry output compared to the pre-refactor behavior, where FBOs rendered at native screen resolution.

The pre-refactor code had `BackgroundOutputCanvas` call `setOutputSize(window.innerWidth, window.innerHeight)`, which set FBOs, previews, and the offscreen canvas all to screen dimensions. This gave crisp output but meant preview aspect ratios changed on different screens — the exact problem spec 128 solved.

### Why we can't just call setOutputSize(screenW, screenH) automatically

Calling `setOutputSize` with screen dimensions has cascading effects:

1. **Worker `this.outputSize`** changes — `resolveNodeSize(undefined)` returns screen dims, so all FBOs render at screen aspect ratio.
2. **`outputSizeStore`** updates — node components (ThreeNode, JSCanvasNode, etc.) read `$outputWidth`/`$outputHeight` for canvas backing resolution, changing their render aspect ratio.
3. **`previewSizeStore`** updates — preview display dimensions change.
4. **`fboNode.previewSize`** in the worker changes — preview readback bitmaps get screen aspect ratio.

All four must agree on aspect ratio, or content gets stretched/squished. When they all use screen dims, everything is consistent (pre-refactor behavior). When some use DEFAULT and others use screen dims, distortion occurs.

### The fundamental tension

- **Crisp output** requires FBOs at screen resolution → FBO content has screen aspect ratio.
- **Fixed preview aspect ratio** requires previews at DEFAULT aspect ratio → preview dimensions don't match FBO content.
- **Previews are readbacks of FBOs** → if FBO and preview have different aspect ratios, content is distorted.

On any **single screen**, setting everything to screen dims produces consistent, crisp, undistorted results. The spec 128 concern about different screens seeing different preview layouts is a real issue for shared patches, but for single-user workflows the pre-refactor behavior is correct.

### DPR compounds the problem

Even if FBOs matched `window.innerWidth × window.innerHeight`, the output would still be blurry on Retina displays. The offscreen canvas and visible `BackgroundOutputCanvas` both use CSS pixel dimensions, not device pixels. On a 2x DPR display (e.g., 1440x900 CSS → 2880x1800 device), the browser upscales the canvas 2x — producing the same softness as a low-res image stretched to fill the screen.

Other parts of the app handle DPR correctly (waveform renderer, timeline ruler, scope node), but the main GL rendering pipeline does not. The `Nx` multiplier command (section 2) addresses this by letting users render at `2x` (or `window.devicePixelRatio + "x"`) to match their display's native resolution.

### Preview size scaling problem

When `outputSize` is set to screen dimensions (e.g., 1800x1200), the preview becomes `outputSize / PREVIEW_SCALE_FACTOR` = 450x300. On large/retina screens, this makes node previews excessively large on the xyflow canvas. The original 1008x654 default produced 252x164 previews — a reasonable thumbnail size. Screens larger than that produce previews that dominate the canvas.

## Design

### 1. "auto" output size command

Add `auto` as a recognized input in the "Set Output Size" command palette. Typing `auto` calls:

```typescript
glSystem.setOutputSize(window.innerWidth, window.innerHeight)
```

This sets FBOs, previews, and the offscreen canvas to screen dimensions — functionally identical to the pre-refactor behavior. Output is crisp. Previews match screen aspect ratio.

When the command palette opens "Set Output Size", the prefill should show `auto` when the current output size matches `window.innerWidth x window.innerHeight`, and `WxH` otherwise.

### 2. DPR multiplier command ("2x")

Add `Nx` as a recognized input format (e.g., `2x`, `1.5x`, `0.5x`). This multiplies `window.innerWidth/Height` by the given factor:

```typescript
const width = Math.round(window.innerWidth * multiplier)
const height = Math.round(window.innerHeight * multiplier)
glSystem.setOutputSize(width, height)
```

This allows rendering at native retina resolution (`2x` on a 2x DPR display) or at reduced resolution for performance (`0.5x`). The multiplier should be clamped to `[0.5, 4]` and the resulting dimensions must not exceed 8192 per axis.

The validation hint should show the computed pixel dimensions: `2x (2880x1800)`.

### 3. Preview size cap

Add a `capPreviewSize(width, height)` function that constrains preview dimensions to fit within `MAX_PREVIEW_SIZE` (252x164) while preserving aspect ratio:

```typescript
const MAX_PREVIEW_SIZE: [number, number] = [252, 164]

function capPreviewSize(width: number, height: number): [number, number] {
  const [maxW, maxH] = MAX_PREVIEW_SIZE
  if (width <= maxW && height <= maxH) return [width, height]
  const scale = Math.min(maxW / width, maxH / height)
  return [
    Math.max(1, Math.floor(width * scale)),
    Math.max(1, Math.floor(height * scale)),
  ]
}
```

This is applied in three places:

| Location                                          | What it caps                                        |
| ------------------------------------------------- | --------------------------------------------------- |
| `GLSystem.setOutputSize()`                        | `previewSizeStore` update                           |
| `getPreviewSizeForResolution()` in `constants.ts` | Per-node preview size (main thread components)      |
| `buildFBOs()` in `fboRenderer.ts`                 | `fboNode.previewSize` (worker readback bitmap size) |

Examples:

| Output size | Raw preview (÷4) | After cap           |
| ----------- | ---------------- | ------------------- |
| 1008x654    | 252x164          | 252x164 (unchanged) |
| 1440x900    | 360x225          | 184x115             |
| 1920x1080   | 480x270          | 153x86              |
| 2880x1800   | 720x450          | 92x58               |
| 512x512     | 128x128          | 128x128 (unchanged) |
| 256x256     | 64x64            | 64x64 (unchanged)   |

Note: the cap preserves the **source** aspect ratio, which matches the FBO/screen aspect ratio. This means previews on a 16:9 screen look slightly different from previews on a 16:10 screen, but the content is never distorted.

### 4. setBackgroundSize remains viewport-only

`setBackgroundSize` continues to only set `backgroundSize` in the worker (used for cover-mode blit calculation in `renderNodeToMainOutput`). It does NOT resize the offscreen canvas, rebuild FBOs, or update hydra renderers. The offscreen canvas is resized by `setOutputSize`.

### 5. renderNodeToMainOutput uses outputSize

The blit destination in `renderNodeToMainOutput` must use `this.outputSize` (not `this.backgroundSize`) since `outputSize` controls the offscreen canvas dimensions. Using `backgroundSize` causes the bottom-left rendering bug when the two differ.

## Architecture after this spec

```
setOutputSize(w, h)          — sets EVERYTHING: outputSize, offscreenCanvas,
                               FBOs, hydra, projmap, stores, previews
setBackgroundSize(w, h)      — sets backgroundSize only (for cover-mode blit math)
```

`BackgroundOutputCanvas` calls `setBackgroundSize` on mount/resize (viewport tracking).
User triggers `setOutputSize` via command palette (auto, Nx, or WxH).
`PatchManager` calls `setOutputSize` on patch load (from saved settings or DEFAULT).

## Files affected

| File                                               | Change                                                                                             |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/lib/canvas/constants.ts`                      | Add `MAX_PREVIEW_SIZE`, `capPreviewSize()`                                                         |
| `src/lib/canvas/GLSystem.ts`                       | Apply `capPreviewSize` in `setOutputSize`                                                          |
| `src/workers/rendering/fboRenderer.ts`             | Apply `capPreviewSize` to `fboNode.previewSize`, use `this.outputSize` in `renderNodeToMainOutput` |
| `src/lib/components/CommandPalette.svelte`         | Add `auto` and `Nx` input handling                                                                 |
| `src/lib/components/BackgroundOutputCanvas.svelte` | Call `setBackgroundSize` only (no `setOutputSize`)                                                 |

## What does NOT change

- `DEFAULT_OUTPUT_SIZE` (1008x654) — still the default FBO resolution on fresh patches
- `PREVIEW_SCALE_FACTOR` (4) — still the base divisor
- Per-node `@resolution` / `setResolution()` API — works the same
- Spec 128's cover-mode blit — still used for background display
- Patch save format — `outputSize` is already saved in settings

## Interaction with spec 128

This spec builds on spec 128's decoupling. The key clarification:

- Spec 128 decoupled **background display size** from **node preview size** — this remains correct.
- This spec adds the ability for users to set `outputSize` to screen dimensions for crisp output, accepting that preview aspect ratio will match the screen.
- The preview cap prevents excessively large previews on big screens.
- On patch load, `outputSize` restores from saved settings (or DEFAULT). The user must re-apply "auto" if they want screen-matched resolution.
