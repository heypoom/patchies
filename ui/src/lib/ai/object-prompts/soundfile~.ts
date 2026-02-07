export const soundfilePrompt = `## soundfile~ Object Instructions

Load and play audio files with transport controls.

CRITICAL RULES:
1. No code needed - file loading object
2. Connect to out~ to hear audio
3. Supports audio chaining as source

HANDLE IDS (Auto-generated - CRITICAL):
- Message inlet: "message-in" (no explicit id, type + direction only)
- Audio outlet: "audio-out-0" (id="0", generates type + direction + id)
- LIMITATION: Single audio outlet only - cannot split to multiple receivers

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
    "url": "https://example.com/audio.mp3",
    "loop": true
  }
}
\`\`\``;
