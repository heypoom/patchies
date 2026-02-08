# Audio Chaining

Similar to video chaining, you can chain many audio objects together to create audio effects and soundscapes.

![Audio chain example](/content/images/patchies-audio-chain.png)

> ✨ [Try this patch](/?id=b17136cy9rxxebw) - FM synthesis demo using oscillators, expressions, gain control, and frequency analysis.

## Fun Examples

Here's [a little patch](/?id=vdqg4fpgxeca8ot) by [@kijjaz](https://www.instagram.com/kijjaz) that uses mathematical expressions to make a beat:

![Beat example](/content/images/patchies-audio-super-fun.png)

Or build your own drum machine! [Try it out](/?id=w46um7gafe7hgle) - use the `W A S D` keys to play some drums.

![Simple drum machine](/content/images/patchies-simple-drums.png)

## Audio Sources

Use these objects as audio sources:
- `osc~`, `sig~`, `mic~`
- `strudel`, `chuck~`
- `ai.tts`, `ai.music`
- `soundfile~`, `sampler~`
- `video`
- `dsp~`, `tone~`, `elem~`, `sonic~`

**Important**: You must connect your audio sources to `out~` to hear the audio output. Audio sources do not output audio unless connected to `out~`. Use `gain~` to control the volume.

## Audio Processing

Use these objects to process audio:
- `gain~` - volume control
- `fft~` - frequency analysis
- `+~` - signal addition
- Filters: `lowpass~`, `highpass~`, `bandpass~`, `allpass~`, `notch~`, `lowshelf~`, `highshelf~`, `peaking~`
- Effects: `compressor~`, `pan~`, `delay~`, `waveshaper~`, `convolver~`
- Custom: `expr~`, `dsp~`, `tone~`, `elem~`, `sonic~`

## Audio Output

Use `out~` to output audio to your speakers.

Use `fft~` to analyze the frequency spectrum. See [Audio Reactivity](/docs/audio-reactivity) for using FFT with visual objects.

## See Also

- [Video Chaining](/docs/video-chaining)
- [Connection Rules](/docs/connection-rules)
- [Audio Reactivity](/docs/audio-reactivity)
