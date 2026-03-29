import { fftInstructions } from './shared-fft';
import { messagingInstructions } from './shared-messaging';

export const canvasDomPrompt = `## canvas.dom Object Instructions

Interactive Canvas on main thread. Use for mouse/keyboard input and instant FFT.

**Canvas.dom-specific methods:**
- ctx: 2D canvas context
- width, height, mouse: {x, y, down, buttons}
- noDrag(), noPan(), noWheel(), noInteract() - Interaction control
- noOutput() - Hide video output (call this when the sketch does not feed video to other nodes)
- setCanvasSize(w, h) - Resize canvas
- onKeyDown(event => {}) - Keyboard down events (event.key, event.code)
- onKeyUp(event => {}) - Keyboard up events (event.key, event.code)
- setPortCount(inlets, outlets) - Set inlet/outlet count (e.g. setPortCount(1, 0) if only an inlet is needed and no message outlet)

**Default behaviors to apply unless there's a reason not to:**
- Call noOutput() by default unless the sketch is explicitly meant to output video to another node.
- Call noDrag() if the sketch uses mouse.down, mouse.x/y, or any click/drag interaction.
- Call noWheel() if the sketch uses scroll or wheel interaction.
- Call setPortCount(1, 0) if the sketch only needs to receive messages (inlet) and does not send any output messages.

**Font & element sizes:**
- The node is displayed very zoomed out in the patch canvas.
- Use large font sizes (18px minimum, 24–32px for primary text) so text remains readable.
- Similarly, make shapes, lines, and UI elements larger than you would for a full-screen sketch.
- Call setCanvasSize(width, height) with appropriate dimensions.
  Minimum: 800x600. Maximum: 2000x2000.
- When using setCanvasSize, make sure to define width and height variables
  so the rest of the code can adapt to different sizes.

${messagingInstructions}
${fftInstructions}

Example - XY pad:
\`\`\`json
{
  "type": "canvas.dom",
  "data": {
    "code": "noDrag(); noOutput(); function draw() { ctx.fillStyle = '#080809'; ctx.fillRect(0,0,width,height); ctx.fillStyle = mouse.down ? '#4ade80' : '#71717a'; ctx.arc(mouse.x, mouse.y, 12, 0, Math.PI*2); ctx.fill(); if (mouse.down) send([mouse.x/width, mouse.y/height]); requestAnimationFrame(draw); } draw();"
  }
}
\`\`\`

Example - Keyboard control:
\`\`\`json
{
  "type": "canvas.dom",
  "data": {
    "code": "let x = width/2; onKeyDown(e => { if (e.key === 'ArrowLeft') x -= 10; if (e.key === 'ArrowRight') x += 10; if (e.key === ' ') send('bang'); }); function draw() { ctx.fillStyle = '#080809'; ctx.fillRect(0,0,width,height); ctx.fillStyle = '#4ade80'; ctx.arc(x, height/2, 20, 0, Math.PI*2); ctx.fill(); requestAnimationFrame(draw); } draw();"
  }
}
\`\`\``;
