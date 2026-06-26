export const samplerPrompt = `## sampler~ Object Instructions

Sample playback with triggering capabilities.

CRITICAL RULES:
1. Load audio samples for triggered playback
2. Great for drum machines and one-shots
3. Connect to out~ for audio output

Messages:
- string: load sample from URL
- bang: trigger sample playback
- number: trigger sample playback with gain multiplier (0=silent, 1=normal, 2=twice as loud)
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
