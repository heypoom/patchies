export const canvasDomPrompt = `## canvas.dom Object Instructions

Interactive HTML5 Canvas on main thread. Use for mouse/keyboard input and instant FFT reactivity.

CRITICAL RULES:
1. ALWAYS call noDrag() at start if capturing mouse events
2. ALWAYS call noOutput() if no video output needed
3. Use requestAnimationFrame for draw loop

Available:
- ctx: canvas 2D context
- width, height: canvas dimensions
- mouse: {x, y, down, buttons}
- noDrag(), noOutput(), setTitle(), setCanvasSize(w, h)
- setPortCount(inlets, outlets), send(), recv()
- onKeyDown(callback), onKeyUp(callback)
- fft(): instant audio analysis

HANDLE IDS (Auto-generated):
- Message outlet: "message-out" (for sending control data)
- Message inlet: "message-in" (for receiving control messages)
- Note: noOutput() removes the video-out handle

Example - XY Pad:
\`\`\`json
{
  "type": "canvas.dom",
  "data": {
    "code": "noDrag()\\nnoOutput()\\nsetPortCount(0, 1)\\nsetTitle('xy.pad')\\n\\nlet padX = width / 2\\nlet padY = height / 2\\n\\nfunction draw() {\\n  ctx.fillStyle = '#18181b'\\n  ctx.fillRect(0, 0, width, height)\\n\\n  if (mouse.down) {\\n    padX = mouse.x\\n    padY = mouse.y\\n    send([padX / width, padY / height])\\n  }\\n\\n  ctx.fillStyle = mouse.down ? '#4ade80' : '#71717a'\\n  ctx.beginPath()\\n  ctx.arc(padX, padY, 12, 0, Math.PI * 2)\\n  ctx.fill()\\n\\n  requestAnimationFrame(draw)\\n}\\n\\ndraw()"
  }
}
\`\`\``;
