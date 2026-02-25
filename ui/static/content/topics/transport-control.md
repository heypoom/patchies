# Transport Control

Patchies has a unified timing system that synchronizes all time-based objects (GLSL, Hydra, P5, Canvas, Three.js, JSRunner) to a single clock source. This enables perfect audio-visual sync across your entire patch.

## Opening the Transport Panel

Click the **transport button** (play icon) in the bottom toolbar to open the floating transport panel.

## Controls

| Control | Description |
|---------|-------------|
| **Play/Pause** | Toggle playback. Pause freezes the clock at current position. Use `Space` as keyboard shortcut. |
| **Stop** | Resets clock to 0 and pauses. |
| **BPM** | Set tempo (beats per minute). Default: 120. Persisted across sessions. |
| **Time Display** | Shows current position. Click to toggle formats (see below). Double-click to edit and seek. |
| **Volume** | Master volume slider. |
| **DSP** | Toggle audio processing. Red when DSP is off (AudioContext suspended). |

## Time Display Formats

Click the time display to cycle through formats:

- **Time** `02:35:42` — Minutes:Seconds:Centiseconds
- **Bars** `001:1:01` — Bars:Beats:Sixteenths (assumes 4/4 time)
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

## Pin (Freeze Frame)

Individual objects have a **Pin** button (in the object's context menu or preview) that freezes just that object's rendering. This is different from transport pause:

- **Transport Pause**: Freezes ALL objects, stops the global clock
- **Pin**: Freezes ONE object, clock keeps running for others

Use Pin for VJ-style freeze-frame effects while other visuals continue.

## Example: Beat-Synced Visuals

```javascript
// In a js, p5, canvas, or hydra object
// Flash on every beat
if (clock.beat !== lastBeat) {
  flash();
  lastBeat = clock.beat;
}

// Pulse based on beat phase
const pulse = 1 + Math.sin(clock.phase * Math.PI * 2) * 0.2;
circle(width/2, height/2, 100 * pulse);
```

For more advanced scheduling (callbacks on specific beats, repeating patterns), see [Clock API](/docs/clock-api).

## See Also

- [Clock API](/docs/clock-api) — Beat-synced scheduling for code
- [Audio Chaining](/docs/audio-chaining)
- [Video Chaining](/docs/video-chaining)
- [Audio Reactivity](/docs/audio-reactivity)
