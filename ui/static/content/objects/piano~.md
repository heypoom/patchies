Splendid Grand Piano sampled instrument.

Use `piano~` for realistic piano playback from MIDI notes. It works well with
`midi.in`, `midi.file`, `sequencer`, or a `js` object generating note messages.
Connect the audio outlet to `out~`.

## Settings

Open the settings panel to adjust decay time, volume, velocity, pan, default
note, detune, and reverse playback.

## Messages

```text
{ type: "noteOn", note: 60, velocity: 100, time: audioTime }
{ type: "noteOff", note: 60, time: audioTime }
{ type: "bang", value: 1, duration: 0.5 }
```

A number triggers the configured default note with that gain multiplier.

## See Also

- [epiano~](/docs/objects/epiano~) - electric piano samples
- [soundfont~](/docs/objects/soundfont~) - General MIDI instrument set
- [out~](/docs/objects/out~) - audio output
