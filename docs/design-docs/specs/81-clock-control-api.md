# 81. Clock Control API

Extend the clock object with control methods and time signature support. Works bidirectionally across main thread and workers.

## Status: Implemented

## Problem

1. **Time signature locked to 4/4**: `clock.beat` hardcoded to `% 4`
2. **No subdivision support**: Can't easily work with triplets, quintuplets, etc.
3. **Read-only clock**: Can't control transport from within code (play/pause/setBpm)
4. **Worker limitation**: Workers receive state but can't send commands back

## Solution

Add control methods to the clock object that work uniformly in main thread and workers.

## API Additions

### Time Signature & Subdivision

| Property                    | Type   | Description                                                  |
| --------------------------- | ------ | ------------------------------------------------------------ |
| `clock.bar`                 | number | Current bar (0-indexed)                                      |
| `clock.beatsPerBar`         | number | Beats per bar (default: 4)                                   |
| `clock.subdivision`         | number | Current subdivision within beat (0 to subdivisionsPerBeat-1) |
| `clock.subdivisionsPerBeat` | number | Subdivisions per beat (default: 4 = sixteenths)              |

### Control Methods

| Method                                | Description                                         |
| ------------------------------------- | --------------------------------------------------- |
| `clock.play()`                        | Start transport                                     |
| `clock.pause()`                       | Pause transport                                     |
| `clock.stop()`                        | Stop and reset to 0                                 |
| `clock.setBpm(bpm)`                   | Set tempo                                           |
| `clock.setTimeSignature(beatsPerBar)` | Set beats per bar (e.g., 3 for 3/4)                 |
| `clock.setSubdivisions(n)`            | Set subdivisions per beat (e.g., 5 for quintuplets) |
| `clock.seek(time)`                    | Seek to time in seconds                             |

## Implementation

### Architecture

```
┌─────────────────┐                    ┌─────────────────┐
│   Main Thread   │                    │     Worker      │
│                 │  syncTransportTime │                 │
│   Transport ────┼───────────────────>│   clock (read)  │
│   Singleton     │                    │                 │
│                 │  clockCommand      │                 │
│                 │<───────────────────┼── clock.play()  │
└─────────────────┘                    └─────────────────┘
```

### Transport Interface Updates

```typescript
// src/lib/transport/types.ts
export interface ITransport {
  // Existing
  readonly seconds: number;
  readonly ticks: number;
  readonly bpm: number;
  readonly isPlaying: boolean;
  readonly beat: number;
  readonly phase: number;

  // New: Time signature
  readonly bar: number;
  readonly beatsPerBar: number;
  readonly subdivision: number;
  readonly subdivisionsPerBeat: number;

  // Existing controls
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(seconds: number): void;
  setBpm(bpm: number): void;
  setDspEnabled(enabled: boolean): Promise<void>;

  // New controls
  setTimeSignature(beatsPerBar: number): void;
  setSubdivisions(subdivisionsPerBeat: number): void;
}
```

### TransportState Updates

```typescript
// Add to TransportState for worker sync
export interface TransportState {
  seconds: number;
  ticks: number;
  bpm: number;
  isPlaying: boolean;
  beat: number;
  phase: number;
  // New
  bar: number;
  beatsPerBar: number;
  subdivision: number;
  subdivisionsPerBeat: number;
}
```

### StubTransport Updates

```typescript
// src/lib/transport/StubTransport.ts
export class StubTransport implements ITransport {
  private _beatsPerBar = 4;
  private _subdivisionsPerBeat = 4;

  get bar(): number {
    const totalBeats = Math.floor(this.ticks / this.ppq);
    return Math.floor(totalBeats / this._beatsPerBar);
  }

  get beat(): number {
    const totalBeats = Math.floor(this.ticks / this.ppq);
    return totalBeats % this._beatsPerBar; // No longer hardcoded to 4!
  }

  get subdivision(): number {
    const ticksPerSubdivision = this.ppq / this._subdivisionsPerBeat;
    return Math.floor((this.ticks % this.ppq) / ticksPerSubdivision);
  }

  get subdivisionsPerBeat(): number {
    return this._subdivisionsPerBeat;
  }

  get beatsPerBar(): number {
    return this._beatsPerBar;
  }

  setTimeSignature(beatsPerBar: number): void {
    this._beatsPerBar = beatsPerBar;
  }

  setSubdivisions(subdivisionsPerBeat: number): void {
    this._subdivisionsPerBeat = subdivisionsPerBeat;
  }
}
```

