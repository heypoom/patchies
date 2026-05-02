The `regl` object gives you low-level GPU rendering with
[regl](https://github.com/regl-project/regl) draw commands. Runs on
the render worker for fast video chaining.

Use it when you need full control over vertices, buffers, elements, blend 
modes, or multi-pass rendering — things the `glsl` node can't do because it 
only exposes a fragment shader on a fullscreen quad.

## Getting Started

Define a `render(time)` function that gets called every frame.
The output framebuffer is already bound — just draw.

```javascript
const draw = await regl({
  vert: `
    precision mediump float;
    attribute vec2 position;
    varying vec2 uv;

    void main() {
      uv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0, 1);
    }
  `,
  frag: `
    precision mediump float;
    varying vec2 uv;
    uniform float time;

    void main() {
      gl_FragColor = vec4(
        sin(uv.x * 6.28 + time) * 0.5 + 0.5,
        sin(uv.y * 6.28 + time * 1.3) * 0.5 + 0.5,
        sin((uv.x + uv.y) * 3.14 + time * 0.7) * 0.5 + 0.5,
        1.0
      );
    }
  `,
  attributes: {
    position: [[-1,-1], [1,-1], [-1,1], [-1,1], [1,-1], [1,1]]
  },
  uniforms: {
    time: regl.prop('time'),
  },
  count: 6,
  depth: { enable: false },
})

function render(time) {
  regl.clear({ color: [0, 0, 0, 1] })

  draw({ time })
}
```

## How It Works

You write standard regl code — create draw commands with `regl({...})`,
allocate buffers with `regl.buffer()`, and define a `render(time)` function.
Patchies calls your `render()` every frame with transport time, and routes the
output into the video pipeline.

All regl resources you create (buffers, textures, elements, draw commands) are 
tracked automatically and cleaned up when your code reloads or the node is 
deleted. No manual cleanup needed.

Use `await` when creating draw commands. This lets Patchies preprocess 
`#include` directives in your shaders before compiling them. Without includes,
the `await` resolves instantly with no overhead.

## Shader Includes

Use `#include` in your `frag` or `vert` strings to import GLSL functions from the [lygia](https://lygia.xyz) shader library, your VFS files, or any URL:

```javascript
const draw = await regl({
  vert: `
    precision mediump float;
    attribute vec2 position;
    varying vec2 uv;
    void main() {
      uv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0, 1);
    }
  `,
  frag: `
    precision mediump float;
    varying vec2 uv;
    uniform float time;

    #include <lygia/generative/snoise>

    void main() {
      float n = snoise(vec3(uv * 4.0, time));
      gl_FragColor = vec4(vec3(n), 1.0);
    }
  `,
  attributes: {
    position: [[-1,-1], [1,-1], [-1,1], [-1,1], [1,-1], [1,1]]
  },
  uniforms: { time: regl.prop('time') },
  count: 6,
  depth: { enable: false },
})

function render(time) {
  regl.clear({ color: [0, 0, 0, 1] })
  draw({ time })
}
```

Supported sources:

| Syntax | Source |
| --- | --- |
| `#include <lygia/generative/snoise>` | NPM package (fetched from CDN) |
| `#include "user://my-shaders/foo.glsl"` | Your VFS files |
| `#include "https://example.com/shader.glsl"` | Any URL |

The `.glsl` extension is optional. Includes are resolved recursively and cached in memory.

## Video Textures

Connect other video nodes to the regl node's inlets, then access them with `getTexture()`:

```javascript
setVideoCount(2, 1) // 2 video inlets, 1 outlet

const draw = await regl({
  vert: `
    precision mediump float;
    attribute vec2 position;
    varying vec2 uv;
    void main() {
      uv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0, 1);
    }
  `,
  frag: `
    precision mediump float;
    varying vec2 uv;
    uniform sampler2D tex0;
    uniform sampler2D tex1;
    uniform float time;
    void main() {
      vec4 a = texture2D(tex0, uv);
      vec4 b = texture2D(tex1, uv);
      gl_FragColor = mix(a, b, sin(time) * 0.5 + 0.5);
    }
  `,
  attributes: {
    position: [[-1,-1], [1,-1], [-1,1], [-1,1], [1,-1], [1,1]]
  },
  uniforms: {
    tex0: () => getTexture(0), // first video inlet
    tex1: () => getTexture(1), // second video inlet
    time: regl.prop('time'),
  },
  count: 6,
  depth: { enable: false },
})

function render(time) {
  regl.clear({ color: [0, 0, 0, 0] })
  draw({ time })
}
```

`getTexture()` returns a regl `Texture2D` directly — no conversion or copying.

## Basic Presets

