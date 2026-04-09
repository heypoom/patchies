# 124. Migrate from regl to twgl.js + Raw WebGL2

## Motivation

regl is a WebGL1 library. The rendering pipeline already works around its limitations extensively:

- **Extension shimming** — fboRenderer hacks `getExtension()` to fake WebGL1 extension names
- **Texture re-init** — creates textures via regl, then immediately re-initializes them with `gl.texImage2D(gl.RGBA16F, ...)` because regl doesn't support sized internal formats
- **MRT workarounds** — creates FBO via regl with 1 attachment, then manually attaches the rest via raw `gl.framebufferTexture2D()` + `gl.drawBuffers()`
- **Internal access hacks** — `getRawTexture()` and `getFramebuffer()` reach into regl internals (`_texture.texture`, `_framebuffer.framebuffer`)
- **State cache invalidation** — SwissGL renderer must call `regl._refresh()` after every frame because it manipulates GL state directly

We're fighting regl more than using it. Removing it eliminates a class of bugs, reduces bundle size, and gives us native access to WebGL2 features (MRT, sized formats, transform feedback, UBOs, etc.) without workarounds.

## Why twgl.js

We evaluated thin WebGL2 helper libraries. twgl.js (by Gregg Tavares, Chrome WebGL team) is the clear choice:

| Property | twgl.js | regl (current) |
|---|---|---|
| **Philosophy** | Stateless helper functions — pass `gl` to every call | Stateful framework with shadow state cache |
| **Bundle size** | ~5kb gzip (base) / ~12kb (full) | ~150kb unminified |
| **WebGL2** | Native — sized formats, MRT, VAOs, UBOs | WebGL1-designed, WebGL2 bolted on |
| **State cache** | **None** — every call goes straight to GL | Yes — causes conflicts with SwissGL/Three.js |
| **Shared context** | Safe — no state to go stale | Unsafe — requires `_refresh()` hacks |
| **Maintenance** | Stable, maintained by Chrome WebGL team member | Active but fundamentally WebGL1 |

**Key advantage**: twgl is purely functional. `createTexture(gl, options)`, `createFramebufferInfo(gl, attachments)`, `createProgramInfo(gl, shaders)` — no classes, no state, no magic. It coexists perfectly with SwissGL and Three.js on the same GL context.

**Alternatives rejected**:
- **PicoGL.js** — WebGL2-only (good) but has a state cache (bad) and unmaintained since 2022
- **luma.gl** — 80-100kb, heavy state tracking, designed for deck.gl not standalone use
- **OGL** — mini Three.js with scene graph, too high-level
- **Custom helper layer** — would replicate what twgl already provides, with more bugs

## Design Principles

1. **twgl for boilerplate, raw GL for control.** Use twgl's helpers for texture/FBO/program creation. Drop to raw `gl.*` calls when we need precise control (MRT attachment, float format selection, readback).
2. **Phased migration.** Each phase produces a working system. No big-bang rewrite.
3. **Thin wrapper types.** Define `FBOTexture` and `FBOFramebuffer` types that hold twgl/GL handles plus our metadata (format, size). These replace `regl.Texture2D` / `regl.Framebuffer2D` throughout the codebase.

## Scope

### regl API → twgl/GL Mapping

