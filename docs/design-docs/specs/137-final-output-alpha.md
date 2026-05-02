# 137. Final Output Alpha

## Problem

Node previews preserve alpha because they read node FBO pixels into `ImageData`, then create an `ImageBitmap` from a 2D canvas. The background output path is different: it blits the selected FBO into the worker's WebGL drawing buffer and transfers that canvas with `transferToImageBitmap()`.

The worker WebGL context used browser defaults, including `premultipliedAlpha: true`. Patchies render nodes output straight alpha from shaders and FBOs. When straight-alpha pixels are presented through a premultiplied-alpha drawing buffer, feathered edges can look solid because RGB is interpreted as already multiplied by alpha.

## Design

Create the worker WebGL context with explicit alpha settings:

- `alpha: true` so the drawing buffer has an alpha channel.
- `premultipliedAlpha: false` because Patchies FBO content is straight alpha.

The final blit still uses the existing GPU path:

```typescript
gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceFbo);
gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
gl.blitFramebuffer(...);
```

This keeps output transfer zero-copy while making the background path match preview semantics.

## Files affected

| File                                   | Change                                      |
| -------------------------------------- | ------------------------------------------- |
| `src/workers/rendering/fboRenderer.ts` | Use explicit straight-alpha WebGL settings. |

## What does NOT change

- Preview readback behavior.
- FBO formats or node renderers.
- Background cover-mode crop behavior.
- Output routing to background or secondary screen.
