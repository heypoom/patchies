Classic drum machine sampled instrument.

Use `drums~` for sampled drum machines such as the TR-808. It responds to
MIDI note messages, with note `36` as the default trigger note. Connect the
audio outlet to `out~`.

## Settings

Choose the drum machine in the settings panel, then adjust volume, velocity,
pan, default note, detune, and reverse playback.

## Messages

```text
{ type: "noteOn", note: 36, velocity: 110 }
{ type: "noteOff", note: 36 }
{ type: "bang", value: 1 }
```

## See Also

- [pads~](/docs/objects/pads~) - 16-pad drum sampler with user-loaded samples
- [sampler~](/docs/objects/sampler~) - single-sample playback
- [out~](/docs/objects/out~) - audio output
