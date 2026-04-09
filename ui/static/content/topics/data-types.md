# Data Types

Every handle in Patchies has a type — **video**, **audio**, **message**, or **analysis** — shown by its color. You can only connect handles whose types are compatible.

![Data Types](/content/images/connection-guide.webp)

## Handle Colors

| Color | Type | Used for |
| --- | --- | --- |
| Orange | Video | Visual frames between visual objects |
| Blue | Audio | Audio signals between `~` objects |
| Gray | Message | Numbers, strings, bangs, and custom data |
| Purple | Analysis | FFT frequency data from `fft~` |

## Basic Rules

- **Multiple connections are fine** — one outlet can feed many inlets, and one inlet can receive from many outlets
- **Video (orange)** connects only to video inlets
- **Audio (blue)** connects to audio inlets, and also to *audio parameter* inlets (see below)
- **Message (gray)** connects to message inlets, and also to *float-accepting signal* inlets (see below)
- **Analysis (purple)** from `fft~` connects to both message and video inlets

## Audio Parameter Modulation

Some audio object inlets are *audio parameters* rather than raw signal inlets — for example, `osc~`'s frequency and `gain~`'s gain. These are special: they accept both message *and* audio signals.

This lets you modulate a parameter with another oscillator:

```text
[osc~ 2] ──► [osc~ 440].frequency   (2 Hz wobble on the pitch)
```

> **Tip**: When you start dragging from a blue (audio) outlet, any audio parameter inlets in the patch turn from gray to blue to show they're connectable.

## Float-to-Signal Inlets

Some signal inlets accept a plain float number to set a constant value — a pattern borrowed from Pure Data. Arithmetic objects like `+~`, `*~`, `-~`, `/~` and comparison objects like `>~`, `<~`, `min~`, `max~` all work this way.

```text
[msg 0.5] ──► [*~ ].inlet 1     (sets the multiplier to 0.5)
```

You can connect either a **message outlet** or an **audio outlet** to these inlets:

- Sending a float sets the constant used when no audio signal is connected
- The constant can also be set as a creation argument: `*~ 0.5` multiplies by 0.5 from the start

## See Also

- [Connecting Objects](/docs/connecting-objects)
- [Audio Chaining](/docs/audio-chaining)
- [Video Chaining](/docs/video-chaining)
