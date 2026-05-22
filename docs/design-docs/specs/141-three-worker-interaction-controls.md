# 141. Three Worker Interaction Controls

## Goal

Add worker-side interaction APIs to the `three` object so it can react to pointer drag and wheel input without moving rendering back to the main thread.

The `three` object should keep its fast video-chainable worker renderer while supporting common interactive 3D workflows:

- Orbit, pan, and wheel zoom a camera with an API that looks familiar to Three.js users.
- Receive raw pointer drag and wheel events for raycasting, object dragging, brush controls, scroll-driven animation, and custom camera rigs.
- Preserve control state across code re-evaluation when the worker renderer can be reused.

## API Shape

Expose raw interaction hooks in worker `three` code:

```js
onPointerDrag(({ x, y, dx, dy, buttons, down }) => {
  // Custom interaction, such as raycasting or dragging an object.
});

onWheel(({ x, y, deltaX, deltaY, deltaMode }) => {
  // Custom wheel behavior, such as brush size or timeline scrubbing.
});
```

Extend the existing `mouse` global for worker `three`:

```js
mouse.x;
mouse.y;
mouse.down;
mouse.buttons;
mouse.dx;
mouse.dy;
mouse.wheelDelta;
```

Expose a Patchies worker implementation of an OrbitControls-like class:

```js
const controls = new OrbitControls(camera);

function draw() {
  controls.update();
  renderer.render(scene, camera);
}
```

This is not Three.js' DOM `OrbitControls` addon. It is a worker-safe compatibility layer with a familiar constructor and common properties.
It intentionally does not require `renderer.domElement`, because worker `three` has no real DOM element.
Constructing `OrbitControls` should automatically send the same interaction updates as `noDrag()` and `noWheel()` so Patchies canvas gestures do not compete with camera drag and wheel zoom.

## Initial OrbitControls Compatibility

Support the practical subset first:

- `target`
- `enabled`
- `enableRotate`
- `enablePan`
- `enableZoom`
- `rotateSpeed`
- `panSpeed`
- `zoomSpeed`
- `minDistance`
- `maxDistance`
- `mouseButtons`
- `update()`
- `reset()`
- `saveState()`
- `dispose()`
- `getDistance()`
- `getAzimuthalAngle()`
- `getPolarAngle()`
- `rotateLeft(angle)`
- `rotateUp(angle)`
- `pan(deltaX, deltaY)`
- `dollyIn(scale)`
- `dollyOut(scale)`

Defer full parity features such as keyboard listeners, touch gestures, damping, auto-rotate, `zoomToCursor`, and detailed orthographic camera support.

## Input Forwarding

`three` should receive Shadertoy-style pointer state from both the node preview and the surface forwarder:

- `mouseX`, `mouseY`: current pointer position in framebuffer pixels.
- `mouseZ`, `mouseW`: positive click origin while down, negative after release.
- `mouseButtons`: raw pointer button bitmask when available.

Wheel input needs its own render-worker message because it is a discrete event rather than durable frame state. The wheel payload should include pointer coordinates when available, `deltaX`, `deltaY`, and `deltaMode`.

## Renderer Reuse

The worker `ThreeRenderer` should reuse its instance across code updates when the FBO can be reused, similar to Hydra and Shader Park 3D. Reusing the renderer keeps worker-side interaction state, registered resources, and control snapshots alive across `run` / `setCode` re-evaluation.

When user code re-runs, raw callbacks should be cleared and registered again by the new code. Orbit control state should be restored into newly constructed controls so live-coding does not snap the camera back to its default position.

## Documentation Updates

Update:

- `ui/static/content/objects/three.md`
- `ui/static/content/objects/three.dom.md` comparison copy
- `ui/src/lib/codemirror/patchies-completions.ts`
- `ui/src/lib/ai/object-prompts/three.ts`

The docs should still say keyboard interaction belongs to `three.dom` for now.
