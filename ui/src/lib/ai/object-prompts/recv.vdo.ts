export const recvVdoPrompt = `## recv.vdo Object Instructions

Receive video frames from a named channel. Works wirelessly with send.vdo objects broadcasting on the same channel.

CRITICAL: This is a dedicated visual node type (type: "recv.vdo"), NOT an object node.

Usage: Creates a node that receives video frames from a named channel.

ATTRIBUTES:
- channel: The channel name to receive from (default: "foo")

Example - Receive video from channel "main":
\`\`\`json
{
  "type": "recv.vdo",
  "data": {
    "channel": "main"
  }
}
\`\`\`

Example - Receive video from channel "preview":
\`\`\`json
{
  "type": "recv.vdo",
  "data": {
    "channel": "preview"
  }
}
\`\`\`

Common Patterns:
- Pair with send.vdo objects on the same channel for wireless video routing
- Use descriptive channel names (e.g., "main", "preview", "layer1")
- Multiple recv.vdo objects can receive from the same channel
- Connect outlet to video consumers (bg.out, hydra, glsl, etc.)
- Useful for organizing complex video routing without visible cables`;
