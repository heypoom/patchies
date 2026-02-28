# Transport Control

Patchies has a master clock that synchronizes all time-based objects (e.g. GLSL, Hydra, P5, Canvas, Three.js, JSRunner) to a single clock source. This enables perfect audio-visual sync across the patch.

## Opening the Transport Panel

Click the **transport button** (play icon) in the bottom toolbar to open the floating transport panel.

![Transport control bar](/content/images/transport-control-bar.webp)

## Controls

| Control            | Description                                                                                       |
|--------------------|---------------------------------------------------------------------------------------------------|
| **Play/Pause**     | Toggle playback. Pause freezes the clock at current position. Use `Space` as keyboard shortcut.   |
| **Stop**           | Resets clock to 0 and pauses.                                                                     |
| **BPM**            | Set tempo (beats per minute). Default: 120. Persisted across sessions.                            |
| **Time Signature** | Displays as `4/4`. Click to edit — type a fraction like `6/8` or `3/4` and press Enter.           |
| **Time Display**   | Shows current position. Click to toggle formats (see below). Double-click to edit and seek.       |
| **Volume**         | Master volume slider.                                                                             |
| **DSP**            | Toggle audio processing. Red when DSP is off (AudioContext suspended).                            |

For time signatures, the denominator must be 2, 4, 8, or 16. Time signatures are persisted across sessions.

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

### Visual Objects

Visual objects automatically read from the global transport:

- **GLSL**: `iTime` uniform matches transport seconds
- **Hydra**: `time` variable matches transport seconds
- **P5/Canvas/Three.js**: Use `clock.time` in your code
- **JSRunner**: `clock` object provides `time`, `beat`, `phase`, `bpm`

When you pause, ALL visuals freeze simultaneously. When you stop, everything resets to time 0.

### Musical Objects

Musical objects have their own internal clocks and can optionally sync to the transport. Enable **Sync to transport** in each node's overflow menu to lock its playback and BPM to the global transport. This is opt-in — by default these nodes run independently.

- [strudel](/docs/objects/strudel)
- [orca](/docs/objects/orca)
- [bytebeat~](/docs/objects/bytebeat~)
- [csound~](/docs/objects/csound~)

For scheduling sample-accurate callbacks on specific beats and creating repeated patterns, see [Clock API](/docs/clock-api).

## Timeline Viewer

The timeline viewer shows a real-time visualization of all scheduled clock events (from `clock.onBeat`, `clock.schedule` and `clock.every`) across your patch. It helps you see when events fire and how they align with the beat grid.

Click the **timeline button** (bar chart icon) in the transport panel to toggle the timeline.

### Timeline markers

| Marker       | Shape    | Scheduling Method                                         |
|--------------|----------|-----------------------------------------------------------|
| Triangle ▲   | Filled   | `clock.onBeat()` — drawn at each registered beat position |
| Diamond ◆    | Filled   | `clock.every()` — drawn at each upcoming repeat interval  |
| Dashed line  | Vertical | `clock.schedule()` — drawn at the scheduled time          |

Each node is assigned its own color. When an event fires, a brief radial glow appears at its position.

### Interacting with the timeline

- _Click_ anywhere on the timeline to seek to that position.
- _Click and drag_ to scrub through time continuously.
- _Resize_ by dragging the left edge of the transport panel (desktop only).

## See Also

- [Clock API](/docs/clock-api) — Beat-synced scheduling for code
- [beat](/docs/objects/beat) — Outputs current beat on each beat change
- [Audio Chaining](/docs/audio-chaining)
- [Video Chaining](/docs/video-chaining)
- [Audio Reactivity](/docs/audio-reactivity)
