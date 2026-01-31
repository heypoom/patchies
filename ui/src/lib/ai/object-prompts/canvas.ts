import { fftInstructions } from './shared-fft';
import { messagingInstructions } from './shared-messaging';
import { jsRunnerInstructions } from './shared-jsrunner';

export const canvasPrompt = `## canvas Object Instructions

Offscreen Canvas on web worker thread for high-performance video chaining. NO DOM access.

**CRITICAL:** Use canvas.dom if you need mouse/keyboard/DOM interaction.

${jsRunnerInstructions}

**Canvas-specific methods:**
- ctx: 2D canvas context (ctx.fillRect, ctx.arc, etc.)
- width, height: canvas dimensions
- noDrag(), noOutput() - Node config
- setCanvasSize(w, h) - Resize canvas

**Canvas-specific gotchas:**
- Runs in web worker - no DOM access, no mouse/keyboard events
- Use canvas.dom for interactive sketches

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
    "code": "let a = 0; function draw() { ctx.fillStyle = '#080809'; ctx.fillRect(0,0,width,height); ctx.fillStyle = '#4ade80'; ctx.arc(width/2, height/2, 50, 0, Math.PI*2); ctx.fill(); a += 0.05; requestAnimationFrame(draw); } draw();"
  }
}
\`\`\``;
