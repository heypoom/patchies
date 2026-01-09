export const canvasPrompt = `## canvas Object Instructions

Offscreen HTML5 Canvas running on rendering pipeline (web worker). Use for high-performance video chaining.

CRITICAL RULES:
1. Runs on web worker thread (OffscreenCanvas) - NO DOM access
2. Fast video chaining - can chain with glsl/hydra without lag
3. Use canvas.dom instead if you need mouse/keyboard/DOM
4. FFT has high delay due to worker message passing

Available in context:
- ctx: 2D rendering context
- width, height: canvas dimensions
- noDrag(): disable node dragging
- noOutput(): hide video output port
- setTitle(title): set node title
- setCanvasSize(w, h): resize canvas
- send(message), recv(callback): message passing
- fft(): audio analysis (high delay on worker)

HANDLE IDS (Auto-generated):
- Video outlet: "video-out" (for rendering the canvas)
- Message inlet: "message-in" (for receiving control messages)

Example - Animated Circle:
\`\`\`json
{
  "type": "canvas",
  "data": {
    "code": "let angle = 0;\\n\\nfunction draw() {\\n  ctx.fillStyle = '#18181b';\\n  ctx.fillRect(0, 0, width, height);\\n\\n  const x = width / 2 + Math.cos(angle) * 100;\\n  const y = height / 2 + Math.sin(angle) * 100;\\n\\n  ctx.fillStyle = '#4ade80';\\n  ctx.beginPath();\\n  ctx.arc(x, y, 20, 0, Math.PI * 2);\\n  ctx.fill();\\n\\n  angle += 0.05;\\n  requestAnimationFrame(draw);\\n}\\n\\ndraw();"
  }
}
\`\`\``;
