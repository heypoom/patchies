# 77. Global Transport Control

A unified timing system for Patchies that synchronizes all time-based nodes (GLSL, Hydra, JSRunner, tone~) to a single clock source.

## Problem

There is no way to keep visual and audio in perfect sync (beat-match) in Patchies. Everything has its own clock:

- GLSL has its own `iTime`
- Hydra has its own `time`
- tone~ nodes run independently
- JSRunner loops have no shared clock reference

## MVP Scope

### Transport Controls

| Control          | Behavior                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| **Play/Pause**   | Toggle button. Pause freezes the clock at current position.                                                 |
| **Stop**         | Resets clock to 0 and pauses.                                                                               |
| **BPM**          | Manual number input. Default: 120.                                                                          |
| **Time Display** | Shows current position. Default: seconds (`00:04.25`). Click to toggle to bars:beats:sixteenths (`2:3:04`). |
| **DSP On/Off**   | Mute-style button. Red when DSP is off (AudioContext suspended).                                            |

### UI

- **Floating bottom panel** triggered by a transport button in the toolbar
- Upgrades the existing Volume Control button to open the transport panel
- Volume control moves inside the transport panel
- Panel is hideable to keep the canvas minimal

### Architecture

#### Interface-First Design

Both the full Tone.js transport and the stub transport implement the same interface. This allows:

- Swapping implementations at runtime (e.g., lite embed mode)
- Testing with the stub transport
- Gradual migration from stub → full transport on first play

```typescript
// src/lib/transport/types.ts
export interface ITransport {
  // State (read-only)
  readonly seconds: number;
  readonly ticks: number;
  readonly bpm: number;
  readonly isPlaying: boolean;
  readonly beat: number; // current beat in measure (0-3)
  readonly progress: number; // 0.0-1.0 position in current bar

  // Controls
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  setBpm(bpm: number): void;

  // DSP control (no-op in stub)
  setDspEnabled(enabled: boolean): Promise<void>;
}
```

#### Stub Transport (Default)

The stub transport is the default implementation. It uses `performance.now()` for timing and doesn't require Tone.js:

```typescript
// src/lib/transport/StubTransport.ts
export class StubTransport implements ITransport {
  private startTime = 0;
  private pausedAt = 0;
  private _isPlaying = false;
  private _bpm = 120;
  private readonly ppq = 192;

  get seconds(): number {
    if (!this._isPlaying) return this.pausedAt;
    return (performance.now() - this.startTime) / 1000;
  }

  get ticks(): number {
    return this.seconds * (this._bpm / 60) * this.ppq;
  }

  get bpm(): number {
    return this._bpm;
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  get beat(): number {
    return Math.floor(this.ticks / this.ppq) % 4;
  }

  get progress(): number {
    return (this.ticks % this.ppq) / this.ppq;
  }

  async play(): Promise<void> {
    this.startTime = performance.now() - this.pausedAt * 1000;
    this._isPlaying = true;
  }

  pause(): void {
    this.pausedAt = this.seconds;
    this._isPlaying = false;
  }

  stop(): void {
    this.pausedAt = 0;
    this._isPlaying = false;
  }

  setBpm(bpm: number): void {
    this._bpm = bpm;
  }

  async setDspEnabled(_enabled: boolean): Promise<void> {
    // No-op in stub - no audio context to suspend
  }
}
```

#### Full Transport (Tone.js)

The full transport wraps `Tone.Transport` for sample-accurate audio scheduling:

```typescript
// src/lib/transport/ToneTransport.ts
import type * as ToneType from "tone";

export class ToneTransport implements ITransport {
  private tone: typeof ToneType;
  private _bpm = 120;

  constructor(tone: typeof ToneType) {
    this.tone = tone;
    this.tone.Transport.bpm.value = this._bpm;
  }

  get seconds(): number {
    return this.tone.Transport.seconds;
  }

  get ticks(): number {
    return this.tone.Transport.ticks;
  }

  get bpm(): number {
    return this._bpm;
  }

  get isPlaying(): boolean {
    return this.tone.Transport.state === "started";
  }

  get beat(): number {
    return Math.floor(this.ticks / 192) % 4;
  }

  get progress(): number {
    return (this.ticks % 192) / 192;
  }

  async play(): Promise<void> {
    await this.tone.start();
    this.tone.Transport.start();
  }

  pause(): void {
    this.tone.Transport.pause();
  }

  stop(): void {
    this.tone.Transport.stop();
    this.tone.Transport.seconds = 0;
  }

  setBpm(bpm: number): void {
    this._bpm = bpm;
    this.tone.Transport.bpm.value = bpm;
  }

  async setDspEnabled(enabled: boolean): Promise<void> {
    const ctx = this.tone.getContext().rawContext;
    if (enabled) {
      await ctx.resume();
    } else {
      await ctx.suspend();
    }
  }
}
```

#### Global Singleton with Lazy Upgrade

The exported `Transport` singleton starts as a stub and upgrades to Tone.js on first play:

```typescript
// src/lib/transport/Transport.ts
import { StubTransport } from "./StubTransport";
import type { ITransport } from "./types";

class TransportManager {
  private impl: ITransport = new StubTransport();
  private upgraded = false;

  // Proxy all reads to current implementation
  get seconds() {
    return this.impl.seconds;
  }
  get ticks() {
    return this.impl.ticks;
  }
  get bpm() {
    return this.impl.bpm;
  }
  get isPlaying() {
    return this.impl.isPlaying;
  }
  get beat() {
    return this.impl.beat;
  }
  get progress() {
    return this.impl.progress;
  }

  async play(): Promise<void> {
    if (!this.upgraded) {
      await this.upgrade();
    }
    return this.impl.play();
  }

  pause(): void {
    this.impl.pause();
  }
  stop(): void {
    this.impl.stop();
  }
  setBpm(bpm: number): void {
    this.impl.setBpm(bpm);
  }
  setDspEnabled(enabled: boolean): Promise<void> {
    return this.impl.setDspEnabled(enabled);
  }

  private async upgrade(): Promise<void> {
    const Tone = await import("tone");
    const { ToneTransport } = await import("./ToneTransport");

    // Transfer state from stub to full transport
    const currentBpm = this.impl.bpm;

    this.impl = new ToneTransport(Tone);
    this.impl.setBpm(currentBpm);
    this.upgraded = true;
  }
}

export const Transport = new TransportManager();
```

This design ensures:

1. **Zero Tone.js in initial bundle** - Stub works standalone
2. **Seamless upgrade** - BPM transfers when upgrading to full transport
3. **Embed mode** - Skip upgrade entirely for lite embeds (future: add `disableUpgrade()` method)

#### Auto-Sync All Time-Based Nodes

All time-based nodes read from the Transport singleton:

**GLSL:**

```typescript
// In GLSL render loop
uniforms.iTime = Transport.seconds;
uniforms.iBeat = Transport.beat; // optional
```

**Hydra:**

```typescript
// In Hydra update loop or Tone.Draw.schedule callback
hydra.synth.time = Transport.seconds;
```

**JSRunner:**

```typescript
// Available in JS node context
const clock = {
  time: Transport.seconds,
  ticks: Transport.ticks,
  beat: Transport.beat,
  progress: Transport.progress, // (ticks % PPQ) / PPQ
  bpm: Transport.bpm,
};
```

**tone~ nodes:**
Already use Tone.js internally, so they automatically sync when `Tone.Transport` is the source.

#### DSP On/Off

The `setDspEnabled()` method is part of the `ITransport` interface:

- **StubTransport**: No-op (no audio context to control)
- **ToneTransport**: Suspends/resumes the AudioContext

When DSP is off and user hits Play:

- Visual clock advances normally
- Audio remains suspended (no sound)
- No warning/modal - silent behavior

### Visual-Audio Sync

Use `Tone.Draw.schedule()` to bridge audio-thread timing to visual-frame timing:

