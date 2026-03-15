import { fftInstructions } from './shared-fft';
import { messagingInstructions } from './shared-messaging';
import {
  esmInstructions,
  runOnMountInstructions,
  patcherLibraryInstructions
} from './shared-jsrunner';

export const jsPrompt = `## js Object Instructions

JavaScript execution block for general-purpose logic and utilities.

**Additional js methods:**
${esmInstructions}
${runOnMountInstructions}

${messagingInstructions}

${fftInstructions}

${patcherLibraryInstructions}

Example:
\`\`\`json
{
  "type": "js",
  "data": {
    "code": "setPortCount(1, 1)\\nrecv(data => send(data * 2, {to: 0}));"
  }
}
\`\`\``;
