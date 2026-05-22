The `three` object creates 3D graphics using [Three.js](https://threejs.org). It
runs on a web worker for fast video chaining.

![Three.js torus demo](/content/images/threejs-torus.webp)

> ✨ [Try this patch](/?id=1c484xkin7p7p2r) showing how to use 2D textures from
  other objects in Three.js!

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

## Comparison with three.dom

| Feature | `three` | `three.dom` |
| -------- | -------- | -------- |
| Runs on | Web worker | Main thread |
| Video chaining | Fast, stays in the render pipeline | Slower, copies canvas back into the pipeline |
| Input latency | A little higher because pointer events are forwarded to the worker | Lowest, handles DOM input directly |
| Pointer drag/wheel | Yes, via `mouse`, `onPointerDrag()`, and `onWheel()` | Yes, via direct DOM mouse events |
| Orbit controls | Worker-safe `OrbitControls` compatibility layer | Three.js DOM `OrbitControls` |
| Keyboard events | No | Yes |
| DOM APIs | No | Yes |
| Video textures | Yes (`getTexture`) | No |

Use `three` when you want video chaining plus pointer drag, wheel, and camera
controls. Use [three.dom](/docs/objects/three.dom) when you need the lowest input
latency, keyboard events, or direct DOM APIs.

## Available Variables

- `THREE` - the Three.js library
- `renderer` - WebGLRenderer instance
- `width`, `height` - output dimensions
- `mouse.x`, `mouse.y` - mouse position
- `mouse.down`, `mouse.buttons` - pointer button state
- `mouse.dx`, `mouse.dy` - latest drag delta
- `mouse.wheelDelta` - latest wheel delta
- `OrbitControls` - worker-safe camera controls with a Three.js-like API

## Interaction

Use `OrbitControls` when you want familiar camera movement while keeping
the renderer in the worker. There is no DOM element in the worker, so pass the
camera only:

```javascript
const { Scene, PerspectiveCamera, BoxGeometry, Mesh, MeshNormalMaterial } = THREE;

const scene = new Scene();
const camera = new PerspectiveCamera(75, width / height, 0.1, 1000);
camera.position.z = 3;

const controls = new OrbitControls(camera);
controls.enablePan = true;
controls.enableZoom = true;

const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshNormalMaterial());
scene.add(mesh);

function draw() {
  controls.update();
  renderer.render(scene, camera);
}
```

Use raw events when the scene should decide what drag or wheel means:

```javascript
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

onPointerDrag(({ x, y }) => {
  pointer.x = (x / width) * 2 - 1;
  pointer.y = -(y / height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
});

onWheel(({ deltaY }) => {
  camera.position.z += deltaY * 0.01;
});
```

## Special Functions (three only)

- `getTexture(inlet)` - get video input as Three.js texture
- `setVideoCount(ins, outs)` - set number of video inlets/outlets
- `onPointerDrag(callback)` - receive raw drag events
- `onWheel(callback)` - receive raw wheel events

## Common Functions

See the [Patchies JavaScript Runner](/docs/javascript-runner) for all
available functions.

- `noOutput()` - hides video output port
- `setHidePorts(true | false)` - hide/show all ports
- `noDrag()`, `noPan()`, `noWheel()`, `noInteract()` - see [Canvas Interaction](/docs/canvas-interaction)
- `fft()` - audio analysis

## Resources

- [Three.js Documentation](https://threejs.org/docs) - official docs
- [Three.js Examples](https://threejs.org/examples) - demos and inspiration
- [Support mrdoob](https://github.com/sponsors/mrdoob) - sponsor the creator

## See Also

- [GLSL Imports](/docs/glsl-imports) - import functions from lygia and
  other GLSL libraries
- [three.dom](/docs/objects/three.dom) - main thread variant with interactivity
- [glsl](/docs/objects/glsl) - GPU shaders
- [swgl](/docs/objects/swgl) - SwissGL for quick WebGL
