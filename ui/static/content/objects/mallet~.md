Mallet sampled instrument for vibraphone, xylophone, bells, and related sounds.

Use `mallet~` for pitched percussion lines driven by MIDI note messages.
Connect the audio outlet to `out~`.

## Settings

Choose the mallet instrument in the settings panel, then adjust volume,
velocity, pan, default note, detune, and reverse playback.

## Messages

```text
{ type: "noteOn", note: 72, velocity: 95 }
{ type: "noteOff", note: 72 }
{ type: "bang", value: 0.8, duration: 0.4 }
```

## See Also

- [soundfont~](/docs/objects/soundfont~) - General MIDI instrument set
- [piano~](/docs/objects/piano~) - sampled piano
- [out~](/docs/objects/out~) - audio output
