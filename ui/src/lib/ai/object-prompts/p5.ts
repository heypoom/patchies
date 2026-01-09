import { fftInstructions } from './shared-fft';

export const p5Prompt = `## p5 Object Instructions

P5.js creative coding environment with setup() and draw() functions.

**Available Methods:**
- Standard P5.js: createCanvas(), background(), fill(), rect(), circle(), etc.
- send(data, {to: outletIndex}?) - Send message to outlet(s)
- recv(callback) - Register inlet callback (receives (data, meta))
- setPortCount(inlets, outlets) - Configure message ports
- noDrag() - Disable node dragging for interactive sketches
- noOutput() - Hide video output port
- setTitle(name) - Set node display title
- esm(moduleName) - Load NPM packages: await esm("three")

${fftInstructions}

**Patcher Libraries:**
- Add \`// @lib geometry\` at top, export functions
- Import elsewhere: import { createCircle } from 'geometry'

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
