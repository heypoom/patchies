By default, all tracks send MIDI messages through one outlet on every active step.

It is synced to the [global transport](/docs/transport-control) by default, but it can also be advance one step each incoming bang with the _manual clock_ option.

## MIDI Quickstart

Lay some beats on the sequencer. Connect the MIDI outlet to [drums~](/docs/objects/drums~) or [pads~](/docs/objects/pads~) to sequence MIDI and trigger those objects.

`pads~` let you load your own drum samples, while `drums~` provide built-in kits such as TR-808 and Roland CR-8000.

## Tracks

Add up to 8 tracks via the settings panel (gear icon). Each track has a name,
color, and an index numbered from 0 (top track) to 7 (bottom track).

Click any step button to toggle it on or off.

## Steps

Choose 4, 8, 12, 16, 24, or 32 steps from the settings panel. Every step
lasts one tempo beat, so changing the number of steps changes the pattern
length, not its speed.

In a 5/4 transport, an 8-step pattern continues across
the bar boundary instead of squeezing all eight steps into five beats.

## Clock Modes

Set via **Clock** in the settings panel:

- **auto** (default) — steps advance automatically in sync with the transport.
  Swing and BPM apply normally.
- **manual** — a clock inlet appears on the node. Each bang received advances
  the sequencer by one step, completely independent of the transport. Send
  `{ type: "reset" }` on the same inlet to jump back to step 1.

In manual mode, you can use `metro` for a free-running clock at any rate.
Swing has no effect in manual mode.

## Output Modes

Set via **Output** in the settings panel:

- **Single outlet** and **MIDI output** are enabled by default. Each active
  track sends `{type: "noteOn", note, index, velocity}` through outlet 0.
  Disable **MIDI output** to send track indices instead.
- Disable **Single outlet** for one outlet per track. In this mode,
  **bang** sends `{type: "bang"}` on each active step. Works with
  `sampler~`, `trigger`, and most nodes that expect a trigger signal.
- **value** — sends the step's velocity as a number from `0.0` to `1.0`.

Enable **Audio lookahead** to include precise Web Audio timing:

- **bang + Audio lookahead** — sends `{type: "bang", time}` for
  sample-accurate triggering with `sampler~`.
- **value + Audio lookahead** — sends `{type: "bang", time, value}` for
  sample-accurate velocity-style triggering with `sampler~`.
- **single outlet index + Audio lookahead** — sends
  `{type: "bang", index, value, time}` for scheduled triggering with track
  routing metadata.
- **single outlet midi + Audio lookahead** — sends
  `{type: "noteOn", note, index, velocity, time}` for scheduled drum-pad or MIDI
  triggering. `note` follows the GM drum map from 36 upward, `index` is the
  track number, and `velocity` is MIDI `0` to `127`.

## Velocity Lane

Enable **Velocity lane** in the settings panel (under Output) to reveal a
draggable velocity bar below each step row. Drag up/down to set the step's
value between `0.0` and `1.0`. Velocity is always stored internally even when
output mode is **bang**.

## Mute

Click the **mute** button to silence all output. The sequencer keeps running
but no messages are sent on any outlet. Click again to restore output.

## Swing

The **Swing** slider offsets every odd-numbered step (1, 3, 5, …) later in
time. At 50% swing, odd steps fire halfway between their grid position and the
next even step — classic shuffle feel.

## See Also

- [pads~](/docs/objects/pads~) - 8-pad drum machine with velocity and swing
- [metro](/docs/objects/metro) - Millisecond-interval metronome
- [sampler~](/docs/objects/sampler~) - Sample playback, triggered by bang
- [trigger](/docs/objects/trigger) - Route and split bang/value messages
- [orca](/docs/objects/orca) - Esoteric livecoding sequencer
