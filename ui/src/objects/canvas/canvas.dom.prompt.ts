import { fftInstructions } from '$lib/ai/object-prompts/shared-fft';
import { typographyInstructions } from '$lib/ai/object-prompts/shared-typography';

export const canvasDomPrompt = `## canvas.dom Object Instructions

Interactive Canvas on main thread. Use for mouse/keyboard input and instant FFT.

**Canvas sizing and layout:**
- IMPORTANT: Use LARGE font sizes (18px minimum, 24px – 32px for primary text).
- Make shapes, lines, and UI elements LARGE.
- Choose one sizing mode; do not call setCanvasSize() with setFluidSize().
- For a fixed widget, call setCanvasSize(width, height) with an appropriate size.
  - IMPORTANT: Minimum is (800, 800), Maximum is (2000, 2000). DO NOT GO BELOW MINIMUM SIZE!
- For a resizable widget, call setFluidSize({ initialSize: { width: 800, height: 600 } }) instead.
  - Use keepAspectRatio: true for square widgets.
  - Use resize: 'horizontal' for faders, resize: 'vertical' for meters
- Fluid widgets always read their current logical size from width and height.
  - A requestAnimationFrame draw loop automatically redraws at the new size. Static widgets should register onCanvasResize(draw). Use width and height for arithmetic and formatting; when a primitive is required, copy with Number(width) or Number(height).

**Canvas.dom-specific methods:**
- ctx: 2D canvas context
- width, height, mouse: {x, y, down, buttons}
- noDrag(), noPan(), noWheel(), noInteract() - Interaction control
- noBorder() - Hide Patchies border and selected glow
- setVideoOutput(enabled) - Enable or disable video output. Disabled by default; call setVideoOutput(true) when the sketch feeds another video node.
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
    "code": "let [width, height] = [800, 800]; noDrag(); setCanvasSize(width, height); function draw() { ctx.fillStyle = '#080809'; ctx.fillRect(0, 0, width, height); ctx.fillStyle = mouse.down ? '#4ade80' : '#71717a'; ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 12, 0, Math.PI * 2); ctx.fill(); if (mouse.down) send([mouse.x / width, mouse.y / height]); requestAnimationFrame(draw); } draw();"
  }
}
\`\`\`

Example - Keyboard control:
\`\`\`json
{
  "type": "canvas.dom",
  "data": {
    "code": "let [width, height] = [800, 600]; setCanvasSize(width, height); let x = width / 2; onKeyDown(e => { if (e.key === 'ArrowLeft') x -= 10; if (e.key === 'ArrowRight') x += 10; if (e.key === ' ') send('bang'); }); function draw() { ctx.fillStyle = '#080809'; ctx.fillRect(0, 0, width, height); ctx.fillStyle = '#4ade80'; ctx.beginPath(); ctx.arc(x, height / 2, 20, 0, Math.PI * 2); ctx.fill(); requestAnimationFrame(draw); } draw();"
  }
}
\`\`\``;
