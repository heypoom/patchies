# 103. Low-Level Regl Node

## Status: Draft

## Summary

A new `regl` render node that lets users write custom regl draw commands in JavaScript. Sits between the high-level GLSL node (fragment shader only) and building a full internal renderer like ProjectionMapRenderer. Users get direct access to the regl instance, their framebuffer, and input textures — enough to build projection mappers, multi-pass effects, geometry-based visuals, and anything else regl supports.

## Motivation

Current render nodes occupy distinct abstraction levels:

| Node     | What you write   | What you can do                     |
| -------- | ---------------- | ----------------------------------- |
| `glsl`   | Fragment shader  | Single-pass pixel effects, uniforms |
| `hydra`  | Hydra synth code | Composable video synth chains       |
| `canvas` | 2D Canvas JS     | Procedural 2D drawing               |
| `three`  | Three.js JS      | 3D scenes, meshes, materials        |
| `swgl`   | SwissGL JS       | SwissGL experiments                 |

**Gap**: There's no way for users to write custom GPU draw commands with full control over vertices, buffers, elements, blend modes, multi-pass rendering, and geometry — without building an internal TypeScript renderer class. The `glsl` node only exposes the fragment shader of a fullscreen quad. The `three` node adds Three.js overhead and abstracts away the GPU.

A `regl` node would let users do things like:

- Projection mapping (what ProjectionMapRenderer does internally)
- Custom particle systems with vertex buffers
- Multi-pass post-processing chains
- Instanced rendering
- Custom blend modes per draw call
- Geometry shaders via transform feedback
- Any creative GPU technique that regl supports

## User-Facing API

### Code Structure

The user writes JavaScript that has access to the regl instance and helper functions. They must define a `render(time)` function that gets called each frame.

```js
// === Setup (runs once) ===

// Dynamic inlet/outlet configuration (like three node)
setVideoCount(2, 1) // 2 video inlets, 1 video outlet

// Create regl resources
const positions = regl.buffer([
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
])

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
  attributes: {position: positions},
  uniforms: {
    tex0: () => getTexture(0),
    tex1: () => getTexture(1),
    time: regl.prop('time'),
  },
  count: 4,
  primitive: 'triangle strip',
  depth: {enable: false},
})

// === Render (called each frame) ===
function render(time) {
  regl.clear({color: [0, 0, 0, 0]})
  draw({time})
}
```

### Available Context

Following the pattern established by canvas and three nodes:

| Variable                                                         | Type                                    | Description                              |
| ---------------------------------------------------------------- | --------------------------------------- | ---------------------------------------- |
| `regl`                                                           | `regl.Regl`                             | The regl instance (shared with pipeline) |
| `width`                                                          | `number`                                | Output framebuffer width                 |
| `height`                                                         | `number`                                | Output framebuffer height                |
| `getTexture(index)`                                              | `(n: number) => regl.Texture2D \| null` | Get input video texture by inlet index   |
| `setVideoCount(inlets, outlets)`                                 | `(n, n) => void`                        | Set dynamic video port count             |
| `fft(options?)`                                                  | `(opts?) => Uint8Array \| Float32Array` | Audio analysis data                      |
| `send(data, options?)`                                           | Send messages to other nodes            |
| `onMessage(callback)`                                            | Receive messages from other nodes       |
| `mouse`                                                          | `{ x, y }`                              | Mouse position (normalized 0-1)          |
| `clock`                                                          | `ClockState`                            | Transport timing info                    |
| `settings`                                                       | Settings proxy                          | Node settings                            |
| `noDrag()`, `noPan()`, `noWheel()`, `noInteract()`, `noOutput()` | Interaction control                     |

### Framebuffer Binding

The pipeline binds the node's output framebuffer automatically before calling `render()`. The user does **not** need to manage framebuffer binding — they just draw, and it goes to the right place. This matches how the GLSL node works (draws to bound FBO) and keeps boilerplate minimal.

```js
// User does NOT need to do this:
// framebuffer.use(() => { draw(...) })

// Just draw — the FBO is already bound:
function render(time) {
  regl.clear({color: [0, 0, 0, 0]})
  draw({time})
}
```

### Resource Cleanup

User-created regl resources (buffers, textures, elements) need cleanup. Two approaches:

**Option A — Tracked allocation (recommended)**:
Wrap the regl instance so that `regl.buffer()`, `regl.texture()`, `regl.elements()` calls are tracked. On code update or node destruction, all tracked resources are automatically destroyed.

```js
// User writes normal regl code — cleanup is automatic
const buf = regl.buffer([...])
const tex = regl.texture({ width: 256, height: 256 })
// Both destroyed automatically when code reloads or node is deleted
```

**Option B — Manual cleanup callback**:
User defines an optional `cleanup()` function.

```js
const buf = regl.buffer([...])

function cleanup() {
  buf.destroy()
}
```

Option A is strongly preferred — it removes a class of memory leak bugs and keeps the API simple. The tracked wrapper would intercept `regl.buffer()`, `regl.texture()`, `regl.elements()`, and `regl({...})` (draw command creation), storing references for bulk cleanup.

## Implementation

### ReglRenderer Class

