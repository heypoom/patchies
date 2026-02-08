The `three.dom` object creates 3D graphics using [Three.js](https://threejs.org). It runs on the main thread with full interactivity support.

![Three.js torus demo](/content/images/threejs-torus.webp)

> ✨ [Try this patch](/?id=1c484xkin7p7p2r) showing how to use 2D textures from other objects in Three.js!

## Getting Started

Define a `draw()` function to render each frame:

```javascript
const { Scene, PerspectiveCamera, BoxGeometry, Mesh, MeshNormalMaterial } = THREE;

const scene = new Scene();
const camera = new PerspectiveCamera(75, width / height, 0.1, 1000);
camera.position.z = 2;

const geometry = new BoxGeometry(1, 1, 1);
const material = new MeshNormalMaterial();
const cube = new Mesh(geometry, material);
scene.add(cube);

function draw() {
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  renderer.render(scene, camera);
}
```

## Comparison with three

| Feature | `three` | `three.dom` |
|---------|---------|-------------|
| Runs on | Web worker | Main thread |
| Video chaining | Fast | Slow (CPU-to-GPU copy) |
| OrbitControls | No | Yes |
| Keyboard events | No | Yes |
| Video textures | Yes (`getTexture`) | No |

Use `three` for pure video processing. Use `three.dom` when you need interactivity.

## Available Variables

- `THREE` - the Three.js library
- `renderer` - WebGLRenderer instance
- `width`, `height` - output dimensions
- `mouse.x`, `mouse.y` - mouse position

## Special Functions (three.dom only)

- `setCanvasSize(width, height)` - resize output canvas
- `onKeyDown(callback)` - receive keydown events
- `onKeyUp(callback)` - receive keyup events

## Common Functions

See the [Patchies JavaScript Runner](/docs/javascript-runner) for all available functions.

- `noOutput()` - hides video output port
- `setHidePorts(true | false)` - hide/show all ports
- `noDrag()`, `noPan()`, `noWheel()`, `noInteract()` - see [Canvas Interaction](/docs/canvas-interaction)
- `fft()` - audio analysis with low latency

## Resources

- [Three.js Documentation](https://threejs.org/docs) - official docs
- [Three.js Examples](https://threejs.org/examples) - demos and inspiration
- [Support mrdoob](https://github.com/sponsors/mrdoob) - sponsor the creator

## See Also

- [three](/docs/objects/three) - offscreen variant (faster for chaining)
- [glsl](/docs/objects/glsl) - GPU shaders
- [swgl](/docs/objects/swgl) - SwissGL for quick WebGL
