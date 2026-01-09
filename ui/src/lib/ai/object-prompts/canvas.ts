import { fftInstructions } from './shared-fft';
import { messagingInstructions } from './shared-messaging';

export const canvasPrompt = `## canvas Object Instructions

Offscreen Canvas on web worker thread for high-performance video chaining. NO DOM access.

**CRITICAL:** Use canvas.dom if you need mouse/keyboard/DOM interaction.

**Available Methods:**
- ctx: 2D canvas context (ctx.fillRect, ctx.arc, etc.)
- width, height: canvas dimensions
- noDrag(), noOutput(), setTitle(title) - Node config
- setCanvasSize(w, h) - Resize canvas
- requestAnimationFrame(cb) - Schedule draw callback

${messagingInstructions}

${fftInstructions}

**Handle IDs:**
- Video outlet: "video-out"
- Message ports: "message-in-0"..."message-in-n", "message-out-0"..."message-out-m"

Example - Animated circle:
\`\`\`json
{
  "type": "canvas",
  "data": {
    "code": "let a = 0; function draw() { ctx.fillStyle = '#18181b'; ctx.fillRect(0,0,width,height); ctx.fillStyle = '#4ade80'; ctx.arc(width/2, height/2, 50, 0, Math.PI*2); ctx.fill(); a += 0.05; requestAnimationFrame(draw); } draw();"
  }
}
\`\`\``;
