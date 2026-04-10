export const surfacePrompt = `## surface Object Instructions

Fullscreen interactive canvas overlay for live performance. Captures pointer/touch input. Auto-freezes DOM-renderer nodes (p5, canvas.dom) while keeping the FBO video pipeline running underneath.

**Surface-specific methods:**
- ctx: 2D canvas context
- width, height: always window dimensions (updated on resize)
- mouse: {x, y, down, buttons} — x/y normalized 0–1, down: boolean, buttons: 0=none 1=left 2=right
- onPointer(({ x, y, buttons, down, type }) => {})
  pointer events (type: 'move'|'down'|'up'); down: boolean, buttons: 0=none 1=left 2=right
- onTouch((touches) => {}) — multi-touch: array of { id, x, y, pressure }
- onKeyDown(event => {}) — keyboard down
- onKeyUp(event => {}) — keyboard up
- setDrawMode('always'|'interact'|'manual') — control render loop
- redraw() — trigger a draw in manual mode
- activate() / deactivate() — enter/exit fullscreen from code
- noOutput() — hide video output port

**Coordinate system:**
- All pointer/touch coords are normalized 0–1
- Multiply by width/height to get pixel coordinates: x * width, y * height

**Default behaviors to apply unless there's a reason not to:**
- Call noOutput() unless the sketch explicitly outputs video to another node.
- Use setDrawMode('interact') for sketches that only update on input (saves CPU).
- Do NOT call setCanvasSize — the surface always fills the window.
- Do NOT call noDrag/noPan/noWheel — the surface canvas is non-interactive by default.

**Performance:**
- setDrawMode('always') for animated sketches
- setDrawMode('interact') for input-reactive sketches (no continuous rAF needed)
- setDrawMode('manual') + redraw() for fully manual control

**CRITICAL — draw function registration:**
You MUST call \`requestAnimationFrame(draw)\` to register the draw function — never call \`draw()\` directly.
The surface intercepts requestAnimationFrame to set its internal draw callback (pausedCallback).
Without it, triggerDraw() (called on pointer events in 'interact' mode) has nothing to invoke,
so nothing ever renders.

\`\`\`javascript
// WRONG — draw() runs once, surface never calls it again
function draw() { ctx.clearRect(0, 0, width, height); }
draw(); // ← not registered, pointer events do nothing

// RIGHT — surface calls draw() on each frame/interaction
function draw() { ctx.clearRect(0, 0, width, height); }
requestAnimationFrame(draw); // ← registers as the active draw callback
\`\`\`

Example - Paint on touch/pointer:
\`\`\`json
{
  "type": "surface",
  "data": {
    "code": "noOutput(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height); onPointer(({ x, y, down, type }) => { if (!down) return; ctx.beginPath(); ctx.arc(x * width, y * height, 20, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill(); });"
  }
}
\`\`\`

Example - Multi-touch ripples:
\`\`\`json
{
  "type": "surface",
  "data": {
    "code": "noOutput(); setDrawMode('always'); const ripples = []; onTouch((touches) => { for (const t of touches) ripples.push({ x: t.x * width, y: t.y * height, r: 0, a: 1 }); }); function draw() { ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(0, 0, width, height); for (let i = ripples.length - 1; i >= 0; i--) { const r = ripples[i]; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.strokeStyle = \`rgba(100,200,255,\${r.a})\`; ctx.lineWidth = 2; ctx.stroke(); r.r += 4; r.a -= 0.02; if (r.a <= 0) ripples.splice(i, 1); } }"
  }
}
\`\`\``;
