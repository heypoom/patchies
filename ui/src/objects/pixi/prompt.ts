export const pixiPrompt = `## pixi Object Instructions

PixiJS 8 runs in the web-worker render pipeline. Use it for 2D graphics that chain efficiently into other video objects.

**Globals:**
- PIXI: PixiJS namespace
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

PixiJS 8 on the main thread. Use it for interactive 2D graphics with native pointer and DOM APIs.

**Globals:**
- PIXI: PixiJS namespace
- stage: root Container; add display objects here
- canvas: HTML canvas element
- width, height: canvas dimensions
- renderer: managed Pixi renderer; do not call renderer.render()
- loadExtensions(...names): await before using optional Pixi APIs, for example await loadExtensions('events', 'accessibility'). Use loadExtensions('all') for every extension.
- setCanvasSize(width, height), setFluidSize(), onCanvasResize(callback): canvas sizing APIs
- noOutput(): hide the video output port when the scene does not feed another video node

**Rules:**
- Graphics is available by default.
- Draw a shape before calling fill() or stroke(). For paths, chain moveTo()/lineTo()/arcTo() directly on Graphics; never call Graphics.path() without a GraphicsPath argument.
- Define draw(time) for animation. Do not use requestAnimationFrame.
- Use await loadExtensions('events') before adding Pixi pointer handlers.
- Call noOutput() by default unless the scene explicitly outputs video to another node.

Example:
\`\`\`json
{
  "type": "pixi.dom",
  "data": {
    "code": "noOutput()\nawait loadExtensions('events')\n\nconst { Graphics } = PIXI\n\nconst button = new Graphics().circle(width / 2, height / 2, 72).fill(0x66ccff)\nbutton.eventMode = 'static'\nbutton.cursor = 'pointer'\nbutton.on('pointertap', () => button.tint = Math.random() * 0xffffff)\nstage.addChild(button)"
  }
}
\`\`\``;