### Worker Clock Command Channel

Workers send commands back to main thread via a new message type:

```typescript
// Worker → Main thread
interface ClockCommandMessage {
  type: "clockCommand";
  command:
    | { action: "play" }
    | { action: "pause" }
    | { action: "stop" }
    | { action: "setBpm"; value: number }
    | { action: "setTimeSignature"; value: number }
    | { action: "setSubdivisions"; value: number }
    | { action: "seek"; value: number };
}
```

### Worker Clock Implementation

```typescript
// In fboRenderer.ts
createWorkerClock() {
  const renderer = this;

  const sendCommand = (command: ClockCommandMessage['command']) => {
    self.postMessage({ type: 'clockCommand', command });
  };

  return {
    // Read properties (existing)
    get time() { return renderer.transportTime?.seconds ?? 0; },
    get ticks() { return renderer.transportTime?.ticks ?? 0; },
    get beat() { return renderer.transportTime?.beat ?? 0; },
    get phase() { return renderer.transportTime?.phase ?? 0; },
    get bpm() { return renderer.transportTime?.bpm ?? 120; },

    // New read properties
    get bar() { return renderer.transportTime?.bar ?? 0; },
    get beatsPerBar() { return renderer.transportTime?.beatsPerBar ?? 4; },
    get subdivision() { return renderer.transportTime?.subdivision ?? 0; },
    get subdivisionsPerBeat() { return renderer.transportTime?.subdivisionsPerBeat ?? 4; },

    // Control methods (send to main thread)
    play: () => sendCommand({ action: 'play' }),
    pause: () => sendCommand({ action: 'pause' }),
    stop: () => sendCommand({ action: 'stop' }),
    setBpm: (bpm: number) => sendCommand({ action: 'setBpm', value: bpm }),
    setTimeSignature: (beats: number) => sendCommand({ action: 'setTimeSignature', value: beats }),
    setSubdivisions: (n: number) => sendCommand({ action: 'setSubdivisions', value: n }),
    seek: (time: number) => sendCommand({ action: 'seek', value: time }),

    // Scheduling (existing)
    onBeat: renderer.clockScheduler.onBeat.bind(renderer.clockScheduler),
    schedule: renderer.clockScheduler.schedule.bind(renderer.clockScheduler),
    every: renderer.clockScheduler.every.bind(renderer.clockScheduler),
    cancel: renderer.clockScheduler.cancel.bind(renderer.clockScheduler),
    cancelAll: renderer.clockScheduler.cancelAll.bind(renderer.clockScheduler),
  };
}
```

### GLSystem Handler

```typescript
// In GLSystem.ts - handle clockCommand from worker
this.worker.addEventListener("message", (e) => {
  if (e.data.type === "clockCommand") {
    const { command } = e.data;
    match(command)
      .with({ action: "play" }, () => Transport.play())
      .with({ action: "pause" }, () => Transport.pause())
      .with({ action: "stop" }, () => Transport.stop())
      .with({ action: "setBpm" }, ({ value }) => Transport.setBpm(value))
      .with({ action: "setTimeSignature" }, ({ value }) =>
        Transport.setTimeSignature(value),
      )
      .with({ action: "setSubdivisions" }, ({ value }) =>
        Transport.setSubdivisions(value),
      )
      .with({ action: "seek" }, ({ value }) => Transport.seek(value))
      .exhaustive();
  }
});
```

### Main Thread Clock (JSRunner)