New file: `ui/src/workers/rendering/reglRenderer.ts`

Follows the same pattern as `CanvasRenderer` and `ThreeRenderer`:

```typescript
export class ReglRenderer {
  private config: { code: string; nodeId: string };
  private framebuffer: regl.Framebuffer2D;
  private fboRenderer: FBORenderer;
  private jsRunner: JSRunner;

  // Tracked resources for automatic cleanup
  private trackedResources: Array<{ destroy(): void }> = [];

  // User's render function
  private renderFn: ((time: number) => void) | null = null;

  // Input textures (updated each frame by the pipeline)
  private inputTextures: (regl.Texture2D | undefined)[] = [];

  static async create(
    config: { code: string; nodeId: string },
    framebuffer: regl.Framebuffer2D,
    renderer: FBORenderer
  ): Promise<ReglRenderer> { ... }

  renderFrame(params: RenderParams): void {
    // Update input textures from params
    this.inputTextures = params.userParams as (regl.Texture2D | undefined)[];

    // Bind FBO and call user's render function
    this.framebuffer.use(() => {
      this.renderFn?.(params.transportTime);
    });
  }

  updateCode(code: string): void { ... }
  destroy(): void { ... }
}
```

### Tracked Regl Wrapper

The key innovation for DX. Wraps the regl instance to track allocations:

```typescript
function createTrackedRegl(reglInstance: regl.Regl): {
  regl: regl.Regl
  destroyAll(): void
} {
  const tracked: Array<{destroy(): void}> = []

  const proxy = new Proxy(reglInstance, {
    apply(target, thisArg, args) {
      // regl({...}) creates a draw command
      const cmd = Reflect.apply(target, thisArg, args)
      tracked.push(cmd)
      return cmd
    },
    get(target, prop) {
      const val = Reflect.get(target, prop)
      if (
        prop === 'buffer' ||
        prop === 'texture' ||
        prop === 'elements' ||
        prop === 'framebuffer' ||
        prop === 'renderbuffer'
      ) {
        return (...args: any[]) => {
          const resource = (val as Function).apply(target, args)
          tracked.push(resource)
          return resource
        }
      }
      return val
    },
  })

  return {
    regl: proxy as regl.Regl,
    destroyAll() {
      for (const r of tracked) r.destroy()
      tracked.length = 0
    },
  }
}
```

### FBORenderer Integration

In `fboRenderer.ts`:

```typescript
// Add to class fields
public reglByNode = new Map<string, ReglRenderer | null>();

// Add to buildFBOs match
.with({ type: 'regl' }, (node) => this.createReglRenderer(node, framebuffer))

// New method
async createReglRenderer(
  node: RenderNode,
  framebuffer: regl.Framebuffer2D
): Promise<{ render: RenderFunction; cleanup: () => void } | null> {
  if (this.reglByNode.has(node.id)) {
    this.reglByNode.get(node.id)?.destroy();
  }

  const reglRenderer = await ReglRenderer.create(
    { code: node.data.code, nodeId: node.id },
    framebuffer,
    this
  );

  this.reglByNode.set(node.id, reglRenderer);

  return {
    render: reglRenderer.renderFrame.bind(reglRenderer),
    cleanup: () => {
      reglRenderer.destroy();
      this.reglByNode.delete(node.id);
    }
  };
}
```

### UI Component

`ReglNode.svelte` — follows the same pattern as `ThreeNode.svelte`:

- Code editor (CodeMirror) for the regl code
- Preview display
- Dynamic video inlet/outlet handles based on `setVideoCount()`
- Message inlet for `onMessage()`

### Node Registration

Standard checklist:

- Component in `src/lib/components/nodes/ReglNode.svelte`
- Add `'regl'` to `node-types.ts`
- Add to `defaultNodeData.ts` with starter code
- Add to `get-categorized-objects.ts` (category: Visual, description: "Low-level GPU rendering with regl")
- Add to `object-packs.ts`
- Add render type to `fboRenderer.ts` match
- Add to AI object prompts

## Default Starter Code

```js
// Fullscreen textured quad with color tint
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
    position: [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ],
  },
  uniforms: {
    time: regl.prop('time'),
  },
  count: 6,
  depth: {enable: false},
})

function render(time) {
  regl.clear({color: [0, 0, 0, 1]})
  draw({time})
}
```

## Design Decisions

1. **Naming**: `regl` — honest about the underlying library. Leaves room for other GPU integrations (e.g. `wgpu` for WebGPU) in the future.

2. **Multi-pass**: Users manage their own ping-pong FBOs via `regl.framebuffer()`. The tracked wrapper handles cleanup. That's the point of a low-level node.

3. **`regl.clear()` safety**: The tracked wrapper intercepts `regl.clear()` — if the user omits the `framebuffer` key, it auto-injects the node's output framebuffer. This prevents accidentally clearing the main canvas (shared regl instance) with zero perf cost (just a property check on the options object).

4. **No performance guardrails** for v1 — power users who reach for a regl node know what they're doing.

5. **Not a `glsl` mode**: The glsl node's value is simplicity (write a fragment shader, get uniforms auto-detected). The regl node is fundamentally different — you define the full pipeline.
