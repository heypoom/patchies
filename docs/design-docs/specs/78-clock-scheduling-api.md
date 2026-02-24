# 78. Clock Scheduling API

Unified scheduling API for beat-synced visuals that works across all environments (main thread and workers).

## Problem

Currently, users must manually poll `clock.beat` and track state to detect beat changes:

```javascript
// Current pattern - verbose and error-prone
let lastBeat = -1;
function draw() {
  if (clock.beat !== lastBeat) {
    if (clock.beat === 0) flash();
    lastBeat = clock.beat;
  }
}
```

This is tedious, requires boilerplate in every node, and doesn't leverage Tone.js's audio-synced scheduling when available.

## Solution

Add scheduling methods to the `clock` object that work uniformly across all environments with best-available precision.

## API

### `clock.onBeat(beat, callback)` - Beat Change Subscription

Subscribe to beat changes. Callback fires when the specified beat is reached.

```javascript
// Single beat
clock.onBeat(0, () => kick()); // downbeat (beat 0)
clock.onBeat(2, () => snare()); // beat 2

// Multiple beats
clock.onBeat([0, 2], () => snare()); // beats 0 and 2

// Every beat
clock.onBeat("*", () => hihat()); // all beats

// Returns ID for cleanup
const id = clock.onBeat(0, () => flash());
clock.cancel(id);
```

### `clock.schedule(time, callback)` - One-Shot Schedule

Schedule a callback at a specific transport time.

```javascript
// Absolute time (seconds)
clock.schedule(clock.time + 2, () => drop());

// Bar:beat:sixteenth notation
clock.schedule("4:0:0", () => breakdown()); // bar 4, beat 0
clock.schedule("8:2:0", () => buildUp()); // bar 8, beat 2

// Returns ID for cleanup
const id = clock.schedule("16:0:0", () => finale());
clock.cancel(id);
```

### `clock.every(interval, callback)` - Repeating Schedule

Schedule a repeating callback at a musical interval.

```javascript
// Bar:beat:sixteenth interval
clock.every("1:0:0", () => flash()); // every bar
clock.every("0:1:0", () => pulse()); // every beat
clock.every("0:0:1", () => tick()); // every sixteenth

// Returns ID for cleanup
const id = clock.every("4:0:0", () => transition());
clock.cancel(id);
```

### `clock.cancel(id)` - Cancel Scheduled Callback

Cancel a scheduled callback by its ID.

```javascript
const id = clock.onBeat(0, () => flash());
// Later...
clock.cancel(id);
```

### `clock.cancelAll()` - Cancel All Callbacks

Cancel all scheduled callbacks for this node. Called automatically when node code changes.

```javascript
clock.cancelAll();
```

## Implementation

### Environment Detection

The clock object is created per-node and is environment-aware:

```typescript
interface ClockScheduler {
  onBeat(beat: number | number[] | "*", callback: () => void): string;
  schedule(time: number | string, callback: () => void): string;
  every(interval: string, callback: () => void): string;
  cancel(id: string): void;
  cancelAll(): void;
}
```

### Main Thread with Tone.js

Uses `Tone.Transport.schedule`, `Tone.Transport.scheduleRepeat`, and `Tone.Draw.schedule` for audio-synced precision:

```typescript
// Main thread implementation (simplified)
class ToneClockScheduler implements ClockScheduler {
  private tone: typeof Tone;
  private scheduled = new Map<string, number>();

  onBeat(beat: number | number[] | "*", callback: () => void): string {
    const id = generateId();

    // Use Tone.Transport.scheduleRepeat with Tone.Draw for visual sync
    const eventId = this.tone.Transport.scheduleRepeat((time) => {
      const currentBeat = Transport.beat;
      const shouldFire =
        beat === "*" ||
        beat === currentBeat ||
        (Array.isArray(beat) && beat.includes(currentBeat));

      if (shouldFire) {
        // Tone.Draw ensures visual fires at perceptually correct time
        this.tone.Draw.schedule(() => callback(), time);
      }
    }, "4n"); // Check every quarter note

    this.scheduled.set(id, eventId);
    return id;
  }

  schedule(time: number | string, callback: () => void): string {
    const id = generateId();
    const eventId = this.tone.Transport.schedule((t) => {
      this.tone.Draw.schedule(() => callback(), t);
    }, time);
    this.scheduled.set(id, eventId);
    return id;
  }

  every(interval: string, callback: () => void): string {
    const id = generateId();
    const eventId = this.tone.Transport.scheduleRepeat((t) => {
      this.tone.Draw.schedule(() => callback(), t);
    }, interval);
    this.scheduled.set(id, eventId);
    return id;
  }

  cancel(id: string): void {
    const eventId = this.scheduled.get(id);
    if (eventId !== undefined) {
      this.tone.Transport.clear(eventId);
      this.scheduled.delete(id);
    }
  }

  cancelAll(): void {
    for (const [id] of this.scheduled) {
      this.cancel(id);
    }
  }
}
```

