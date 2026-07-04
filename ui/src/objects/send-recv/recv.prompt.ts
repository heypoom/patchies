export const recvPrompt = `## recv Object Instructions

Receive messages from a named channel. Works wirelessly with send objects broadcasting on the same channel.

CRITICAL: This is a text object created via the "object" node type with data.expr.

Usage: recv <channel>

Example - Receive from channel "foo":
\`\`\`json
{
  "type": "object",
  "data": {
    "expr": "recv foo"
  }
}
\`\`\`

Example - Receive from channel "tempo":
\`\`\`json
{
  "type": "object",
  "data": {
    "expr": "recv tempo"
  }
}
\`\`\`

Common Patterns:
- Pair with send objects on the same channel for wireless connections
- Use descriptive channel names (e.g., "tempo", "noteOn", "position")
- Multiple recv objects can listen to the same channel
- All recv objects on the channel receive every broadcast message`;
