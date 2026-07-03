export const midiFilePrompt = `## midi.file Object Instructions

MIDI file player. Loads .mid/.midi files and emits Patchies MIDI messages.

CRITICAL RULES:
1. No code needed — it is a file playback object.
2. Connect to tone~, sonic~, midi.out, webmidilink, pads~, or other MIDI consumers.
3. Use the node UI or messages to play, pause, stop, seek, and loop.
4. It preserves the file's internal timing and can apply initial tempo/time signature to transport.

Messages:
- bang or play: start playback
- pause: pause playback
- stop: stop and reset, flushing active notes
- {type: 'seek', seconds: number}: seek in seconds
- {type: 'loop', value: boolean}: set looping
- {type: 'events'}: output a plain array of all scheduled MIDI and meta events; each item is flattened with seconds, ticks, track, type, and the message-specific fields
- {type: 'set', applyTempoToTransport?: boolean, applyTimeSignatureToTransport?: boolean, syncTransport?: boolean, outputMetaEvents?: boolean, sendPositionEvents?: boolean}: update playback settings; position events are off by default
- 'user://...': load an existing VFS MIDI file
- 'https://...': load a remote MIDI file through VFS
- Uint8Array, ArrayBuffer, or number[]: load raw MIDI bytes inline

Example:
\`\`\`json
{
  "type": "midi.file",
  "data": {}
}
\`\`\``;
