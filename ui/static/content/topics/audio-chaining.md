# Audio Chaining

Connect audio objects to make a signal chain. Sound moves from a source through processors to an output. An object whose name ends with `~` is an audio object.

![Audio chain example](/content/images/patchies-audio-chain.png)

This audio chain sends an oscillator through a gain control to the output.

> ✨ [Try this patch](/?id=b17136cy9rxxebw) — FM synthesis using oscillators, expressions, gain control, and frequency analysis.

## How It Works

Think of audio chaining as a hardware signal chain: oscillator → filter → amp → speaker. Each `~` object processes a signal and sends it to the next object.

Keep these two rules in mind:

1. End the chain with `out~`. You do not hear sound until the signal reaches `out~`.
2. Use `gain~` to control volume. Connect it before `out~` to avoid clipping.

```text
[osc~ 440] → [gain~ 0.5] → [out~]
```

Find audio objects in the **Audio** category of the object browser.

## Try It

### Exercise — Simple tone

1. Create an `osc~ 440` object. It produces a 440 Hz sine wave.
2. Connect it to a `gain~ 0.3` object.
3. Connect `gain~` to `out~`.
4. Press play in the transport.
5. Listen for the tone.

### Exercise — Add a filter

1. Insert `lowpass~ 800` between `osc~` and `gain~`.
2. Change the frequency value.
3. Listen for the tone to get brighter or darker.

## Monitoring Audio

Use these objects to monitor an audio chain:

- [scope~](/docs/objects/scope~) — Show the waveform shape in real time.
- [tap~](/docs/objects/tap~) — Send waveform frames as messages to canvas or GLSL.
- [meter~](/docs/objects/meter~) — Show loudness as a level bar.
- [env~](/docs/objects/env~) — Send loudness as a number you can route elsewhere.

See [Audio Reactivity](/docs/audio-reactivity) to use audio data for visuals.

## Fun Examples

[This patch](/?id=93ip4c2tmua45ho) by [@kijjaz](https://www.instagram.com/kijjaz) creates a beat with mathematical expressions:

![Beat example](/content/images/patchies-audio-super-fun.png)

Build a drum machine with [this patch](/?id=w46um7gafe7hgle). Use `W A S D` to play drums:

![Simple drum machine](/content/images/patchies-simple-drums.png)

## Wireless Audio Routing

Use [`send~ <channel>`](/docs/objects/send~) and [`recv~ <channel>`](/docs/objects/recv~) to route audio across a patch without cables:

```text
[osc~ 440] → [send~ synth]          [recv~ synth] → [gain~ 0.5] → [out~]
```

This keeps complex patches readable by removing long cables.

## See Also

- [Audio Reactivity](/docs/audio-reactivity) — Drive visuals with audio data.
- [Video Chaining](/docs/video-chaining) — Connect visual objects.
- [Data Types](/docs/data-types) — Learn about Patchies data types.
- [send~](/docs/objects/send~) — Send audio to a named channel.
- [recv~](/docs/objects/recv~) — Receive audio from a named channel.
