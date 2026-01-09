import { fftInstructions } from './shared-fft';

export const canvasDomPrompt = `## canvas.dom Object Instructions

Interactive Canvas on main thread. Use for mouse/keyboard input and instant FFT.

**Available Methods:**
- ctx: 2D canvas context
- width, height, mouse: {x, y, down, buttons}
- send(data, {to: outletIndex}?) - Send message
- recv(callback) - Inlet callback (receives (data, meta))
- noDrag(), noOutput(), setTitle(title) - Node config
- setCanvasSize(w, h) - Resize canvas
- onKeyDown(cb), onKeyUp(cb) - Keyboard events
- requestAnimationFrame(cb) - Schedule draw

${fftInstructions}

**Handle IDs:**
- Video outlet: "video-out" (hidden with noOutput())
- Message inlet/outlet: "message-in", "message-out"

Example - XY pad:
\`\`\`json
{
  "type": "canvas.dom",
  "data": {
    "code": "noDrag(); noOutput(); function draw() { ctx.fillStyle = '#18181b'; ctx.fillRect(0,0,width,height); ctx.fillStyle = mouse.down ? '#4ade80' : '#71717a'; ctx.arc(mouse.x, mouse.y, 12, 0, Math.PI*2); ctx.fill(); if (mouse.down) send([mouse.x/width, mouse.y/height]); requestAnimationFrame(draw); } draw();"
  }
}
\`\`\``;