| regl API | Where | Replacement |
|---|---|---|
| `regl()` init | fboRenderer | Remove — just use `gl` directly |
| `regl.texture()` | fboRenderer, VideoTextureMgr, PixelReadback, Hydra | `twgl.createTexture(gl, options)` |
| `regl.framebuffer()` | fboRenderer, PixelReadback, Hydra | `twgl.createFramebufferInfo(gl, attachments)` |
| `regl.buffer()` | Hydra Output, ProjectionMap, shadertoy-draw | `twgl.createBufferInfoFromArrays(gl, arrays)` |
| `regl.elements()` | ProjectionMap | `twgl.createBufferInfoFromArrays(gl, { indices })` |
| `regl({...})` draw command | shadertoy-draw, Hydra, canvasRenderer, projMap | `twgl.createProgramInfo(gl, [vert, frag])` + `twgl.setUniforms()` + `twgl.drawBufferInfo()` |
| `regl.frame()` | fboRenderer | `requestAnimationFrame()` |
| `regl.prop()` | Hydra | Compute uniforms at draw time, pass to `twgl.setUniforms()` |
| `regl.clear()` | reglRenderer (wrapped) | `gl.clearColor()` + `gl.clear()` |
| `texture.subimage()` | Hydra Source | `gl.texSubImage2D()` or `twgl.setTextureFromElement()` |
| `texture({data})` reinit | Hydra Source, VideoTextureMgr | `twgl.setTextureFromElement()` or raw `gl.texImage2D()` |
| `framebuffer.use()` | swglRenderer, render loop | `twgl.bindFramebufferInfo(gl, fbi)` |
| `regl._gl` | swglRenderer | Direct `gl` reference (already available) |
| `regl._refresh()` | swglRenderer | Not needed — twgl has no state cache |
| `*.destroy()` | everywhere | `gl.deleteTexture()`, `gl.deleteFramebuffer()`, etc. |

### Files by Migration Phase

**Phase 1 — Core infrastructure** (no user-facing changes)
- `src/lib/rendering/types.ts` — replace `regl.Texture2D`, `regl.Framebuffer2D` with own types
- `src/workers/rendering/fboRenderer.ts` — remove regl init, use twgl + raw GL
- `src/workers/rendering/BaseWorkerRenderer.ts` — update `framebuffer` type
- `src/workers/rendering/PixelReadbackService.ts` — already mostly raw GL
- `src/workers/rendering/VideoTextureManager.ts` — already mostly raw GL
- `src/workers/rendering/utils.ts` — remove `getRawTexture()`, `getFramebuffer()` hacks

**Phase 2 — GLSL pipeline** (shadertoy-draw + canvasRenderer)
- `src/lib/canvas/shadertoy-draw.ts` — replace draw command with twgl program
- `src/workers/rendering/canvasRenderer.ts` — one texture + one draw command
- `src/workers/rendering/CaptureRenderer.ts` — temp FBO creation

**Phase 3 — Hydra fork**
- `src/lib/hydra/Hydra.ts` — replace regl init, draw commands, `regl.prop()`
- `src/lib/hydra/Output.ts` — ping-pong FBOs, draw command
- `src/lib/hydra/Source.ts` — texture management
- `src/lib/hydra/compiler/compileWithEnvironment.ts` — type updates
- `src/lib/hydra/compiler/generateGlsl.ts` — type updates

**Phase 4 — Remaining renderers + remove regl**
- `src/workers/rendering/reglRenderer.ts` — redesign as twgl-based GL node (see below)
- `src/objects/projmap/ProjectionMapRenderer.ts` — buffers, elements, draw command
- `src/workers/rendering/swglRenderer.ts` — remove `regl._refresh()`, use `twgl.bindFramebufferInfo()` directly
- Remove `regl` from `package.json`

## Type Migration

Replace regl types with thin wrappers holding twgl/GL handles plus metadata:

```typescript
// src/lib/rendering/types.ts

/** Wraps a WebGLTexture with format/size metadata. */
export interface FBOTexture {
  texture: WebGLTexture;
  width: number;
  height: number;
  format: FBOFormat;
}

/** Wraps a twgl FramebufferInfo with our metadata. */
export interface FBOFramebuffer {
  framebufferInfo: twgl.FramebufferInfo;
  /** Shortcut to the underlying WebGLFramebuffer for raw GL calls */
  framebuffer: WebGLFramebuffer;
}
```

All existing `regl.Texture2D` → `FBOTexture`, `regl.Framebuffer2D` → `FBOFramebuffer`.

## twgl Usage Patterns

### Texture Creation (replaces `regl.texture()`)

```typescript
// Before (regl + workaround for float formats)
const texture = this.regl.texture({ width, height, wrapS: 'clamp', wrapT: 'clamp' });
const rawTexture = getRawTexture(texture);
gl.bindTexture(gl.TEXTURE_2D, rawTexture);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);

// After (twgl — native sized format support)
const texture = twgl.createTexture(gl, {
  width, height,
  internalFormat: gl.RGBA16F,
  format: gl.RGBA,
  type: gl.HALF_FLOAT,
  wrap: gl.CLAMP_TO_EDGE,
  min: linearSupported ? gl.LINEAR : gl.NEAREST,
  mag: linearSupported ? gl.LINEAR : gl.NEAREST,
});
```

