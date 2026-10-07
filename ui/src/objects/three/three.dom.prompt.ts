import { fftInstructions } from '$lib/ai/object-prompts/shared-fft';
export const threeDomPrompt = `## three.dom Object Instructions

Three.js 3D graphics on the main thread. Use for interactive 3D with mouse/keyboard input. Renders directly to canvas (no worker).

**Three.dom-specific globals:**
- THREE: Full Three.js library namespace (lazy-loaded)
- renderer: WebGLRenderer instance
- canvas: HTML5 Canvas element
- width, height: Canvas dimensions
- mouse: {x, y, down, buttons} with touch support

**Three.dom-specific methods:**
- setCanvasSize(w, h) - Resize canvas and renderer
- noDrag(), noPan(), noWheel(), noArrowKeyMove(), noInteract() - Interaction control
- noArrowKeyMove() disables moving the node with arrow keys, including Shift + arrow keys. noInteract() includes this control.
- noBorder() - Hide Patchies border and selected glow
- onSelectionChange(callback): Calls callback(selected) immediately with current canvas selection, then only when it changes. Returns an unsubscribe function; subscriptions clear on rerun or destruction. Selection is separate from keyboard focus.
- setVideoOutput(enabled) - Enable or disable video output. It is disabled by default; call setVideoOutput(true) when the scene feeds another video node.

When using noBorder() for a custom widget, use onSelectionChange() to keep a visible selection indicator that matches its theme and geometry, including rounded or inset borders. Store selected in a variable and use it in draw() or redraw the scene from the callback, including for paused or static widgets. Register after any drawing resources used by the callback exist, because the initial callback runs immediately.

- setHidePorts(bool) - Toggle port visibility
- onKeyDown(event => {}) - Keyboard down events (event.key, event.code)
- onKeyUp(event => {}) - Keyboard up events

**Three.dom-specific gotchas:**
- Use draw(time) function for render loop instead of requestAnimationFrame
- Call setCanvasSize(width, height) with appropriate dimensions. Do not exceed 2000x2000 to avoid performance issues.
- When using setCanvasSize, make sure to define width and height variables:
  e.g. const width = 800, height = 600; setCanvasSize(width, height);

${fftInstructions}

**Render Pattern:**
Define a \`draw(time)\` function that will be called via setAnimationLoop:
\`\`\`js
function draw(time) {
  // Update scene based on mouse, time, etc.
  renderer.render(scene, camera)
}
\`\`\`

Example - Interactive rotating cube:
\`\`\`json
{
  "type": "three.dom",
  "data": {
    "code": "const { Scene, PerspectiveCamera, BoxGeometry, Mesh, MeshNormalMaterial } = THREE\\n\\nnoDrag()\\n\\nconst scene = new Scene()\\nconst camera = new PerspectiveCamera(75, width / height, 0.1, 1000)\\ncamera.position.z = 2\\n\\nconst geometry = new BoxGeometry(1, 1, 1)\\nconst material = new MeshNormalMaterial()\\nconst cube = new Mesh(geometry, material)\\nscene.add(cube)\\n\\nfunction draw(t) {\\n  cube.rotation.x = mouse.y * 0.01\\n  cube.rotation.y = mouse.x * 0.01\\n  renderer.render(scene, camera)\\n}"
  }
}
\`\`\`

Example - Keyboard-controlled camera:
\`\`\`json
{
  "type": "three.dom",
  "data": {
    "code": "const { Scene, PerspectiveCamera, BoxGeometry, Mesh, MeshNormalMaterial, GridHelper } = THREE\\n\\nnoDrag()\\n\\nconst scene = new Scene()\\nconst camera = new PerspectiveCamera(75, width / height, 0.1, 1000)\\ncamera.position.set(0, 2, 5)\\n\\nscene.add(new GridHelper(10, 10))\\nconst cube = new Mesh(new BoxGeometry(1, 1, 1), new MeshNormalMaterial())\\nscene.add(cube)\\n\\nlet moveX = 0, moveZ = 0\\nonKeyDown(e => {\\n  if (e.key === 'ArrowLeft') moveX = -0.1\\n  if (e.key === 'ArrowRight') moveX = 0.1\\n  if (e.key === 'ArrowUp') moveZ = -0.1\\n  if (e.key === 'ArrowDown') moveZ = 0.1\\n})\\nonKeyUp(e => { moveX = 0; moveZ = 0 })\\n\\nfunction draw(t) {\\n  camera.position.x += moveX\\n  camera.position.z += moveZ\\n  renderer.render(scene, camera)\\n}"
  }
}
\`\`\``;
