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
- {type: 'set', time, value}: trigger scheduled playback with value as gain
- {type: 'setGain', value}: set built-in output gain for all sampler playback
- {type: 'noteOn', note, velocity, time?}: trigger pitched playback (note 60=original pitch, velocity 0-127 controls gain)
- {type: 'noteOff', note, time?}: stop active voices for that note when note-off mode is held
- {type: 'setNoteOffMode', value: 'one-shot' | 'held'}: set whether noteOff is ignored for one-shots or stops held voices
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
