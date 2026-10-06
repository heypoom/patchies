import { fftInstructions } from '$lib/ai/object-prompts/shared-fft';
import {
  esmInstructions,
  runOnMountInstructions,
  patcherLibraryInstructions
} from '$lib/ai/object-prompts/shared-jsrunner';

export const jsPrompt = `## js Object Instructions

JavaScript execution block for general-purpose logic and utilities.

**Additional js methods:**
${esmInstructions}
${runOnMountInstructions}

- setPrimaryButton('run' | 'code' | 'settings'): in compact layout, choose the large body action (default: run); code/settings move Run/Pause to the floating button. With the console visible, execution stays in the console and the floating button is Edit code, or Settings for 'settings'. Settings requires visible fields.

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
