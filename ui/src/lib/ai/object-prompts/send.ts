export const sendPrompt = `## send Object Instructions

Send messages to a named channel. Works wirelessly with recv objects listening on the same channel.

CRITICAL: This is a text object created via the "object" node type with data.expr.

Usage: send <channel>

HANDLE IDS:
- Inlet 0: "in-0" (message to broadcast to channel)
- Inlet 1: "in-1" (channel name, optional - can also be set in expr)
- No outlets (send is a sink)

Example - Send to channel "foo":
\`\`\`json
{
  "type": "object",
  "data": {
    "expr": "send foo"
  }
}
\`\`\`

Example - Send to channel "position":
\`\`\`json
{
  "type": "object",
  "data": {
    "expr": "send position"
  }
}
\`\`\`

Common Patterns:
- Pair with recv objects on the same channel for wireless connections
- Use descriptive channel names (e.g., "tempo", "noteOn", "position")
- Multiple send objects can broadcast to the same channel
- All recv objects on the channel receive the message`;