### Main Thread without Tone.js (Stub) & Workers

Uses frame-based polling. The render loop checks scheduled callbacks each frame:

```typescript
// Stub/Worker implementation (simplified)
class PollingClockScheduler implements ClockScheduler {
  private beatCallbacks = new Map<
    string,
    { beats: number[] | "*"; callback: () => void }
  >();
  private scheduleCallbacks = new Map<
    string,
    { time: number; callback: () => void; fired: boolean }
  >();
  private repeatCallbacks = new Map<
    string,
    { interval: number; lastFired: number; callback: () => void }
  >();
  private lastBeat = -1;

  // Called each frame by the render loop
  tick(clock: { time: number; beat: number; bpm: number }): void {
    // Check beat changes
    if (clock.beat !== this.lastBeat) {
      for (const [, { beats, callback }] of this.beatCallbacks) {
        const shouldFire =
          beats === "*" ||
          beats === clock.beat ||
          (Array.isArray(beats) && beats.includes(clock.beat));
        if (shouldFire) callback();
      }
      this.lastBeat = clock.beat;
    }

    // Check one-shot schedules
    for (const [id, item] of this.scheduleCallbacks) {
      if (!item.fired && clock.time >= item.time) {
        item.callback();
        item.fired = true;
        this.scheduleCallbacks.delete(id);
      }
    }

    // Check repeating schedules
    for (const [, item] of this.repeatCallbacks) {
      if (clock.time >= item.lastFired + item.interval) {
        item.callback();
        item.lastFired = clock.time;
      }
    }
  }

  onBeat(beat: number | number[] | "*", callback: () => void): string {
    const id = generateId();
    const beats = typeof beat === "number" ? [beat] : beat;
    this.beatCallbacks.set(id, { beats, callback });
    return id;
  }

  schedule(time: number | string, callback: () => void): string {
    const id = generateId();
    const timeNum =
      typeof time === "string" ? parseBarBeatSixteenth(time) : time;
    this.scheduleCallbacks.set(id, { time: timeNum, callback, fired: false });
    return id;
  }

  every(interval: string, callback: () => void): string {
    const id = generateId();
    const intervalSecs = parseIntervalToSeconds(interval);
    this.repeatCallbacks.set(id, {
      interval: intervalSecs,
      lastFired: 0,
      callback,
    });
    return id;
  }

  cancel(id: string): void {
    this.beatCallbacks.delete(id);
    this.scheduleCallbacks.delete(id);
    this.repeatCallbacks.delete(id);
  }

  cancelAll(): void {
    this.beatCallbacks.clear();
    this.scheduleCallbacks.clear();
    this.repeatCallbacks.clear();
  }
}
```

### Time Notation Parsing

```typescript
// Parse "bar:beat:sixteenth" to seconds
function parseBarBeatSixteenth(notation: string, bpm: number): number {
  const [bars, beats, sixteenths] = notation.split(":").map(Number);
  const beatsPerSecond = bpm / 60;
  const totalBeats = bars * 4 + beats + sixteenths / 4;
  return totalBeats / beatsPerSecond;
}

// Parse interval to seconds
function parseIntervalToSeconds(interval: string, bpm: number): number {
  return parseBarBeatSixteenth(interval, bpm);
}
```

## Lifecycle Management

### Auto-Cleanup on Code Change

When node code is re-executed (user edits code), all scheduled callbacks are automatically cancelled:

