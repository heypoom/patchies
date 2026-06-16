import { fftInstructions } from './shared-fft';
import { esmInstructions, patcherLibraryInstructions } from './shared-jsrunner';
import { typographyInstructions } from './shared-typography';

export const p5Prompt = `## p5 Object Instructions

P5.js creative coding environment with setup() and draw() functions.

**Additional p5 methods:**
${esmInstructions}

**P5-specific methods:**
- Standard P5.js: createCanvas(), background(), fill(), rect(), circle(), etc.
- noDrag() - Disable XYFlow node dragging for interactive sketches
- noPan() - Disable XYFlow canvas panning when interacting
- noWheel() - Disable XYFlow canvas wheel zoom when interacting
- noInteract() - Disable all XYFlow canvas interactions (drag, pan, wheel)
- noOutput() - Hide video output port (call this when the sketch is self-contained and does not need to feed video to other nodes)
- createSurfaceCanvas(renderer?) - Create a transparent renderer-output-sized canvas and enable Expand so the p5 sketch can run as a fullscreen surface overlay. Do NOT also call createCanvas() when using this.
- hideExitButton() - In expanded p5 surface mode, hide the "Exit surface" badge.
- setMouseForwarding({ enabled?: boolean, only?: string[], except?: string[] }) - In expanded p5 surface mode, forward p5 mouse/wheel interaction to render nodes. Use enabled: false or only: [] to disable.
- setPortCount(inlets, outlets) - Set inlet/outlet count (e.g. setPortCount(1, 0) if only an inlet is needed and no message outlet)

**Default behaviors to apply unless there's a reason not to:**
- Call noOutput() by default unless the sketch is explicitly meant to output video to another node.
- For fullscreen transparent overlays over Hydra/GLSL/video output, call createSurfaceCanvas() in setup() instead of createCanvas(), and use clear() in draw() so visuals underneath show through.
- In p5 surface mode, use setMouseForwarding() when only some render nodes should receive mouse/wheel interaction, and setMouseForwarding({ enabled: false }) when p5 should consume interaction without driving Hydra/GLSL/Three.
- Call noDrag() if the sketch uses mousePressed, mouseDragged, mouseX/mouseY interaction.
- Call noWheel() if the sketch uses scroll or mouseWheel interaction.
- Call setPortCount(1, 0) if the sketch only needs to receive messages (inlet) and does not send any output messages.

**P5-specific gotchas:**
- P5 has its own draw() loop - prefer that over requestAnimationFrame
- Do NOT make setup() asynchronous.
  - If you need to define settings, use settings.define WITHOUT await.

**Canvas size:**
- Default to 252x164 or similar sizes unless the user specifies a size. Keep canvases small as p5 is CPU-bound and large canvases cause lag.
- For surface overlays, use createSurfaceCanvas() and do not provide fixed dimensions.
- NEVER use windowWidth or windowHeight — the node is embedded in a canvas at a small size.
- Acceptable size range: 200×150 minimum, 1000×1000 maximum. Prefer smaller when possible.

**Font & element sizes:**
- The node is displayed very zoomed out in the patch canvas. Use large font sizes (18px minimum, 24–32px for primary text) so text remains readable.
- Similarly, make shapes, lines, and UI elements larger than you would for a full-screen sketch.

${typographyInstructions}

${fftInstructions}

${patcherLibraryInstructions}

Example:
\`\`\`json
{
  "type": "p5",
  "data": {
    "code": "function setup() { createCanvas(252, 164); }\\nfunction draw() { background(220); textSize(24); text('hello', 20, 80); }"
  }
}
\`\`\``;
