# Transport Control

Patchies has a master clock that synchronizes all time-based objects (e.g. GLSL, Hydra, P5, Canvas, Three.js, JSRunner) to a single clock source. This enables perfect audio-visual sync across the patch.

## Opening the Transport Panel

Click the **transport button** (play icon) in the bottom toolbar to open the floating transport panel.

![Transport control bar](/content/images/transport-control-bar.webp)

## Controls

| Control | Description |
|---------|-------------|
| **Play/Pause** | Toggle playback. Pause freezes the clock at current position. Use `Space` as keyboard shortcut. |
| **Stop** | Resets clock to 0 and pauses. |
| **BPM** | Set tempo (beats per minute). Default: 120. Persisted across sessions. |
| **Time Signature** | Displays as `4/4`. Click to edit — type a fraction like `6/8` or `3/4` and press Enter. Denominator must be 2, 4, 8, or 16. Persisted across sessions. |
| **Time Display** | Shows current position. Click to toggle formats (see below). Double-click to edit and seek. |
| **Volume** | Master volume slider. |
| **DSP** | Toggle audio processing. Red when DSP is off (AudioContext suspended). |

## Time Display Formats

Click the time display to cycle through formats:

- **Time** `02:35:42` — Minutes:Seconds:Centiseconds
- **Bars** `001:1:01` — Bars:Beats:Sixteenths (respects current time signature)
- **Seconds** `00004.25` — Raw seconds with decimals

Double-click to edit the value and seek to a specific time.

## DSP vs Volume

These are independent controls:

- **DSP Off** suspends the AudioContext entirely — no audio processing happens
- **Mute/Volume** controls the output level but audio still processes in the background

When DSP is off and you press Play, visuals advance but audio remains silent.

## How Sync Works

All visual objects automatically read from the global transport:

- **GLSL**: `iTime` uniform matches transport seconds
- **Hydra**: `time` variable matches transport seconds
- **P5/Canvas/Three.js**: Use `clock.time` in your code
- **JSRunner**: `clock` object provides `time`, `beat`, `phase`, `bpm`

When you pause, ALL visuals freeze simultaneously. When you stop, everything resets to time 0.

For scheduling sample-accurate callbacks on specific beats and creating repeated patterns, see [Clock API](/docs/clock-api).

## See Also

- [Clock API](/docs/clock-api) — Beat-synced scheduling for code
- [beat](/docs/objects/beat) — Outputs current beat on each beat change
- [Audio Chaining](/docs/audio-chaining)
- [Video Chaining](/docs/video-chaining)
- [Audio Reactivity](/docs/audio-reactivity)
