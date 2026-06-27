export const smplrInstrumentPrompt = `## smplr Sampled Instrument Instructions

Sampled instruments powered by smplr. Use these objects when you want realistic playable instruments from Patchies MIDI messages.

CRITICAL RULES:
1. Connect the audio outlet to out~ to hear the instrument.
2. Trigger notes with Patchies MIDI messages from midi.in, midi.file, sequencer, js, msg, or worker.
3. Use the settings panel for instrument selection, volume, pan, default note, detune, and reverse playback.
4. soundfont~ and soundfont2~ support programChange for General MIDI-style program selection.

Messages:
- {type: 'noteOn', note, velocity, time?, duration?}: start a note. note can be a MIDI number or instrument-specific note name.
- {type: 'noteOff', note, time?}: stop a note.
- {type: 'programChange', program}: change the current program when supported.
- {type: 'controlChange', control, value}: forward MIDI CC to the instrument.
- {type: 'bang', time?, value?, offset?, duration?}: trigger the configured default note.
- number: trigger the configured default note with a gain multiplier.
- {type: 'setGain', value}: set output volume from 0 to 127.
- {type: 'setDetune', value}: set detune in cents.
- {type: 'setReverse', value}: toggle reversed playback.
- stop: stop active voices.

Example - Grand Piano:
\`\`\`json
{
  "type": "piano~",
  "data": {}
}
\`\`\`

Example - General MIDI Soundfont:
\`\`\`json
{
  "type": "soundfont~",
  "data": {
    "settings": {
      "instrument": "electric_piano_1"
    }
  }
}
\`\`\``;
