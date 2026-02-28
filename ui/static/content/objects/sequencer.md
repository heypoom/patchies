A DAW-style step sequencer with up to 8 tracks, driven by the global
[transport](/docs/transport-control). Each track has its own outlet and fires on
every active step.

## Tracks

Add up to 8 tracks via the settings panel (gear icon). Each track has a name,
color, and its own outlet numbered from 0 (top track) to 7 (bottom track).

Click any step button to toggle it on or off.

## Steps

Choose 4, 8, 12, 16, 24, or 32 steps per bar from the settings panel. Steps
always fill exactly one bar regardless of time signature.

## Output Modes

Set via **Output** in the settings panel:

- **bang** (default) — sends `{type: "bang"}` on each active step. Works with
  `sampler~`, `trigger`, and most nodes that expect a trigger signal.
- **value** — sends the step's velocity as a number from `0.0` to `1.0`.
- **audio** — sends `{type: "set", time, value}` with the precise Web Audio
  lookahead time. Use this for sample-accurate scheduling with `sampler~` or
  custom `dsp~` nodes.

## Velocity Lane

Enable **Velocity lane** in the settings panel (under Output) to reveal a
draggable velocity bar below each step row. Drag up/down to set the step's
value between `0.0` and `1.0`. Velocity is always stored internally even when
output mode is **bang**.

## Swing

The **Swing** slider offsets every odd-numbered step (1, 3, 5, …) later in
time. At 50% swing, odd steps fire halfway between their grid position and the
next even step — classic shuffle feel.

## See Also

- [metro](/docs/objects/metro) - Millisecond-interval metronome
- [sampler~](/docs/objects/sampler~) - Sample playback, triggered by bang
- [trigger](/docs/objects/trigger) - Route and split bang/value messages
- [orca](/docs/objects/orca) - Esoteric livecoding sequencer
