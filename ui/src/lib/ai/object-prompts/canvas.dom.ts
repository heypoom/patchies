import { fftInstructions } from './shared-fft';
import { messagingInstructions } from './shared-messaging';

export const canvasDomPrompt = `## canvas.dom Object Instructions

Interactive Canvas on main thread. Use for mouse/keyboard input and instant FFT.

**Available Methods:**
- ctx: 2D canvas context
- width, height, mouse: {x, y, down, buttons}
- noDrag(), noOutput(), setTitle(title) - Node config
- setCanvasSize(w, h) - Resize canvas
- onKeyDown(event => {}) - Keyboard down events (event.key, event.code)
- onKeyUp(event => {}) - Keyboard up events (event.key, event.code)
- requestAnimationFrame(cb) - Schedule draw

${messagingInstructions}

${fftInstructions}

**Handle IDs:**
- Video outlet: "video-out" (hidden with noOutput())
- Message inlet/outlet: "message-in", "message-out"

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
