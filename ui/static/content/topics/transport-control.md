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
| **⋯**              | Overflow menu — contains **Timeline** and **Sync** toggles.                                       |

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

![Timeline viewer](/content/images/timeline-viewer.webp)

The timeline viewer shows a real-time visualization of all scheduled clock events (from `clock.onBeat`, `clock.schedule` and `clock.every`) across your patch. It helps you see when events fire and how they align with the beat grid.

Open the **⋯** overflow menu in the transport panel and click **Timeline** to toggle it.

### Timeline markers

| Marker       | Shape    | Scheduling Method                                         |
|--------------|----------|-----------------------------------------------------------|
| Triangle ▲   | Filled   | `clock.onBeat()` — drawn at each registered beat position |
| Diamond ◆    | Filled   | `clock.every()` — drawn at each upcoming repeat interval  |
| Dashed line  | Vertical | `clock.schedule()` — drawn at the scheduled time          |

Each node is assigned its own color. When an event fires, a brief radial glow appears at its position.

Use `clock.setTimelineStyle()` in your code to customize a node's color or hide it from the timeline entirely. See [Clock API](/docs/clock-api) for details.

### Interacting with the timeline

- _Click_ anywhere on the timeline to seek to that position.
- _Click and drag_ to scrub through time continuously.
- _Resize_ by dragging the left edge of the transport panel (desktop only).

## Network Sync

![Transport network sync](/content/images/transport-network-sync.webp)

Network Sync lets multiple Patchies instances in the same [peer-to-peer room](/docs/network-p2p) share a single transport. When enabled, all peers start, stop, and change BPM together — useful for multi-screen installations or collaborative live performance.

### Enabling

Open the **⋯** overflow menu and click **Sync**. The label updates to show your role:

- **Sync (leader)** — your transport is the source of truth; others follow you
- **Sync (2 peers)** — you are following the leader; transport controls are read-only

All peers in the room must enable Sync. The leader is elected automatically. If the leader disconnects, the next peer becomes leader.

### What gets synced

| Property | Behaviour |
| -------- | --------- |
| Play / Pause / Stop | Followers mirror the leader's state immediately |
| BPM | Updated on followers whenever the leader changes it |
| Time signature | Updated on followers whenever the leader changes it |
| Transport position | Followers seek to the leader's position on connect and correct drift every second |

When you enable Sync while the leader is already playing, your transport seeks forward to the leader's current position automatically — you join in the middle of the performance rather than starting from 0.

### Precision

Sync targets **beat-level accuracy** (~25 ms). It is not sample-accurate. For triggering audio precisely on a shared beat, use `clock.onBeat` or `clock.every` with `{ audio: true }` on each machine independently — the synchronized BPM and time origin ensure they fire at the same musical moment.

## See Also

- [Clock API](/docs/clock-api) — Beat-synced scheduling for code
- [P2P Messaging](/docs/network-p2p) — How rooms and peer connections work
- [beat](/docs/objects/beat) — Outputs current beat on each beat change
- [Audio Chaining](/docs/audio-chaining)
- [Video Chaining](/docs/video-chaining)
- [Audio Reactivity](/docs/audio-reactivity)