```typescript
// In JSRunner.ts - clock object with direct Transport access
const clock = {
  // Read properties
  get time() {
    return Transport.seconds;
  },
  get ticks() {
    return Transport.ticks;
  },
  get beat() {
    return Transport.beat;
  },
  get phase() {
    return Transport.phase;
  },
  get bpm() {
    return Transport.bpm;
  },
  get bar() {
    return Transport.bar;
  },
  get beatsPerBar() {
    return Transport.beatsPerBar;
  },
  get subdivision() {
    return Transport.subdivision;
  },
  get subdivisionsPerBeat() {
    return Transport.subdivisionsPerBeat;
  },

  // Control methods (direct)
  play: () => Transport.play(),
  pause: () => Transport.pause(),
  stop: () => Transport.stop(),
  setBpm: (bpm: number) => Transport.setBpm(bpm),
  setTimeSignature: (beats: number) => Transport.setTimeSignature(beats),
  setSubdivisions: (n: number) => Transport.setSubdivisions(n),
  seek: (time: number) => Transport.seek(time),

  // Scheduling
  onBeat: scheduler.onBeat.bind(scheduler),
  schedule: scheduler.schedule.bind(scheduler),
  every: scheduler.every.bind(scheduler),
  cancel: scheduler.cancel.bind(scheduler),
  cancelAll: scheduler.cancelAll.bind(scheduler),
};
```

## Examples

### Time Signature

```javascript
// Set 3/4 time
clock.setTimeSignature(3);

// Now clock.beat cycles 0, 1, 2, 0, 1, 2...
clock.onBeat(0, () => kick()); // downbeat of each bar
clock.onBeat(2, () => snare()); // beat 3 of each bar
```

### Quintuplets

```javascript
// 5 subdivisions per beat
clock.setSubdivisions(5);

// clock.subdivision now cycles 0, 1, 2, 3, 4 within each beat
// Use for polyrhythmic visuals
const angle = (clock.subdivision / 5) * Math.PI * 2;
```

### Transport Control from Code

```javascript
// React to messages
recv((data) => {
  if (data === "go") {
    clock.setBpm(140);
    clock.play();
  }
  if (data === "drop") {
    clock.setBpm(70); // half-time feel
  }
});

// Auto-start on load
clock.play();
```

### Seek to Bar

```javascript
// Jump to bar 8
const secondsPerBar = (60 / clock.bpm) * clock.beatsPerBar;
clock.seek(8 * secondsPerBar);
```

## Files to Modify

| File                                   | Changes                                                 |
| -------------------------------------- | ------------------------------------------------------- |
| `src/lib/transport/types.ts`           | Add new properties to `ITransport` and `TransportState` |
| `src/lib/transport/StubTransport.ts`   | Implement time signature and subdivision                |
| `src/lib/transport/ToneTransport.ts`   | Implement time signature and subdivision                |
| `src/lib/transport/Transport.ts`       | Proxy new methods                                       |
| `src/lib/canvas/GLSystem.ts`           | Handle `clockCommand` messages from worker              |
| `src/workers/rendering/fboRenderer.ts` | Add control methods to `createWorkerClock()`            |
| `src/lib/js-runner/JSRunner.ts`        | Add control methods to clock object                     |
| `src/stores/transport.store.ts`        | Persist `beatsPerBar`, `subdivisionsPerBeat`            |

## UI Updates

The transport panel should display and allow editing:

- Time signature selector (common: 4/4, 3/4, 6/8, 5/4, 7/8)
- Subdivision display (optional, advanced)

## Future Considerations

- **Compound time signatures**: 6/8 feels like 2 groups of 3, not 6 beats
- **Swing/groove**: Offset subdivisions for swing feel
- **Per-node time signature**: Different objects in different meters (polymetric)
- **Tempo automation**: Ramp BPM over time

## See Also

- [77. Global Transport Control](/docs/design-docs/specs/77-global-transport-control.md)
- [80. Clock Scheduling API](/docs/design-docs/specs/80-clock-scheduling-api.md)
