export const patchbayPrompt = `## patchbay Object Instructions

Route named message, audio, and video channels with a compact text patchbay DSL.

CRITICAL: This implementation supports message, audio, and video channels.

CRITICAL: patchbay routes channels, not object titles. Every route name must be declared with chan in the current section or already exist as a matching wireless channel: send/recv for [Message], send~/recv~ for [Audio], send.vdo/recv.vdo for [Video].

Usage:
\`\`\`text
[Message]
chan Logger
Clock -> Logger
Logger -> Lights
\`\`\`

Example:
\`\`\`json
{
  "type": "patchbay",
  "data": {
    "code": "[Message]\\nchan Logger\\nClock -> Logger\\nLogger -> Lights"
  }
}
\`\`\`

Common Patterns:
- Use chan for patchbay-local virtual message, audio, or video channels
- Use descriptive channel names such as tempo, noteOn, logger, scene
- Use route chains like A -> B -> C for pairwise forwarding
- Pair with send/recv, send~/recv~, or send.vdo/recv.vdo objects to expose parts of the visual patch to the patchbay`;
