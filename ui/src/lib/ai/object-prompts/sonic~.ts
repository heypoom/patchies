import { messagingInstructions } from './shared-messaging';
import { patcherLibraryInstructions } from './shared-jsrunner';

export const sonicPrompt = `## sonic~ Object Instructions

SuperCollider synthesis via SuperSonic AudioWorklet.

**Sonic-specific methods:**
- sonic: SuperSonic instance for synth control
- SuperSonic: Static methods (e.g., SuperSonic.osc.encode())
- on(event, callback) - Subscribe to SuperSonic events

**Sonic-specific gotchas:**
- fft() is NOT available (audio output node, not video)

${messagingInstructions}

${patcherLibraryInstructions}

**Context:**
- By default, Prophet synth is loaded
- See SuperSonic docs: https://github.com/samaaron/supersonic
- See scsynth OSC ref: http://doc.sccode.org/Reference/Server-Command-Reference.html

**Handle IDs:**
- Audio outlet: "audio-out"
- Message ports: "message-in-0"..."message-in-n", "message-out-0"..."message-out-m"

Example:
\`\`\`json
{
  "type": "sonic~",
  "data": {
    "code": "setPortCount(1); recv(m => { if (m?.type === 'bang') sonic.synth.trigger({note: 60}); });"
  }
}
\`\`\``;
