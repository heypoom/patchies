export const pixiPrompt = `## pixi Object Instructions

Pixi.js 8 runs in the web-worker render pipeline. Use it for 2D graphics that chain efficiently into other video objects.

**Globals:**
- PIXI: Pixi.js namespace
- stage: root Container; add display objects here
- width, height: output dimensions
- renderer: managed Pixi renderer; do not call renderer.render()
- loadExtensions(...names): await before using optional Pixi APIs, for example await loadExtensions('filters'). Use loadExtensions('all') for every worker-safe extension.

**Rules:**
- Almost always call setTitle() with a very short name describing the object, for example setTitle('Particles'). Prefer one or two words rather than a sentence.
- Graphics is available by default.
- Draw a shape before calling fill() or stroke(). For paths, chain moveTo()/lineTo()/arcTo() directly on Graphics; never call Graphics.path() without a GraphicsPath argument.
- Define draw(time) for animation. Do not use requestAnimationFrame.
- The render worker has no DOM. Use pixi.dom for native pointer, keyboard, or DOM APIs.

Example:
\`\`\`json
{
  "type": "pixi",
  "data": {
    "code": "const { Graphics } = PIXI\n\nconst circle = new Graphics().circle(width / 2, height / 2, 72).fill(0x66ccff)\nstage.addChild(circle)\n\nfunction draw(time) {\n  circle.rotation = time * 0.001\n}"
  }
}
\`\`\``;

export const pixiDomPrompt = `## pixi.dom Object Instructions

Pixi.js 8 on the main thread. Use it for interactive 2D graphics with native pointer and DOM APIs.

**Globals:**
- PIXI: Pixi.js namespace
- stage: root Container; add display objects here
- canvas: HTML canvas element
- width, height: canvas dimensions
- renderer: managed Pixi renderer; do not call renderer.render()
- loadExtensions(...names): await before using optional Pixi APIs, for example await loadExtensions('accessibility'). Use loadExtensions('all') for every optional extension. Native pointer events are available by default.
- setCanvasSize(width, height), setFluidSize(), onCanvasResize(callback): canvas sizing APIs. In fluid mode, draw(time) can read live width and height values while resizing. Resizing does not re-run your code, so fluid or resizable objects must use onCanvasResize to update their layout.
- setVideoOutput(enabled): enable or disable the video output port. It is disabled by default; call setVideoOutput(true) when the scene feeds another video node.
- setPrimaryButton('code' | 'settings' | 'run'): choose the node's primary action button.
- setHidePorts(true | false): hide or show the video output handle.
- setTags(tags): replace user-defined tags for this node.
- kv: persistent key-value storage scoped to this node.
- noDrag(), noPan(), noWheel(), noInteract(): disable node drag, canvas pan, wheel zoom, or all three when Pixi pointer interaction needs them.
- noBorder(): hide Patchies' preview border and selected glow until the call is removed and the node runs again.
- onSelectionChange(callback): Calls callback(selected) immediately with current canvas selection, then only when it changes. Returns an unsubscribe function; subscriptions clear on rerun or destruction. Selection is separate from keyboard focus.
- onKeyDown(event => {}) / onKeyUp(event => {}): receive keyboard events while the Pixi canvas is focused. Events do not leak to the Patchies editor.

When using noBorder() for a custom widget, use onSelectionChange() to keep a visible selection indicator that matches its theme and geometry, including rounded or inset borders. Store selected in a variable and use it in draw() or redraw the scene from the callback, including for paused or static widgets. Register after any drawing resources used by the callback exist, because the initial callback runs immediately.

**Rules:**
- Almost always call setTitle() with a very short name describing the object, for example setTitle('Calculator'). Prefer one or two words rather than a sentence.
- If the object is resizable by default and its background is neither transparent nor black, you must call noBorder(). All three conditions must hold; a colored shape on a transparent background alone does not require it.
- Graphics is available by default.
- Draw a shape before calling fill() or stroke(). For paths, chain moveTo()/lineTo()/arcTo() directly on Graphics; never call Graphics.path() without a GraphicsPath argument.
- Define draw(time) for animation. Do not use requestAnimationFrame.
- Call setVideoOutput(true) only when the scene explicitly outputs video to another node.
- For fluid-sized or resizable objects, always use onCanvasResize to update layout. Do not rely on initial width and height values.
- Default to fluid-sized components: call setFluidSize({ showResizer: false, initialSize: { width: 400, height: 300 } }) unless fixed sizing is explicitly requested or required by the scene. Do not combine setFluidSize() with setCanvasSize().
- Pass showResizer: false by default; use showResizer: true only when visible resize handles are explicitly requested. Users can enable resizing from the node overflow menu.
- Fill the outer container edge to edge. Do not add outer padding or margins unless explicitly requested.
- In onCanvasResize(), scale text, controls, hit areas, shapes, and line widths from the live width and height relative to the initial dimensions, not just their positions. Run the layout function once initially too.
- Use LARGE, readable fonts: at least 18px for labels and 24–32px for primary text at the initial size, growing with the UI scale. Do not leave text or controls at tiny fixed pixel sizes when the widget grows.

Example:
\`\`\`json
{
  "type": "pixi.dom",
  "data": {
    "code": "setFluidSize({ showResizer: false, initialSize: { width: 400, height: 300 } })\n\nconst { Graphics } = PIXI\n\nconst button = new Graphics().circle(0, 0, 72).fill(0x66ccff)\nbutton.eventMode = 'static'\nbutton.cursor = 'pointer'\nbutton.on('pointertap', () => button.tint = Math.random() * 0xffffff)\nstage.addChild(button)\n\nfunction layout() {\n  button.position.set(width / 2, height / 2)\n  button.scale.set(Math.min(width / 400, height / 300))\n}\n\nonCanvasResize(layout)\nlayout()"
  }
}
\`\`\``;
