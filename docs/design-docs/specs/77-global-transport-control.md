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

## Implementation Details

### Worker Bridge (Critical Challenge)

GLSL and Hydra run in a web worker (`renderWorker.ts`), but Transport lives on the main thread. We need to bridge time values across this boundary.

#### Current Time Handling

**fboRenderer.ts** (lines 79-84):

```typescript
private lastTime: number = 0;
private startTime: number = Date.now();
// In renderFrame():
const currentTime = (Date.now() - this.startTime) / 1000;
```

**shadertoy-draw.ts** (line 124):

```typescript
iTime: ({ time }) => time, // Uses regl's internal clock
```

**hydraRenderer.ts** (line 104):

```typescript
this.hydra.synth.time += deltaTime * 0.001 * this.hydra.synth.speed;
```

#### Solution: Transport Time Sync Message

Main thread sends periodic time updates to worker via GLSystem:

```typescript
// GLSystem.ts - add to animation frame loop
syncTransportTime(state: TransportState): void {
  this.send('syncTransportTime', state);
}

// Call at 60fps for smooth visual sync
```

Worker receives and stores transport state:

```typescript
// renderWorker.ts - handle sync message
.with({ type: 'syncTransportTime' }, ({ data }) => {
  fboRenderer.setTransportTime(data);
})

// fboRenderer.ts - store transport time
private transportTime: TransportState | null = null;

setTransportTime(data: TransportState): void {
  this.transportTime = data;
}
```

#### GLSL Integration

Change `shadertoy-draw.ts` to use transport time via props:

```typescript
// Add to P type:
type P = {
  // ... existing
  transportTime: number;
};

// Change uniform:
iTime: (_, props: P) => props.transportTime,
```

Pass from fboRenderer when rendering:

```typescript
fboNode.draw({
  // ... existing props
  transportTime: this.transportTime?.seconds ?? this.lastTime,
});
```

#### Hydra Integration

Change `hydraRenderer.ts` to use transport time:

```typescript
renderFrame(params: RenderParams) {
  if (this.renderer.transportTime) {
    // Use global transport time
    this.hydra.synth.time = this.renderer.transportTime.seconds;
  } else {
    // Fallback to local accumulator
    this.hydra.synth.time += deltaTime * 0.001 * this.hydra.synth.speed;
  }
}
```

### JSRunner Integration

Add `clock` object to JSRunner context (`JSRunner.ts` lines 330-368):

```typescript
// Add to functionParams:
const functionParams = [
  // ... existing
  "clock",
];

// Add to functionArgs:
import { Transport } from "$lib/transport";

const clock = {
  get time() {
    return Transport.seconds;
  },
  get ticks() {
    return Transport.ticks;
  },
  get beat() {
    return Transport.beat;
  },
  get progress() {
    return Transport.progress;
  },
  get bpm() {
    return Transport.bpm;
  },
};

const functionArgs = [
  // ... existing
  clock,
];
```

### State Persistence

Create `src/stores/transport.store.ts` following existing patterns (see `preset-library.store.ts`):

```typescript
const STORAGE_KEY = "patchies:transport";

export interface TransportStoreState {
  bpm: number;
  timeDisplayFormat: "seconds" | "bars";
}

// Persist BPM preference to localStorage
// Sync with TransportManager on load
```

### Toolbar Integration

The existing `VolumeControl.svelte` in `BottomToolbar.svelte` will be replaced with a `TransportButton` that opens the `TransportPanel`. Volume control moves inside the panel.

**BottomToolbar.svelte** changes:

- Replace `<VolumeControl />` with `<TransportButton />`
- TransportButton uses Popover pattern (like overflow menu)

## Files to Create/Modify

### New Files

| File                                                 | Purpose                            |
| ---------------------------------------------------- | ---------------------------------- |
| `src/lib/transport/types.ts`                         | `ITransport` interface             |
| `src/lib/transport/constants.ts`                     | `DEFAULT_BPM`, `DEFAULT_PPQ`       |
| `src/lib/transport/StubTransport.ts`                 | `performance.now()` implementation |
| `src/lib/transport/ToneTransport.ts`                 | Tone.js wrapper                    |
| `src/lib/transport/Transport.ts`                     | Global singleton with lazy upgrade |
| `src/lib/transport/index.ts`                         | Barrel exports                     |
| `src/stores/transport.store.ts`                      | BPM/format persistence             |
| `src/lib/components/transport/TransportPanel.svelte` | Floating panel UI                  |
| `src/lib/components/transport/TimeDisplay.svelte`    | Clickable time format toggle       |
| `src/lib/components/transport/index.ts`              | Barrel exports                     |

### Modifications

| File                                      | Change                                       |
| ----------------------------------------- | -------------------------------------------- |
| `src/lib/canvas/GLSystem.ts`              | Add `syncTransportTime()` method             |
| `src/workers/rendering/renderWorker.ts`   | Handle `syncTransportTime` message           |
| `src/workers/rendering/fboRenderer.ts`    | Store and distribute transport time to nodes |
| `src/lib/canvas/shadertoy-draw.ts`        | Use `props.transportTime` for `iTime`        |
| `src/workers/rendering/hydraRenderer.ts`  | Use transport time for `synth.time`          |
| `src/lib/js-runner/JSRunner.ts`           | Add `clock` object to execution context      |
| `src/lib/components/BottomToolbar.svelte` | Replace VolumeControl with TransportButton   |
| `src/lib/components/VolumeControl.svelte` | Move into TransportPanel (or inline)         |

## Implementation Order

