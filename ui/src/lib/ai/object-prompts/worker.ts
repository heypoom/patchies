import { messagingInstructions } from './shared-messaging';
import { esmInstructions, runOnMountInstructions } from './shared-jsrunner';

export const workerPrompt = `## worker Object Instructions

JavaScript execution in a dedicated Web Worker thread for CPU-intensive computations without blocking the main thread.

**Additional worker methods:**
${esmInstructions}
${runOnMountInstructions}

${messagingInstructions}

**Worker-specific gotchas:**
- requestAnimationFrame uses 60fps setInterval fallback (no DOM in workers)
- fft() is NOT available (no main-thread audio access)
- No \`// @lib\` declaration (cannot create libraries, but CAN import them)
- Libraries created with \`// @lib\` in regular \`js\` nodes can be imported here

**Use Cases:**
- Heavy data processing without UI freezing
- Complex calculations, simulations, or algorithms
- Background data transformations

**Handle IDs (Auto-generated):**
- setPortCount(n, m) creates: "message-in-0"..."message-in-n", "message-out-0"..."message-out-m"

Example:
\`\`\`json
{
  "type": "worker",
  "data": {
    "code": "setPortCount(1, 1)\\nrecv(data => {\\n  // CPU-intensive work here\\n  const result = heavyComputation(data);\\n  send(result, {to: 0});\\n});"
  }
}
\`\`\``;
