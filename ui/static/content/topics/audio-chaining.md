# Audio Chaining

Audio objects connect together to form a signal chain — sound flows from sources through processors to output. Any object whose name ends with `~` is an audio object.

![Audio chain example](/content/images/patchies-audio-chain.png)

> ✨ [Try this patch](/?id=b17136cy9rxxebw) — FM synthesis using oscillators, expressions, gain control, and frequency analysis.

---

## How It Works

Think of audio chaining like a hardware signal chain: oscillator → filter → amp → speaker. Each `~` object processes the signal and passes it to the next.

**Two rules to remember:**

1. **End your chain with `out~`** — nothing is audible until the signal reaches `out~`
2. **Use `gain~` to control volume** — connect it just before `out~` to avoid clipping

```text
[osc~ 440] → [gain~ 0.5] → [out~]
```

Browse all audio objects in the object browser under the **Audio** category.

---

## Try It

### Exercise — Simple tone

1. Create an `osc~ 440` object (a 440 Hz sine wave)
2. Connect it to a `gain~ 0.3` object
3. Connect `gain~` to `out~`
4. Press play in the transport — you should hear a tone

### Exercise — Add a filter

1. Insert a `lowpass~ 800` between `osc~` and `gain~`
2. Drag the frequency value up and down — hear the tone get brighter and darker

---

## Monitoring Audio

Visualize what's happening in your audio chain:

- [scope~](/docs/objects/scope~) — oscilloscope, shows waveform shape in real time
- [meter~](/docs/objects/meter~) — level meter, shows loudness as a visual bar
- [env~](/docs/objects/env~) — envelope follower, outputs loudness as a number you can route elsewhere

See [Audio Reactivity](/docs/audio-reactivity) to use audio data to drive visuals.

---

## Fun Examples

Here's [a patch](/?id=93ip4c2tmua45ho) by [@kijjaz](https://www.instagram.com/kijjaz) that generates a beat entirely from mathematical expressions:

![Beat example](/content/images/patchies-audio-super-fun.png)

Or build your own drum machine — [try it out](/?id=w46um7gafe7hgle) and use `W A S D` to play some drums:

![Simple drum machine](/content/images/patchies-simple-drums.png)

---

## Wireless Audio Routing

You don't always need a cable. Use [`send~ <channel>`](/docs/objects/send~) and [`recv~ <channel>`](/docs/objects/recv~) to route audio wirelessly across the patch:

```text
[osc~ 440] → [send~ synth]          [recv~ synth] → [gain~ 0.5] → [out~]
```

This keeps complex patches readable by removing long-distance cables.

---

## See Also

- [Audio Reactivity](/docs/audio-reactivity) — Drive visuals from audio data
- [Video Chaining](/docs/video-chaining)
- [Connection Rules](/docs/connection-rules)
- [send~](/docs/objects/send~) — Send audio to a named channel
- [recv~](/docs/objects/recv~) — Receive audio from a named channel
