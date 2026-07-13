---
name: patchies-rendering
description: Use when changing Patchies rendering pipeline, render graph, image generation preview capture, GLSystem, render workers, FBO rendering, output sizing, render-node types, or video previews.
---

# Patchies Rendering

## Architecture

Rendering changes usually cross the main thread, render worker, object modules, and tests.

- `ui/src/lib/canvas/GLSystem.ts` owns the main-thread bridge to the render worker, node/edge graph updates, preview canvas delivery, output sizing, worker requests, VFS shader invalidation, and capture-preview requests.
- `ui/src/workers/rendering/renderWorker.ts` dispatches worker messages and delegates rendering work to `FBORenderer`.
- `ui/src/workers/rendering/fboRenderer.ts` owns FBO allocation, renderer creation, render graph execution, preview readback, feedback textures, output sizing, and capture bitmaps.
- `ui/src/lib/rendering/graphUtils.ts` builds the render graph, parses video handles, detects back-edges, and identifies `bg.out`.
- `ui/src/lib/rendering/types.ts` is the shared registry/primitives file for render graph types.

## Render-Node Ownership

Object-specific render-node discriminated unions belong in `ui/src/objects/<object>/render-types.ts`.

Keep `ui/src/lib/rendering/types.ts` as a registry and shared primitive surface:

- Import object-owned render types into the central `RenderNode` union.
- Keep shared renderer primitives there, such as `FBOFormat`, `FBOResolution`, `RenderGraph`, `FBONode`, worker message types, and render params.
- Do not author object-specific variants like `type: 'glsl'` or `type: 'hydra'` directly in the shared file.

## Capture And Preview

Image-generation and export-style capture flows coordinate across:

- `generateImageWithGemini`
- `capturePreviewFrame`
- `GLSystem.send('capturePreview', ...)`
- `renderWorker`'s `capturePreview` handler
- `FBORenderer.capturePreviewBitmap()`

Preserve the `customSize?: [number, number]` pattern across this path.

Preview performance work usually touches `FlowCanvasInner.svelte`, preview visibility stores, `GLSystem.setVisibleNodes()`, `GLSystem.setPreviewScaleMultiplier()`, `PreviewRenderer`, and `FBORenderer`.

## Change Strategy

- Trace the full render path before patching one file.
- Keep object-specific rendering behavior in the owning object module when possible.
- Update focused tests for the affected layer. Common rendering checks include `src/workers/rendering/cooking/policies.test.ts`, `src/workers/rendering/renderEligibility.test.ts`, and `src/lib/rendering/graphUtils.test.ts`.
- Run `git diff --check` after edits.