### FBO with MRT (replaces regl FBO + manual attachment hack)

```typescript
// Before (regl + raw GL workaround)
const framebuffer = this.regl.framebuffer({ color: colorAttachments[0], depthStencil: false });
const rawFramebuffer = getFramebuffer(framebuffer);
gl.bindFramebuffer(gl.FRAMEBUFFER, rawFramebuffer);
for (let i = 1; i < mrtCount; i++) {
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, getRawTexture(colorAttachments[i]), 0);
}
gl.drawBuffers(colorAttachments.map((_, i) => gl.COLOR_ATTACHMENT0 + i));

// After (twgl — native MRT)
const fbi = twgl.createFramebufferInfo(gl,
  colorAttachments.map(tex => ({ attachment: tex })),
  width, height
);
// twgl automatically calls gl.drawBuffers() for multiple attachments
```

### Draw Commands (replaces `regl({...})`)

```typescript
// Before (regl)
const draw = regl({
  frag: fragShader,
  vert: vertShader,
  attributes: { position: regl.buffer([[-1,-1], [1,-1], [-1,1], [1,1]]) },
  uniforms: { time: regl.prop('time'), resolution: regl.prop('resolution') },
  primitive: 'triangle strip',
  count: 4,
  framebuffer: fbo,
});
draw({ time: t, resolution: [w, h] });

// After (twgl)
const programInfo = twgl.createProgramInfo(gl, [vertShader, fragShader]);
const bufferInfo = twgl.createBufferInfoFromArrays(gl, {
  position: { numComponents: 2, data: [-1,-1, 1,-1, -1,1, 1,1] },
});

// Per frame:
gl.useProgram(programInfo.program);
twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
twgl.setUniforms(programInfo, { time: t, resolution: [w, h] });
twgl.drawBufferInfo(gl, bufferInfo, gl.TRIANGLE_STRIP);
```

### Render Loop (replaces `regl.frame()`)

```typescript
// Before
this.frameCancellable = this.regl.frame(() => { this.renderFrame(); });

// After
const loop = () => {
  if (!this.isAnimating) return;
  this.renderFrame();
  this.frameId = requestAnimationFrame(loop);
};
this.frameId = requestAnimationFrame(loop);
```

## User-Facing regl Node → GL Node

The regl node (`reglRenderer.ts`) was just added and isn't live yet. Replace with a twgl-based API:

```javascript
// User code in the "gl" node (backed by twgl internally)
const shader = await createShader({
  vert: `#version 300 es
    in vec2 position;
    void main() { gl_Position = vec4(position, 0, 1); }`,
  frag: `#version 300 es
    precision highp float;
    uniform float time;
    out vec4 fragColor;
    void main() {
      fragColor = vec4(sin(time), 0.5, 1.0, 1.0);
    }`,
  attributes: {
    position: { numComponents: 2, data: [-1,-1, 1,-1, -1,1, 1,1] }
  }
});

function render(time) {
  shader.draw({ time });
}
```

Internally, `createShader()` calls `twgl.createProgramInfo()` + `twgl.createBufferInfoFromArrays()` and returns an object with a `draw(uniforms)` method. This is:

- **AI-friendly** — standard GLSL 300 es, no magic syntax
- **Developer-friendly** — simpler than regl, no Proxy magic, standard WebGL2 shaders
- **`#include` compatible** — preprocessor works on frag/vert strings before compilation

The node type changes from `regl` → `gl`.

## Migration Strategy Per Phase

### Phase 1: Core Infrastructure

1. `bun add twgl.js` (add dependency)
2. Define `FBOTexture` / `FBOFramebuffer` wrapper types in `types.ts`
3. Migrate `fboRenderer.ts`:
   - Remove `import regl` and `this.regl = regl({...})` initialization
   - Replace `this.regl.texture()` → `twgl.createTexture(gl, ...)` — eliminates the create-then-reinit workaround for float formats
   - Replace `this.regl.framebuffer()` → `twgl.createFramebufferInfo(gl, ...)` — eliminates the MRT manual attachment hack
   - Replace `this.regl.frame()` → `requestAnimationFrame()` loop
   - Update all `this.regl` references to use `this.gl` + twgl helpers
