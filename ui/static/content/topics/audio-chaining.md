# Audio Chaining

You can chain many audio objects together to create audio effects and soundscapes.

![Audio chain example](/content/images/patchies-audio-chain.png)

> ✨ [Try this patch](/?id=b17136cy9rxxebw) - FM synthesis demo using oscillators, expressions, gain control, and frequency analysis.

## Fun Examples

Here's [a little patch](/?id=vdqg4fpgxeca8ot) by [@kijjaz](https://www.instagram.com/kijjaz) that uses mathematical expressions to make a beat:

![Beat example](/content/images/patchies-audio-super-fun.png)

Or build your own drum machine! [Try it out](/?id=w46um7gafe7hgle) - use the `W A S D` keys to play some drums.

![Simple drum machine](/content/images/patchies-simple-drums.png)

## How It Works

Connect audio objects together to build a signal chain — from sources through processors to output. Any object ending with `~` is an audio object.

**Important**: You must connect your audio chain to `out~` to hear anything. Use `gain~` to control the volume.

Browse all available audio objects in the object browser under the **Audio** category.

## Monitoring Audio

When patching with audio, it's useful to be able to view the audio data.

- [scope~](/docs/objects/scope~) - oscilloscope for viewing waveforms in real time
- [meter~](/docs/objects/meter~) - visual level meter for monitoring audio loudness
- [env~](/docs/objects/env~) - envelope follower that outputs the audio loudness as a number

See [Audio Reactivity](/docs/audio-reactivity) for more ways to interact and visualize audio data.

## Wireless Audio Routing

Connect distant audio objects without cables using named channels.

Create [`send~ <channel>`](/docs/objects/send~) and [`recv~ <channel>`](/docs/objects/recv~) objects anywhere in your patch. Audio sent to `send~` appears at matching `recv~` outlets:

```text
[osc~ 440] → [send~ synth]     ...     [recv~ synth] → [gain~ 0.5] → [out~]
```

This is useful for organizing complex audio routing or sending audio across different parts of a large patch.

## See Also

- [Video Chaining](/docs/video-chaining)
- [Connection Rules](/docs/connection-rules)
- [Audio Reactivity](/docs/audio-reactivity)
- [send~](/docs/objects/send~) - Send audio to named channel
- [recv~](/docs/objects/recv~) - Receive audio from named channel
