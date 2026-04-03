export const soundfilePrompt = `## soundfile~ Object Instructions

Load and play audio files with transport controls.

CRITICAL RULES:
1. No code needed - file loading object
2. Connect to out~ to hear audio
3. Supports audio chaining as source
4. The _initialUrl field loads a URL on creation, but it is ONLY set externally by the chat tool via the insert data passthrough. Do NOT generate _initialUrl yourself — you do not have access to valid sample URLs.

Messages:
- string or {type: 'load', url: '...'}: load audio file
- bang: restart playback
- play: start playback
- pause: pause playback
- stop: stop playback
- {type: 'loop', value: boolean}: set looping
- read: read file (used with convolver~)

Example - Audio Player:
\`\`\`json
{
  "type": "soundfile~",
  "data": {}
}
\`\`\``;
