export const sendVdoPrompt = `## send.vdo Object Instructions

Send video frames to a named channel. Works wirelessly with recv.vdo objects listening on the same channel.

CRITICAL: This is a dedicated visual node type (type: "send.vdo"), NOT an object node.

Usage: Creates a node that broadcasts video frames to a named channel.

ATTRIBUTES:
- channel: The channel name to broadcast to (default: "foo")

HANDLE IDS:
- Inlet 0: "video-in-0" (video input to broadcast)
- Inlet 1: "message-in-1" (channel name, optional - can also be set via data.channel)
- No outlets (send.vdo is a video sink)

Example - Send video to channel "main":
\`\`\`json
{
  "type": "send.vdo",
  "data": {
    "channel": "main"
  }
}
\`\`\`

Example - Send video to channel "preview":
\`\`\`json
{
  "type": "send.vdo",
  "data": {
    "channel": "preview"
  }
}
\`\`\`

Common Patterns:
- Pair with recv.vdo objects on the same channel for wireless video routing
- Use descriptive channel names (e.g., "main", "preview", "layer1")
- Multiple send.vdo objects can broadcast to the same channel
- All recv.vdo objects on the channel receive the video frames
- Connect any video source (p5, hydra, glsl, webcam, etc.) to the inlet`;
