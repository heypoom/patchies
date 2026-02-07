export const samplerPrompt = `## sampler~ Object Instructions

Sample playback with triggering capabilities.

CRITICAL RULES:
1. Load audio samples for triggered playback
2. Great for drum machines and one-shots
3. Connect to out~ for audio output

HANDLE IDS (Auto-generated - CRITICAL FOR CONNECTIONS):
- Audio inlet: "audio-in-audio-in" (type + direction + id)
- Message inlet: "message-in-message-in" (type + direction + id)
- Audio outlet: "audio-out-audio-out" (type + direction + id)
- Pattern: "{type}-{direction}-{id}"
- LIMITATION: Single outlets only - cannot split to multiple nodes

Messages:
- string: load sample from URL
- bang: trigger sample playback
- number: set playback rate/pitch
- {type: 'load', url: '...'}: load sample

Example - Drum Sample:
\`\`\`json
{
  "type": "sampler~",
  "data": {
    "url": "https://example.com/kick.wav"
  }
}
\`\`\``;