Enable **Texture Filters** for REGL-backed image-processing presets:

- `Bloom` - multipass threshold, blur, tint, and composite bloom.

Enable **Texture Composite** for REGL-backed multi-input composition presets:

- `Layout` - arranges up to four video inputs into a grid, row, or column.
- `Layer` - stacks up to four video inputs with per-layer opacity.

Enable **Texture Time** for REGL-backed temporal presets:

- `Cache` - records recent frames into an internal ring buffer and outputs a
  delayed frame.
- `Time Scrub` - records frame history and manually scrubs through it with a
  position control.
- `Time Machine` - records a longer frame history and plays it back with
  speed and mix controls.

## Multiple Video Outputs (MRT)

A single regl draw call can write to multiple video outlets at once using
WebGL2 multi-render targets. This lets you compute albedo, normals, depth,
or any structured G-buffer data in one pass — no redundant renders.

Call `setVideoCount(inlets, outlets)` with more than one outlet, then declare
`layout(location = N) out vec4` variables in your fragment shader. Each
location maps directly to the outlet at that index.

```javascript
setVideoCount(0, 2) // 0 inlets, 2 outlets

const draw = await regl({
  vert: `
    #version 300 es
    precision mediump float;
    in vec2 position;
    out vec2 uv;
    void main() {
      uv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0, 1);
    }
  `,
  frag: `
    #version 300 es
    precision mediump float;

    layout(location = 0) out vec4 albedo;   // video-out-0
    layout(location = 1) out vec4 normals;  // video-out-1

    in vec2 uv;
    uniform float time;

    void main() {
      albedo  = vec4(uv, sin(time) * 0.5 + 0.5, 1.0);
      normals = vec4(normalize(vec3(uv - 0.5, 1.0)) * 0.5 + 0.5, 1.0);
    }
  `,
  attributes: {
    position: [[-1,-1],[1,-1],[-1,1],[-1,1],[1,-1],[1,1]]
  },
  uniforms: { time: regl.prop('time') },
  count: 6,
  depth: { enable: false },
})

function render(time) {
  draw({ time })
}
```

Connect downstream nodes to `video-out-0` and `video-out-1` — each
receives its own texture.

> **Note**: Use `#version 300 es` and `in`/`out` instead of `attribute`/`varying`
> /`gl_FragColor` when writing MRT shaders. WebGL1-style shaders only support
> a single output.

## Available Variables

- `regl` — the regl instance
- `width`, `height` — output dimensions

## Special Functions

- `getTexture(index)` — get video input as regl Texture2D
- `setVideoCount(inlets, outlets)` — set number of video inlets/outlets
- `setResolution(size)` — set output FBO resolution (see below)

## Output Resolution

By default, the output renders at full window resolution. For data-heavy
rendering where you don't need full-res pixels, call `setResolution()`:

```javascript
setResolution(256)       // 256×256
setResolution(512, 256)  // 512×256
setResolution('1/2')     // half resolution
setResolution('1/4')     // quarter resolution
setResolution('1/8')     // any 1/n divisor works
```

This reduces the texture size so the GPU does less work per frame. Downstream
nodes sample the texture with bilinear filtering — upscaling is automatic.

## Common Functions

See the [Patchies JavaScript Runner](/docs/javascript-runner) for
all available functions.

- `noOutput()` — hides video output port
- `setHidePorts(true | false)` — hide/show all ports
- `noDrag()`, `noPan()`, `noWheel()`, `noInteract()` — see [Canvas Interaction](/docs/canvas-interaction)
- `fft()` — audio analysis
- `send()`, `onMessage()` — message passing

## When to Use regl vs glsl

| | `glsl` | `regl` |
| --- | --- | --- |
| You write | Fragment shader only | Full draw commands (vert + frag + geometry) |
| Geometry | Fullscreen quad (fixed) | Custom vertices, buffers, elements |
| Multi-pass | No | Yes (create your own framebuffers) |
| Blend modes | Fixed | Custom per draw call |
| Complexity | Low | Medium-high |

Use `glsl` when a fragment shader is enough. Use `regl` when you need
custom geometry, instancing, or multi-pass rendering.

## Resources

- [regl API Reference](https://github.com/regl-project/regl/blob/master/API.md) — full API docs
- [regl Examples](https://regl-project.github.io/regl/www/gallery.html) — gallery of demos

## See Also

- [GLSL Imports](/docs/glsl-imports) — import functions from lygia and other GLSL libraries
- [glsl](/docs/objects/glsl) — fragment shaders (simpler, single-pass)
- [three](/docs/objects/three) — Three.js 3D scenes
- [canvas](/docs/objects/canvas) — 2D canvas drawing
