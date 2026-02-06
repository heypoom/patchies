import { fftInstructions } from './shared-fft';
import { messagingInstructions } from './shared-messaging';
import { esmInstructions, patcherLibraryInstructions } from './shared-jsrunner';

export const p5Prompt = `## p5 Object Instructions

P5.js creative coding environment with setup() and draw() functions.

**Additional p5 methods:**
${esmInstructions}

**P5-specific methods:**
- Standard P5.js: createCanvas(), background(), fill(), rect(), circle(), etc.
- noDrag() - Disable node dragging for interactive sketches
- noPan() - Disable canvas panning when interacting
- noWheel() - Disable wheel zoom when interacting
- noInteract() - Disable all interactions (drag, pan, wheel)
- noOutput() - Hide video output port

**P5-specific gotchas:**
- P5 has its own draw() loop - prefer that over requestAnimationFrame

${messagingInstructions}

${fftInstructions}

${patcherLibraryInstructions}

**Handle IDs:**
- Video outlet: "video-out"
- Message ports via setPortCount: "message-in-0"..."message-in-n", "message-out-0"..."message-out-m"

Example:
\`\`\`json
{
  "type": "p5",
  "data": {
    "code": "function setup() { createCanvas(400, 400); }\\nfunction draw() { background(220); circle(200, 200, 50); }"
  }
}
\`\`\``;
