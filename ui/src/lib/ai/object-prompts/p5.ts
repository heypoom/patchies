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
- setPortCount(inlets, outlets) - Set inlet/outlet count (e.g. setPortCount(1, 0) if only an inlet is needed and no message outlet)

**Default behaviors to apply unless there's a reason not to:**
- Call noOutput() by default unless the sketch is explicitly meant to output video to another node.
- Call noDrag() if the sketch uses mousePressed, mouseDragged, mouseX/mouseY interaction.
- Call noWheel() if the sketch uses scroll or mouseWheel interaction.
- Call setPortCount(1, 0) if the sketch only needs to receive messages (inlet) and does not send any output messages.

**P5-specific gotchas:**
- P5 has its own draw() loop - prefer that over requestAnimationFrame
- Do NOT make setup() asynchronous.
  - If you need to define settings, use settings.define WITHOUT await.

**Canvas size:**
- Default to 252x164 or similar sizes unless the user specifies a size. Keep canvases small as p5 is CPU-bound and large canvases cause lag.
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
