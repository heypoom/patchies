export const soundfilePrompt = `## soundfile~ Object Instructions

Load and play audio files with transport controls.

CRITICAL RULES:
1. No code needed - file loading object
2. Connect to out~ to hear audio
3. Supports audio chaining as source
4. To load a URL on creation, use \`_initialUrl\` in data (NOT \`url\`)
5. Use \`search_samples\` tool to find real sample URLs instead of guessing

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
  "data": {
    "_initialUrl": "https://cdn.freesound.org/previews/1234/1234_567-lq.mp3"
  }
}
\`\`\``;