4. Migrate `PixelReadbackService` — replace `this.regl.texture()` / `this.regl.framebuffer()` with twgl equivalents (minimal changes, already mostly raw GL)
5. Migrate `VideoTextureManager` — same pattern (already mostly raw GL)
6. Remove `utils.ts` hacks (`getRawTexture`, `getFramebuffer`) — no longer needed when we hold native GL handles directly
7. Update `BaseWorkerRenderer` — change `framebuffer: regl.Framebuffer2D` → `FBOFramebuffer`

**Validation**: All existing GLSL nodes render correctly. No user-facing changes.

### Phase 2: GLSL Pipeline

1. Migrate `shadertoy-draw.ts` — replace regl draw command with `twgl.createProgramInfo()` + `twgl.setUniforms()` + `twgl.drawBufferInfo()`
2. Migrate `canvasRenderer.ts` — one texture + one draw program
3. Migrate `CaptureRenderer.ts` — temp FBO creation via twgl

**Validation**: GLSL nodes, canvas nodes, and capture/export still work.

### Phase 3: Hydra Fork

1. Replace the regl instance in Hydra's environment with `gl` + twgl helpers
2. Migrate `Output.ts` — ping-pong `twgl.FramebufferInfo`s + `twgl.createProgramInfo()` for draw
3. Migrate `Source.ts` — `twgl.createTexture()` with `twgl.setTextureFromElement()` for updates
4. Migrate `Hydra.ts` — initialization, `renderFbo` draw command
5. Replace `regl.prop()` pattern — compute uniforms at draw time, pass to `twgl.setUniforms()`
6. Update compiler types (`DynamicVariable`, `Uniform` → plain types)

**Validation**: Hydra nodes render correctly, including multi-source and feedback.

### Phase 4: Remaining + Cleanup

1. Redesign regl node as `gl` node with twgl-backed `createShader()` + `draw()` API
2. Migrate `ProjectionMapRenderer` — `twgl.createBufferInfoFromArrays()` for geometry
3. Update `swglRenderer.ts` — remove `regl._refresh()` (not needed without state cache), use `twgl.bindFramebufferInfo()` directly
4. Remove `regl` from `package.json` and all `import type regl from 'regl'`
5. Remove `src/workers/rendering/utils.ts` if fully unused

**Validation**: All node types render correctly. `regl` no longer in bundle.

## What This Enables (Beyond Just Removing regl)

- **Native MRT** without workarounds — `twgl.createFramebufferInfo()` takes N attachments directly
- **Native float formats** without create-then-reinit — `twgl.createTexture()` with `internalFormat: gl.RGBA16F`
- **Transform feedback** for GPGPU (future spec 115/116) — accessible via raw GL
- **Uniform Buffer Objects** for shared uniforms across programs
- **No state cache conflicts** — twgl is stateless, SwissGL and Three.js coexist without `_refresh()` hacks
- **Smaller bundle** — replaces ~150KB regl with ~5-12KB twgl
- **Simpler debugging** — no regl internals to reason about, standard WebGL2 calls in devtools

## Risks

| Risk | Mitigation |
|---|---|
| Regression in rendering correctness | Phase-by-phase with validation at each step |
| Hydra compatibility | Our fork, full control. Test with complex Hydra patches |
| Performance regression from lost regl optimizations | regl's state diffing is actually overhead we don't need — we control render order. twgl has zero overhead (stateless helpers). |
| SwissGL interaction | SwissGL already uses raw GL; removing regl's state cache *reduces* conflicts |
| Three.js interaction | Three.js manages its own GL state; same argument as SwissGL |
| twgl.js maintenance risk | Extremely low — library is mature/stable, maintained by Chrome WebGL team member, essentially "done" |

## Non-Goals

- Building a custom GL abstraction layer on top of twgl
- WebGPU migration (separate spec 116)
- Changing the render graph architecture
- Migrating SwissGL itself (it's already raw GL)
