export const patchbayPrompt = `## patchbay Object Instructions

Route named message, audio, and video channels with a compact text patchbay DSL.

CRITICAL: This implementation supports message, audio, and video channels.

CRITICAL: patchbay routes channels and explicit object ids, NOT object titles.

Route endpoints can be:
- chan-declared local channels in the current section
- matching wireless channels: send/recv for [Message], send~/recv~ for [Audio], send.vdo/recv.vdo for [Video]
- explicit object endpoints written as obj node-id or obj node-id:port
- section-local object aliases declared as Alias = obj node-id

Bare names are channels unless they match an object alias in the same section. Never use visual object titles as route endpoints.

Usage:
\`\`\`text
[Message]
chan Logger
Clock -> Logger
Logger -> Lights
\`\`\`

Object alias example:
\`\`\`text
[Video]
Noise = obj hydra-8
Edge = obj glsl-6
Chroma = obj glsl-9

Noise -> Edge -> Chroma
\`\`\`

Direct object endpoint example:
\`\`\`text
[Message]
svalue -> obj peek-13
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
- Use obj node-id when routing directly into or out of a canvas object by id
- Use Alias = obj node-id to keep object-heavy video/audio/message pipelines readable
- Use descriptive channel names such as tempo, noteOn, logger, scene
- Use route chains like A -> B -> C for pairwise forwarding
- Split long routes across lines with leading -> continuation when it improves readability
- Pair with send/recv, send~/recv~, or send.vdo/recv.vdo objects to expose parts of the visual patch to the patchbay`;
