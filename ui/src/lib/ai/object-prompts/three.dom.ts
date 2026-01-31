import { fftInstructions } from './shared-fft';
import { messagingInstructions } from './shared-messaging';

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
- noDrag() - Disable node dragging for interactive scenes
- noOutput() - Hide video output port
- setHidePorts(bool) - Toggle port visibility
- onKeyDown(event => {}) - Keyboard down events (event.key, event.code)
- onKeyUp(event => {}) - Keyboard up events

**Three.dom-specific gotchas:**
- Use draw(time) function for render loop instead of requestAnimationFrame

${messagingInstructions}

${fftInstructions}

**Handle IDs:**
- Video outlet: "video-out-0"
- Message inlet/outlet: "in-0"..."in-n", "out-0"..."out-m"

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
