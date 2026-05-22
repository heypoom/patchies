export const surfacePrompt = `## surface Object Instructions

Fullscreen interactive canvas overlay for live performance. Captures pointer/touch input. In fullscreen, freezes DOM-renderer nodes (p5, canvas.dom, textmode.dom, three.dom) while the FBO video pipeline keeps running underneath.

**Surface-specific methods:**
- ctx: 2D canvas context
- width, height: current surface canvas dimensions. Preview uses window size; fullscreen uses renderer output size.
- mouse: {x, y, down, buttons} — x/y normalized 0–1, down: boolean, buttons: 0=none 1=left 2=right
- onPointer(({ x, y, buttons, down, type }) => {})
  pointer events (type: 'move'|'down'|'up'); down: boolean, buttons: 0=none 1=left 2=right
- onTouch((touches) => {}) — multi-touch: array of { id, x, y, pressure }
- onKeyDown(event => {}) — keyboard down
- onKeyUp(event => {}) — keyboard up
- setDrawMode('always'|'interact'|'manual') — control render loop
- redraw() — trigger a draw in manual mode
- setMouseForwarding({ enabled?: boolean, only?: string[], except?: string[] }) — enable/disable or restrict forwarded mouse events by node ID
- activate() / deactivate() — enter/exit fullscreen from code
- noOutput() — hide video output port

**Coordinate system:**
- All pointer/touch coords are normalized 0–1
- Multiply by width/height to get pixel coordinates: x * width, y * height

**Default behaviors to apply unless there's a reason not to:**
- Call noOutput() unless the sketch explicitly outputs video to another node.
- Use setDrawMode('interact') for sketches that only update on input (saves CPU).
- Use setMouseForwarding() when only some mouse-aware render nodes should receive forwarded pointer/wheel events.
- Use setMouseForwarding({ enabled: false }) or setMouseForwarding({ only: [] }) to disable mouse forwarding entirely.
- Do NOT call setCanvasSize — the surface always fills the window.
- Usually avoid noDrag/noPan/noWheel; use them only when preview interactions fight editor drag/pan/wheel.

**draw() function — how the render loop works:**
Define \`function draw() {}\`; the surface calls it automatically. Do not call draw() directly or use requestAnimationFrame.

- setDrawMode('always') + function draw() {} → called every frame in a continuous loop
- setDrawMode('interact') + function draw() {} → called on pointer/wheel interaction
- setDrawMode('manual') + function draw() {} → called only when redraw() is invoked

For touch-only callbacks, call redraw() yourself if you need an immediate manual redraw.

Example - pointer drawing:
\`\`\`json
{
  "type": "surface",
  "data": {
    "code": "noOutput(); setDrawMode('interact'); function draw() { ctx.clearRect(0, 0, width, height); if (!mouse.down) return; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(mouse.x * width, mouse.y * height, 24, 0, Math.PI * 2); ctx.fill(); }"
  }
}
\`\`\`

Example - manual redraw from touch:
\`\`\`json
{
  "type": "surface",
  "data": {
    "code": "noOutput(); setDrawMode('manual'); let touches = []; onTouch((next) => { touches = next; redraw(); }); function draw() { ctx.clearRect(0, 0, width, height); for (const t of touches) { ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.arc(t.x * width, t.y * height, 30 * (t.pressure || 0.5), 0, Math.PI * 2); ctx.fill(); } }"
  }
}
\`\`\``;
