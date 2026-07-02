Electric piano sampled instrument.

Use `epiano~` for Rhodes-like, Wurlitzer-like, and other electric piano parts
driven by MIDI messages. Connect the audio outlet to `out~`.

## Settings

Choose the electric piano model in the settings panel, then adjust volume,
velocity, pan, default note, detune, and reverse playback.

## Messages

```text
{ type: "noteOn", note: 64, velocity: 100 }
{ type: "noteOff", note: 64 }
{ type: "controlChange", control: 64, value: 127 }
{ type: "bang", value: 1, duration: 0.25 }
```

## See Also

- [piano~](/docs/objects/piano~) - acoustic piano samples
- [soundfont~](/docs/objects/soundfont~) - General MIDI instrument set
- [out~](/docs/objects/out~) - audio output