```typescript
// In JSRunner.executeJavaScript()
const scheduler = createClockScheduler(environment);

// Before executing new code, clean up old callbacks
scheduler.cancelAll();

// Provide clock with scheduler methods
const clock = {
  get time() {
    return transportTime.seconds;
  },
  get beat() {
    return transportTime.beat;
  },
  get phase() {
    return transportTime.phase;
  },
  get bpm() {
    return transportTime.bpm;
  },

  // Scheduling methods
  onBeat: scheduler.onBeat.bind(scheduler),
  schedule: scheduler.schedule.bind(scheduler),
  every: scheduler.every.bind(scheduler),
  cancel: scheduler.cancel.bind(scheduler),
  cancelAll: scheduler.cancelAll.bind(scheduler),
};
```

### Worker Integration

For workers, the scheduler's `tick()` method is called each render frame:

```typescript
// In fboRenderer render loop
renderFrame(params: RenderParams) {
  // Update clock scheduler with current time
  this.clockScheduler.tick({
    time: this.transportTime?.seconds ?? 0,
    beat: this.transportTime?.beat ?? 0,
    bpm: this.transportTime?.bpm ?? 120,
  });

  // ... rest of render
}
```

## Precision Comparison

| Environment | `onBeat` Precision  | `schedule` Precision | `every` Precision   |
| ----------- | ------------------- | -------------------- | ------------------- |
| Main + Tone | Audio-synced (~5ms) | Audio-synced (~5ms)  | Audio-synced (~5ms) |
| Main + Stub | Frame-based (~16ms) | Frame-based (~16ms)  | Frame-based (~16ms) |
| Worker      | Frame-based (~16ms) | Frame-based (~16ms)  | Frame-based (~16ms) |

For visual sync, ~16ms precision is typically imperceptible. Audio-synced precision matters most when coordinating visuals with audio events scheduled in the same node.

## Examples

### Basic Beat Visualization

```javascript
// Flash background on every downbeat
clock.onBeat(0, () => {
  background(255);
  setTimeout(() => background(0), 100);
});

// Pulse circle on every beat
clock.onBeat("*", () => {
  circle(width / 2, height / 2, 100 + clock.phase * 50);
});
```

### Scheduled Transitions

```javascript
// Build-up and drop
clock.schedule("4:0:0", () => {
  setMode("intense");
});

clock.schedule("8:0:0", () => {
  setMode("drop");
});
```

### Repeating Patterns

```javascript
// Flash every bar
clock.every("1:0:0", () => flash());

// Color cycle every 4 bars
let colorIndex = 0;
const colors = ["red", "blue", "green", "yellow"];
clock.every("4:0:0", () => {
  setColor(colors[colorIndex++ % colors.length]);
});
```

### Cleanup

```javascript
// Manual cleanup
const flashId = clock.onBeat(0, () => flash());

// Later, stop flashing
clock.cancel(flashId);

// Or cancel everything
clock.cancelAll();
```

## Files to Modify

| File                                        | Changes                                             |
| ------------------------------------------- | --------------------------------------------------- |
| `src/lib/transport/ClockScheduler.ts`       | New file: scheduler interface and implementations   |
| `src/lib/js-runner/JSRunner.ts`             | Add scheduler to clock object in execution context  |
| `src/workers/rendering/fboRenderer.ts`      | Create worker scheduler, call tick() in render loop |
| `src/workers/rendering/hydraRenderer.ts`    | Pass scheduler to extraContext                      |
| `src/workers/rendering/canvasRenderer.ts`   | Pass scheduler to extraContext                      |
| `src/workers/rendering/threeRenderer.ts`    | Pass scheduler to extraContext                      |
| `src/workers/rendering/textmodeRenderer.ts` | Pass scheduler to extraContext                      |

## Future Enhancements

- **Quantized scheduling**: `clock.scheduleQuantized(callback, '1:0:0')` - schedule to next bar boundary
- **Swing/groove**: `clock.setSwing(0.3)` - add swing to beat timing
- **Time signature**: Support for non-4/4 time signatures
- **Named events**: `clock.on('drop', callback)` - subscribe to user-defined markers
