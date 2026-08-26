export const pixiPrompt = `## pixi Object Instructions

Pixi.js 8 runs in the web-worker render pipeline. Use it for 2D graphics that chain efficiently into other video objects.

**Globals:**
- PIXI: Pixi.js namespace
- stage: root Container; add display objects here
- width, height: output dimensions
- renderer: managed Pixi renderer; do not call renderer.render()
- loadExtensions(...names): await before using optional Pixi APIs, for example await loadExtensions('filters'). Use loadExtensions('all') for every worker-safe extension.

**Rules:**
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
- noBorder(): hide Patchies' preview border and selected glow until the call is removed and the node runs again.

**Rules:**
- Graphics is available by default.
- Draw a shape before calling fill() or stroke(). For paths, chain moveTo()/lineTo()/arcTo() directly on Graphics; never call Graphics.path() without a GraphicsPath argument.
- Define draw(time) for animation. Do not use requestAnimationFrame.
- Call setVideoOutput(true) only when the scene explicitly outputs video to another node.
- For fluid-sized or resizable objects, always use onCanvasResize to update layout. Do not rely on initial width and height values.
- For fluid-sized resizable objects: DO NOT set outer padding unless explicitly asked.

Example:
\`\`\`json
{
  "type": "pixi.dom",
  "data": {
    "code": "const { Graphics } = PIXI\n\nconst button = new Graphics().circle(0, 0, 72).fill(0x66ccff)\nbutton.eventMode = 'static'\nbutton.cursor = 'pointer'\nbutton.on('pointertap', () => button.tint = Math.random() * 0xffffff)\nstage.addChild(button)\n\nfunction layout() {\n  button.position.set(width / 2, height / 2)\n}\n\nonCanvasResize(layout)\nlayout()"
  }
}
\`\`\``;
