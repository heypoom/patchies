export const patchbayPrompt = `## patchbay Object Instructions

Route named message channels with a compact text patchbay DSL.

CRITICAL: This first implementation supports message channels only. Do not use patchbay for audio or video routing yet.

CRITICAL: patchbay routes channels, not object titles. Every route name must be declared with chan in the [Message] section or already exist as a message channel from send/recv or JS send/recv channel usage.

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
- Use chan for patchbay-local virtual message channels
- Use descriptive channel names such as tempo, noteOn, logger, scene
- Use route chains like A -> B -> C for pairwise forwarding
- Pair with send/recv objects to expose parts of the visual patch to the patchbay`;