```typescript
// For frame-accurate visual callbacks
Tone.Draw.schedule(() => {
  // This fires at the visually correct time,
  // compensating for audio lookahead
  updateVisualsForBeat(Transport.beat);
}, time);
```

### Constants

```typescript
// src/lib/transport/constants.ts
export const DEFAULT_BPM = 120;
export const DEFAULT_PPQ = 192; // pulses per quarter note (future use)
```

## UI Components

### TransportButton

Toolbar button that opens the transport panel. Replaces or augments the current Volume Control button.

### TransportPanel

Floating panel anchored to bottom of screen:

```
┌─────────────────────────────────────────────────────────┐
│  [▶/❚❚]  [■]  │  00:04.25  │  BPM: [120]  │  🔊 [━━━●━]  │  [DSP]  │
└─────────────────────────────────────────────────────────┘
```

- Play/Pause toggle button
- Stop button
- Time display (clickable to toggle format)
- BPM input field
- Volume slider (moved from old location)
- DSP toggle (red when off)

## Future Scope

These features are documented for later implementation:

### Tap Tempo & Nudge

- Tap button: Click rhythmically to detect tempo
- Nudge buttons: ±1 BPM or ±0.1 BPM fine adjustment

### Metronome

- Toggle for audible click on each beat
- Separate volume control for metronome
- Useful for verifying sync

### Scrubbing / Timeline

- Visual timeline bar showing current position
- Click to jump to position
- Drag to scrub through time
- Consider: what to show? just time? waveform? markers?

### Latency / Lookahead Control

- Slider from 10ms to 100ms
- Affects visual-audio sync compensation
- Advanced users only

### PPQ Settings

- Pulses per quarter note configuration
- Default: 192 (standard)
- Options: 96 (lower CPU), 384, 960 (super high-res)
- In advanced settings menu

### External Sync

- Sync source selector: Internal / Follower / External
- MIDI Clock input
- SMPTE timecode
- Ableton Link support

### Networked Sync

- Leader election for multi-client sessions
- Timestamped start commands
- Latency compensation per client
- Quantized start for tight sync

### Lite/Embed Mode

Add a `disableUpgrade()` method to `TransportManager` that prevents the stub→Tone.js upgrade. This keeps the bundle small for embedded Patchies instances that don't need sample-accurate audio sync.

```typescript
// In embed initialization
import { Transport } from "$lib/transport/Transport";
Transport.disableUpgrade(); // Stay on StubTransport forever
```

## Files to Create/Modify

### New Files

- `src/lib/transport/types.ts` - `ITransport` interface
- `src/lib/transport/StubTransport.ts` - Lightweight `performance.now()` implementation
- `src/lib/transport/ToneTransport.ts` - Full Tone.js implementation
- `src/lib/transport/Transport.ts` - Global singleton with lazy upgrade
- `src/lib/transport/constants.ts` - Default values (BPM, PPQ)
- `src/lib/components/transport/TransportPanel.svelte` - UI panel
- `src/lib/components/transport/TransportButton.svelte` - Toolbar button

### Modifications

- `src/lib/components/nodes/GLSLNode.svelte` - Use `Transport.seconds` for `iTime`
- `src/lib/components/nodes/HydraNode.svelte` - Use `Transport.seconds` for `time`
- `src/lib/js-runner/JSRunner.ts` - Expose `clock` object in context
- `src/lib/audio/v2/nodes/ToneNode.ts` - Ensure it uses shared `Tone.Transport`
- Toolbar component - Add transport button, potentially remove/relocate volume button

## Open Questions

1. **Time signature**: Should we support configurable time signatures (4/4, 3/4, 6/8) in MVP or defer?
   - _Recommendation_: Defer. Assume 4/4 for MVP.

2. **Loop regions**: Should transport support loop start/end points?
   - _Recommendation_: Defer. No looping in MVP.

3. **Multiple transports**: Could advanced users want multiple independent clocks?
   - _Recommendation_: Out of scope. Single global transport for simplicity.
