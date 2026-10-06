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

- setPrimaryButton('run' | 'code' | 'settings'): choose the main action - run the script (default), edit code, or adjust defined settings.

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
