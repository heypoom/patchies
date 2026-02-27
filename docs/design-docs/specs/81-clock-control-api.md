# 81. Clock Control API

Extend the clock object with control methods, time signature support, and per-node subdivisions. Works bidirectionally across main thread and workers.

## Status: Implemented

## Problem

1. **Time signature locked to 4/4**: `clock.beat` hardcoded to `% 4`
2. **No subdivision support**: Can't easily work with triplets, quintuplets, etc.
3. **Read-only clock**: Can't control transport from within code (play/pause/setBpm)
4. **Worker limitation**: Workers receive state but can't send commands back

## Solution

Add control methods to the clock object that work uniformly in main thread and workers. Subdivisions are computed **per-node** via `clock.subdiv(n)` and `clock.subdivPhase(n)` — no global state, so different nodes can use different subdivisions simultaneously.

## API Additions

### Time Signature

| Property          | Type   | Description                |
| ----------------- | ------ | -------------------------- |
| `clock.bar`       | number | Current bar (0-indexed)    |
| `clock.beatsPerBar` | number | Beats per bar (default: 4) |

### Per-Node Subdivisions

| Method                  | Return | Description                                        |
| ----------------------- | ------ | -------------------------------------------------- |
| `clock.subdiv(n)`       | number | Current subdivision index (0 to n-1) within beat   |
| `clock.subdivPhase(n)`  | number | Progress within current subdivision (0.0 to 1.0)   |

These are pure computations from `ticks` and `ppq` — no global state, no syncing needed. Each node picks its own `n`.

### Control Methods

| Method                                | Description                          |
| ------------------------------------- | ------------------------------------ |
| `clock.play()`                        | Start transport                      |
| `clock.pause()`                       | Pause transport                      |
| `clock.stop()`                        | Stop and reset to 0                  |
| `clock.setBpm(bpm)`                   | Set tempo                            |
| `clock.setTimeSignature(beatsPerBar)` | Set beats per bar (e.g., 3 for 3/4) |
| `clock.seek(time)`                    | Seek to time in seconds              |

## Implementation

### Architecture

```
┌─────────────────┐                    ┌─────────────────┐
│   Main Thread   │                    │     Worker      │
│                 │  syncTransportTime │                 │
│   Transport ────┼───────────────────>│   clock (read)  │
│   Singleton     │                    │                 │
│                 │  clockCommand      │   subdiv(n)     │
│                 │<───────────────────┼── clock.play()  │
└─────────────────┘                    └─────────────────┘
```

Subdivisions are computed locally on each side from `ticks` and `ppq`. No subdivision state flows through the sync channel.

### Transport Interface

```typescript
// src/lib/transport/types.ts
export interface ITransport {
  readonly seconds: number;
  readonly ticks: number;
  readonly bpm: number;
  readonly isPlaying: boolean;
  readonly beat: number;
  readonly phase: number;
  readonly ppq: number;

  readonly bar: number;
  readonly beatsPerBar: number;

  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(seconds: number): void;
  setBpm(bpm: number): void;
  setTimeSignature(beatsPerBar: number): void;
  setDspEnabled(enabled: boolean): Promise<void>;
}
```

### TransportState

```typescript
export interface TransportState {
  seconds: number;
  ticks: number;
  bpm: number;
  isPlaying: boolean;
  beat: number;
  phase: number;
  bar: number;
  beatsPerBar: number;
  ppq: number;
}
```

### Worker Clock Command Channel

Workers send commands back to main thread via a new message type:

```typescript
interface ClockCommandMessage {
  type: "clockCommand";
  command:
    | { action: "play" }
    | { action: "pause" }
    | { action: "stop" }
    | { action: "setBpm"; value: number }
    | { action: "setTimeSignature"; value: number }
    | { action: "seek"; value: number };
}
```

### Subdivision Computation (shared logic)

Both main thread and worker clock use the same computation:

```typescript
subdiv(n: number): number {
  const ticksPerSubdiv = ppq / n;
  return Math.floor((ticks % ppq) / ticksPerSubdiv);
}

subdivPhase(n: number): number {
  const ticksPerSubdiv = ppq / n;
  return ((ticks % ppq) % ticksPerSubdiv) / ticksPerSubdiv;
}
```

The worker reads `ticks` and `ppq` from the synced `transportTime`. The main thread reads directly from `Transport`.

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
// 5 subdivisions per beat — computed locally, not global
const angle = (clock.subdiv(5) / 5) * Math.PI * 2;
```

### Polyrhythmic Visuals

```javascript
// Node A: triplets
const triColor = ['red', 'green', 'blue'][clock.subdiv(3)];

// Node B: quintuplets (simultaneously, no conflict)
const quintAngle = (clock.subdiv(5) / 5) * TAU;
```

### Smooth Subdivision Animation

```javascript
// Pulse that breathes once per sixteenth note
const t = clock.subdivPhase(4);
const radius = 50 + 20 * Math.sin(t * Math.PI);
circle(width/2, height/2, radius);
```

### Transport Control from Code

```javascript
recv((data) => {
  if (data === "go") {
    clock.setBpm(140);
    clock.play();
  }
  if (data === "drop") {
    clock.setBpm(70); // half-time feel
  }
});

clock.play();
```

### Seek to Bar

```javascript
const secondsPerBar = (60 / clock.bpm) * clock.beatsPerBar;
clock.seek(8 * secondsPerBar);
```

## Files Modified

| File                                   | Changes                                              |
| -------------------------------------- | ---------------------------------------------------- |
| `src/lib/transport/types.ts`           | Remove global subdivision, add `ppq` to state        |
| `src/lib/transport/constants.ts`       | Remove `DEFAULT_SUBDIVISIONS_PER_BEAT`               |
| `src/lib/transport/DefaultTransport.ts`| Remove subdivision state, expose `ppq`               |
| `src/lib/transport/ToneTransport.ts`   | Remove subdivision state, expose `ppq`               |
| `src/lib/transport/Transport.ts`       | Remove subdivision proxies, add `ppq`                |
| `src/lib/canvas/GLSystem.ts`           | Remove `setSubdivisions` from clockCommand handler   |
| `src/workers/rendering/fboRenderer.ts` | Replace subdivision getters with `subdiv`/`subdivPhase` |
| `src/lib/js-runner/JSRunner.ts`        | Replace subdivision getters with `subdiv`/`subdivPhase` |
| `src/stores/transport.store.ts`        | Remove `subdivisionsPerBeat` persistence             |

## Future Considerations

- **Compound time signatures**: 6/8 feels like 2 groups of 3, not 6 beats
- **Swing/groove**: Offset subdivisions for swing feel
- **Per-node time signature**: Different objects in different meters (polymetric)
- **Tempo automation**: Ramp BPM over time

## See Also

- [77. Global Transport Control](/docs/design-docs/specs/77-global-transport-control.md)
- [80. Clock Scheduling API](/docs/design-docs/specs/80-clock-scheduling-api.md)
