Mellotron archive sampled instrument.

Use `mellotron~` for tape-style choirs, strings, flutes, brass, and other
classic Mellotron textures. Connect the audio outlet to `out~`.

## Settings

Choose the Mellotron sound in the settings panel, then adjust volume, velocity,
pan, default note, detune, and reverse playback.

## Messages

```text
{ type: "noteOn", note: 60, velocity: 100 }
{ type: "noteOff", note: 60 }
{ type: "bang", value: 1, duration: 1.5 }
```

## See Also

- [soundfont~](/docs/objects/soundfont~) - General MIDI instrument set
- [versilian~](/docs/objects/versilian~) - Versilian sampled library
- [out~](/docs/objects/out~) - audio output
