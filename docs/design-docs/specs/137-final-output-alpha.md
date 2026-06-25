# 137. Final Output Alpha

## Problem

Node previews preserve alpha because they read node FBO pixels into `ImageData`, then create an `ImageBitmap` from a 2D canvas. The background output path is different: it blits the selected FBO into the worker's WebGL drawing buffer and transfers that canvas with `transferToImageBitmap()`.

The worker WebGL context used browser defaults, including `premultipliedAlpha: true`. Patchies render nodes output straight alpha from shaders and FBOs. When straight-alpha pixels are presented through a premultiplied-alpha drawing buffer, feathered edges can look solid because RGB is interpreted as already multiplied by alpha.

## Design

Create the worker WebGL context with explicit alpha settings:

- `alpha: true` so the drawing buffer has an alpha channel.
- `premultipliedAlpha: false` because Patchies FBO content is straight alpha.

The final presentation pass converts internal straight-alpha node output into
premultiplied-alpha pixels for the browser-visible `ImageBitmap`:

```typescript
vec4 color = texture(sourceTexture, sourceUv);
fragColor = vec4(color.rgb * color.a, color.a);
```

This keeps alpha transparent while preventing hidden RGB in fully transparent
pixels from leaking through `bitmaprenderer` presentation. Internal FBOs and
node-to-node video textures remain straight-alpha.

## Files affected

| File                                                        | Change                                      |
| ----------------------------------------------------------- | ------------------------------------------- |
| `ui/src/workers/rendering/fboRenderer.ts`                   | Use explicit straight-alpha WebGL settings. |
| `ui/src/workers/rendering/finalOutputPresentation.ts`       | Premultiply final output pixels for presentation. |
| `ui/src/lib/components/BackgroundOutputCanvas.svelte`       | Request an alpha-capable background bitmap renderer. |
| `ui/src/routes/output/+page.svelte`                         | Request alpha-capable output-window bitmap renderers. |

## What does NOT change

- Preview readback behavior.
- FBO formats or node renderers.
- Background cover-mode crop behavior.
- Output routing to background or secondary screen.
