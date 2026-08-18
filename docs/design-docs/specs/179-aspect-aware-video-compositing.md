# 179. Aspect-Aware Video Compositing

## Problem

Patchies video sources can have different native dimensions. A normal GLSL
sampler maps the source's full UV range to the consumer's full output FBO, so
an image becomes stretched when its aspect ratio differs from the patch output.
`send.vdo` and `recv.vdo` also resample their input through a full-output FBO,
which changes a source even when they are only used for routing.

## Goals

- Preserve a source texture's native dimensions while it is routed through a
  patch.
- Let users intentionally fit, transform, and alpha-composite mixed-aspect
  sources.
- Keep existing shaders' normalized-UV behaviour unchanged.

## Design

### Explicit placement

The built-in **Fit** and **Transform** GLSL presets derive the source aspect
from `textureSize(source, 0)`. They offer explicit stretch, contain, and cover
behaviour; Transform also applies translation, scale, and rotation in an
aspect-correct coordinate system. Pixels outside a contained source are
transparent, so the existing **Over** and **Composite** presets can layer it
over another video input.

### Routing aliases

`send.vdo` and `recv.vdo` are routing nodes, not image-processing nodes. The
renderer resolves their inlet texture recursively and binds that texture to a
downstream consumer. They do not copy or rescale a frame into their own FBO.

When a routing node is selected as the patch output, the renderer uses the
same resolved source texture.

### Output resolution

Normal effect nodes continue to render at their configured FBO resolution,
which defaults to the patch output. Preserving a routed source's native
dimensions does not implicitly change an effect node's output resolution.
Future input-resolution FBO modes and a dedicated multi-layer node can build
on this contract without changing existing shaders.

## Acceptance Criteria

1. A non-16:9 image can pass through `send.vdo` and `recv.vdo` without a
   dimension-changing blit.
2. Fit and Transform can contain or cover a source without an `inputAspect`
   setting.
3. A contained Transform produces transparent margins that compose correctly
   with Over and Composite.
4. Existing shaders that sample `texture(source, uv)` retain their current
   full-frame behaviour.
