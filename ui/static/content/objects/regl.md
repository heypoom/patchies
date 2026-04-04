The `regl` object gives you low-level GPU rendering with [regl](https://github.com/regl-project/regl) draw commands. It runs on a web worker for fast video chaining.

Use it when you need full control over vertices, buffers, elements, blend modes, or multi-pass rendering — things the `glsl` node can't do because it only exposes a fragment shader on a fullscreen quad.

---

## Getting Started

Define a `render(time)` function that gets called every frame.
The output framebuffer is already bound — just draw.

```javascript
const draw = regl({
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

---

## How It Works

You write standard regl code — create draw commands with `regl({...})`, allocate buffers with `regl.buffer()`, and define a `render(time)` function. Patchies calls your `render()` every frame with transport time, and routes the output into the video pipeline.

All regl resources you create (buffers, textures, elements, draw commands) are tracked automatically and cleaned up when your code reloads or the node is deleted. No manual cleanup needed.

---

## Video Textures

Connect other video nodes to the regl node's inlets, then access them with `getTexture()`:

```javascript
setVideoCount(2, 1) // 2 video inlets, 1 outlet

const draw = regl({
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

---

## Available Variables

- `regl` — the regl instance
- `width`, `height` — output dimensions
- `mouse.x`, `mouse.y` — mouse position (normalized 0-1)

## Special Functions

- `getTexture(index)` — get video input as regl Texture2D
- `setVideoCount(inlets, outlets)` — set number of video inlets/outlets

## Common Functions

See the [Patchies JavaScript Runner](/docs/javascript-runner) for all available functions.

- `noOutput()` — hides video output port
- `setHidePorts(true | false)` — hide/show all ports
- `noDrag()`, `noPan()`, `noWheel()`, `noInteract()` — see [Canvas Interaction](/docs/canvas-interaction)
- `fft()` — audio analysis
- `send()`, `onMessage()` — message passing

---

## When to Use regl vs glsl

| | `glsl` | `regl` |
| --- | --- | --- |
| You write | Fragment shader only | Full draw commands (vert + frag + geometry) |
| Geometry | Fullscreen quad (fixed) | Custom vertices, buffers, elements |
| Multi-pass | No | Yes (create your own framebuffers) |
| Blend modes | Fixed | Custom per draw call |
| Complexity | Low | Medium-high |

Use `glsl` when a fragment shader is enough. Use `regl` when you need custom geometry, instancing, or multi-pass rendering.

---

## Resources

- [regl API Reference](https://github.com/regl-project/regl/blob/master/API.md) — full API docs
- [regl Examples](https://regl-project.github.io/regl/www/gallery.html) — gallery of demos

## See Also

- [glsl](/docs/objects/glsl) — fragment shaders (simpler, single-pass)
- [three](/docs/objects/three) — Three.js 3D scenes
- [canvas](/docs/objects/canvas) — 2D canvas drawing