1. **Transport Core** - Create types, constants, StubTransport, ToneTransport, Transport singleton
2. **State Store** - Create transport.store.ts for persistence
3. **JSRunner Integration** - Add clock object (main thread only, quick win)
4. **Worker Bridge** - GLSystem sync, renderWorker handler, fboRenderer storage
5. **GLSL/Hydra Integration** - Update shadertoy-draw.ts and hydraRenderer.ts
6. **UI Components** - TransportPanel, TimeDisplay, toolbar integration

## Verification

### Unit Tests

- StubTransport: seconds/ticks/beat/progress calculations
- BPM changes affect tick rate correctly
- State transfer during stub→tone upgrade

### Manual Testing

1. Play/pause freezes ALL visuals simultaneously
2. Stop resets time to 0 across all nodes
3. BPM changes affect JSRunner `clock.beat` and `clock.progress`
4. GLSL `iTime` matches Transport.seconds
5. Hydra `time` variable matches Transport.seconds
6. DSP toggle mutes audio but visuals continue
7. Volume control works in new location

## Resolved Questions

1. **Time signature**: Deferred. Assume 4/4 for MVP. Keep extensible for future time signature support.
2. **Loop regions**: Deferred. No looping in MVP. Keep extensible for future loop start/end points.
3. **Multiple transports**: Out of scope. Single global transport for simplicity.

---

## Implementation Status

Completed: 2024-02-24

### Files Created

| File                                                 | Purpose                                                          |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| `src/lib/transport/types.ts`                         | `ITransport` interface and `TransportState` type for worker sync |
| `src/lib/transport/StubTransport.ts`                 | Default transport using `performance.now()`, no Tone.js          |
| `src/lib/transport/ToneTransport.ts`                 | Tone.js wrapper for sample-accurate audio scheduling             |
| `src/lib/transport/Transport.ts`                     | `TransportManager` singleton with lazy upgrade pattern           |
| `src/lib/transport/index.ts`                         | Barrel exports                                                   |
| `src/stores/transport.store.ts`                      | Persists BPM, timeDisplayFormat, panelOpen to localStorage       |
| `src/lib/components/transport/TransportPanel.svelte` | Full transport panel UI                                          |
| `src/lib/components/transport/index.ts`              | Barrel exports                                                   |

### Files Modified

| File                                            | Changes                                                                                               |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/lib/js-runner/JSRunner.ts`                 | Added `clock` object to execution context with getters for `time`, `ticks`, `beat`, `progress`, `bpm` |
| `src/lib/canvas/GLSystem.ts`                    | Added `startTransportSync()`, `stopTransportSync()`, `syncTransportTime()`. Transport syncs at 60fps  |
| `src/workers/rendering/renderWorker.ts`         | Handles `syncTransportTime` message, passes to fboRenderer                                            |
| `src/workers/rendering/fboRenderer.ts`          | Added `transportTime` property and `setTransportTime()` method, passes to render props                |
| `src/lib/canvas/shadertoy-draw.ts`              | Changed `iTime` uniform to use `props.transportTime` instead of regl's internal clock                 |
| `src/workers/rendering/hydraRenderer.ts`        | Changed to directly set `this.hydra.synth.time = params.transportTime`                                |
| `src/lib/rendering/types.ts`                    | Added `transportTime: number` to `RenderParams` interface                                             |
| `src/lib/components/BottomToolbar.svelte`       | Replaced VolumeControl with Popover containing TransportPanel. Added tooltips to all toolbar buttons  |
| `src/lib/components/ObjectPreviewLayout.svelte` | Renamed individual node toggle to Pin/PinOff icons. All buttons now use Tooltip components            |

### Key Implementation Details

#### Transport Architecture

- StubTransport is the default, using `performance.now()` for zero Tone.js bundle cost
- ToneTransport is lazy-loaded on first `play()` call
- State (BPM) transfers seamlessly during upgrade
- `disableUpgrade()` method available for embed mode

#### Worker Bridge

- GLSystem starts 60fps sync interval when animation starts (`startTransportSync()`)
- Transport state (`seconds`, `ticks`, `bpm`, `isPlaying`, `beat`, `progress`) sent via `syncTransportTime` message
- fboRenderer stores state and passes `transportTime` to all render props

#### DSP vs Volume Independence

- DSP toggle controls `AudioContext.suspend()`/`resume()` and `Transport.setDspEnabled()`
- Volume/mute controls `AudioService.setOutVolume()` independently
- Both can be controlled separately - muting doesn't disable DSP, disabling DSP doesn't affect volume state

#### UI Features

- Floating popover panel anchored to transport button in bottom toolbar
- `onInteractOutside={(e) => e.preventDefault()}` keeps panel open when clicking outside
- Time display toggles between seconds (`00:04.25`) and bars:beats:sixteenths (`2:3:04`)
- BPM persisted to localStorage
- All toolbar buttons use shadcn-svelte Tooltip components (replaced native `title` attributes)
- Platform-aware keyboard shortcuts (⌘ on Mac, Ctrl on Windows/Linux)
- Individual node "Pin" button (Pin/PinOff icons) stops rendering entirely for VJ freeze-frame effects
  - Distinct from global Play/Pause which controls the transport clock

### Verification Checklist

- [x] Play/pause freezes all visuals simultaneously
- [x] Stop resets time to 0 across all nodes
- [x] BPM changes affect JSRunner `clock.beat` and `clock.progress`
- [x] GLSL `iTime` matches Transport.seconds
- [x] Hydra `time` variable matches Transport.seconds
- [x] DSP toggle suspends/resumes audio independently of volume
- [x] Volume control works in transport panel
- [x] Panel stays open when clicking outside
- [x] BPM persists across sessions
