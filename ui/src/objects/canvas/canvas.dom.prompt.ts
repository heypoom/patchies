import { fftInstructions } from '$lib/ai/object-prompts/shared-fft';
import { typographyInstructions } from '$lib/ai/object-prompts/shared-typography';

export const canvasDomPrompt = `## canvas.dom Object Instructions

Interactive Canvas on main thread. Use for mouse/keyboard input and instant FFT.

**Canvas sizing and layout:**
- Default to fluid-sized components: call setFluidSize({ showResizer: false, initialSize: { width: 800, height: 600 } }) unless fixed sizing is explicitly requested or required by the sketch.
- Pass showResizer: false by default; use showResizer: true only when visible resize handles are explicitly requested. Users can enable resizing from the node overflow menu.
- Fill the outer container edge to edge. Do not add outer padding or margins unless explicitly requested.
- IMPORTANT: Scale text, controls, hit areas, shapes, and line widths with the current width and height on every resize, not just their positions. Derive a UI scale from the current dimensions relative to the initial size.
- Use LARGE, readable fonts: at least 18px for labels and 24–32px for primary text at the initial size, growing with the UI scale. Do not leave text or controls at tiny fixed pixel sizes when the widget grows.
- Make shapes, lines, and UI elements LARGE.
- Choose one sizing mode; do not call setCanvasSize() with setFluidSize().
- For a fixed widget, call setCanvasSize(width, height) with an appropriate size.
  - IMPORTANT: Minimum is (800, 800), Maximum is (2000, 2000). DO NOT GO BELOW MINIMUM SIZE!
- For a resizable widget, call setFluidSize({ showResizer: false, initialSize: { width: 800, height: 600 } }) instead.
  - Use keepAspectRatio: true for square widgets.
  - Use resize: 'horizontal' for faders, resize: 'vertical' for meters
- Fluid widgets always read their current logical size from width and height.
  - A requestAnimationFrame draw loop automatically redraws at the new size. Static widgets should register onCanvasResize(draw). Use width and height for arithmetic and formatting; when a primitive is required, copy with Number(width) or Number(height).

**Canvas.dom-specific methods:**
- ctx: 2D canvas context
- width, height, mouse: {x, y, down, buttons}
- noDrag(), noPan(), noWheel(), noArrowKeyMove(), noInteract() - Interaction control
- noArrowKeyMove() disables moving the node with arrow keys, including Shift + arrow keys. noInteract() includes this control.
- noBorder() - Hide Patchies border and selected glow
- onSelectionChange(callback): Calls callback(selected) immediately with current canvas selection, then only when it changes. Returns an unsubscribe function; subscriptions clear on rerun or destruction. Selection is separate from keyboard focus.
- setVideoOutput(enabled) - Enable or disable video output. Disabled by default; call setVideoOutput(true) when the sketch feeds another video node.

When using noBorder() for a custom widget, use onSelectionChange() to keep a visible selection indicator that matches its theme and geometry, including rounded or inset borders. Store selected in a variable and use it in draw() or redraw the scene from the callback, including for paused or static widgets. Register after any drawing resources used by the callback exist, because the initial callback runs immediately.

- setCanvasSize(width, height) - Use a fixed logical canvas size
- setFluidSize({ showResizer?, resize?, keepAspectRatio?, initialSize? }) - Use a resizable canvas. resize is 'horizontal', 'vertical', or 'both' (default); keepAspectRatio preserves the initial ratio; initialSize sets the initial logical canvas size, e.g. { width: 800, height: 600 }. Users can enable or disable resizing from the overflow menu.
- onCanvasResize(({ width, height }) => {}) - Redraw a non-animated fluid widget after a resize; it runs at most once per animation frame
- onKeyDown(event => {}) - Keyboard down events (event.key, event.code)
- onKeyUp(event => {}) - Keyboard up events (event.key, event.code)
- setPortCount(inlets, outlets) - Set inlet/outlet count (e.g. setPortCount(1, 0) if only an inlet is needed and no message outlet)

**Default behaviors to apply unless there's a reason not to:**
- Call setVideoOutput(true) only when the sketch is explicitly meant to output video to another node.
- Call noDrag() if the sketch uses mouse.down, mouse.x/y, or any click/drag interaction.
- Call noWheel() if the sketch uses scroll or wheel interaction.
- Call setPortCount(1, 0) if the sketch only needs to receive messages (inlet) and does not send any output messages.

${typographyInstructions}

${fftInstructions}

Example - XY pad:
\`\`\`json
{
  "type": "canvas.dom",
  "data": {
    "code": "setFluidSize({ showResizer: false, initialSize: { width: 800, height: 800 }, keepAspectRatio: true }); noDrag(); function draw() { ctx.fillStyle = '#080809'; ctx.fillRect(0, 0, width, height); ctx.fillStyle = mouse.down ? '#4ade80' : '#71717a'; ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 12 * Math.min(width / 800, height / 800), 0, Math.PI * 2); ctx.fill(); if (mouse.down) send([mouse.x / width, mouse.y / height]); requestAnimationFrame(draw); } draw();"
  }
}
\`\`\`

Example - Keyboard control:
\`\`\`json
{
  "type": "canvas.dom",
  "data": {
    "code": "setFluidSize({ showResizer: false, initialSize: { width: 800, height: 600 } }); let x = 0.5; onKeyDown(e => { if (e.key === 'ArrowLeft') x = Math.max(0, x - 0.02); if (e.key === 'ArrowRight') x = Math.min(1, x + 0.02); if (e.key === ' ') send('bang'); }); function draw() { ctx.fillStyle = '#080809'; ctx.fillRect(0, 0, width, height); ctx.fillStyle = '#4ade80'; ctx.beginPath(); ctx.arc(x * width, height / 2, 20 * Math.min(width / 800, height / 600), 0, Math.PI * 2); ctx.fill(); requestAnimationFrame(draw); } draw();"
  }
}
\`\`\``;
