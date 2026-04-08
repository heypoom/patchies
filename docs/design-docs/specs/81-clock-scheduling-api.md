# 81. Clock Scheduling API

Unified scheduling API for beat-synced visuals that works across all environments (main thread and workers).

## Status: Implemented

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

This is tedious and requires boilerplate in every node.

## Solution

Add scheduling methods to the `clock` object that work uniformly across all environments. By default, callbacks fire **after** the event (visual-friendly). Pass `{ audio: true }` for lookahead scheduling where callbacks fire early with the precise transport time for Web Audio API scheduling.

## API

### `clock.onBeat(beat, callback, options?)` - Beat Change Subscription

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

### `clock.schedule(time, callback, options?)` - One-Shot Schedule

Schedule a callback at a specific transport time.

```javascript
// Absolute time (seconds)
clock.schedule(clock.time + 2, () => drop());

// Bar:beat:sixteenth notation
clock.schedule("4:0:0", () => breakdown()); // bar 4, beat 0
clock.schedule("8:2:0", () => buildUp()); // bar 8, beat 2

// Audio-precise — fires early with precise time
clock.schedule("4:0:0", (time) => {
  send({ type: 'set', value: 880, time });
}, { audio: true });

// Returns ID for cleanup
const id = clock.schedule("16:0:0", () => finale());
clock.cancel(id);
```

### `clock.every(interval, callback, options?)` - Repeating Schedule

Schedule a repeating callback at a musical interval.

```javascript
// Bar:beat:sixteenth interval
clock.every("1:0:0", () => flash()); // every bar
clock.every("0:1:0", () => pulse()); // every beat
clock.every("0:0:1", () => tick()); // every sixteenth

// Audio-precise repeating
clock.every("0:1:0", (time) => {
  send({ type: 'trigger', ... });
}, { audio: true });

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

### Interface

```typescript
// src/lib/transport/ClockScheduler.ts
interface SchedulerOptions {
  /** When true, use lookahead scheduling for audio-precise timing. Default: false. */
  audio?: boolean;
}

interface ClockScheduler {
  onBeat(beat: number | number[] | "*", callback: (time: number) => void, options?: SchedulerOptions): string;
  schedule(time: number | string, callback: (time: number) => void, options?: SchedulerOptions): string;
  every(interval: string, callback: (time: number) => void, options?: SchedulerOptions): string;
  cancel(id: string): void;
  cancelAll(): void;
}

interface ClockState {
  time: number;
  beat: number;
  bpm: number;
  phase?: number;
  beatsPerBar?: number;
}
```

### PollingClockScheduler

Frame-based polling implementation used for both main thread and workers:

```typescript
class PollingClockScheduler implements ClockScheduler {
  private lastBeat = -1;
  private currentBpm = 120;

  private beatCallbacks = new Map<string, BeatCallback>();
  private scheduleCallbacks = new Map<string, ScheduleCallback>();
  private repeatCallbacks = new Map<string, RepeatCallback>();

  // Called each frame by the render loop
  tick(clock: ClockState): void {
    this.currentBpm = clock.bpm;

    // Check beat changes - only runs when beat actually changes (4x per bar max)
    if (clock.beat !== this.lastBeat) {
      for (const [, { beats, callback }] of this.beatCallbacks) {
        const shouldFire =
          beats === "*" || (Array.isArray(beats) && beats.includes(clock.beat));
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

    // Check repeating schedules (with BPM change handling)
    for (const [, item] of this.repeatCallbacks) {
      if (item.bpm !== clock.bpm) {
        const ratio = item.bpm / clock.bpm;
        item.interval = item.interval * ratio;
        item.bpm = clock.bpm;
      }

      if (clock.time >= item.lastFired + item.interval) {
        item.callback();
        item.lastFired = clock.time;
      }
    }
  }

  // ... registration methods
}
```

### Main Thread Integration (JSRunner)

Each node gets its own scheduler with a dedicated `requestAnimationFrame` tick loop:

```typescript
// src/lib/js-runner/JSRunner.ts
class JSRunner {
  private schedulerMap = new Map<string, PollingClockScheduler>();
  private schedulerTickLoops = new Map<string, number>();

  executeJavaScript(
    nodeId: string,
    code: string,
    options: JSRunnerOptions = {},
  ) {
    // Get or create scheduler for this node
    const scheduler = this.getScheduler(nodeId);
    scheduler.cancelAll(); // Clean up before executing new code
    this.startSchedulerTickLoop(nodeId);

    // Clock object with scheduling methods
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
      get phase() {
        return Transport.phase;
      },
      get bpm() {
        return Transport.bpm;
      },
      // Scheduling methods
      onBeat: scheduler.onBeat.bind(scheduler),
      schedule: scheduler.schedule.bind(scheduler),
      every: scheduler.every.bind(scheduler),
      cancel: scheduler.cancel.bind(scheduler),
      cancelAll: scheduler.cancelAll.bind(scheduler),
    };

    // ... execute code with clock in context
  }

  private startSchedulerTickLoop(nodeId: string): void {
    if (this.schedulerTickLoops.has(nodeId)) return;

    const scheduler = this.getScheduler(nodeId);
    const tick = () => {
      scheduler.tick({
        time: Transport.seconds,
        beat: Transport.beat,
        bpm: Transport.bpm,
      });
      const frameId = requestAnimationFrame(tick);
      this.schedulerTickLoops.set(nodeId, frameId);
    };

    const frameId = requestAnimationFrame(tick);
    this.schedulerTickLoops.set(nodeId, frameId);
  }

  destroy(nodeId: string): void {
    this.stopSchedulerTickLoop(nodeId);
    const scheduler = this.schedulerMap.get(nodeId);
    if (scheduler) {
      scheduler.cancelAll();
      this.schedulerMap.delete(nodeId);
    }
    // ... other cleanup
  }
}
```

### Worker Integration (fboRenderer)

A single shared scheduler for the render worker, ticked from the render loop:

```typescript
// src/workers/rendering/fboRenderer.ts
class FBORenderer {
  public clockScheduler = new PollingClockScheduler();

  renderFrame(): void {
    // Tick the clock scheduler with current transport state
    this.clockScheduler.tick({
      time: this.transportTime?.seconds ?? 0,
      beat: this.transportTime?.beat ?? 0,
      bpm: this.transportTime?.bpm ?? 120,
    });

    // ... rest of render
  }

  createWorkerClock() {
    const renderer = this;
    const scheduler = this.clockScheduler;

    return {
      get time() {
        return renderer.transportTime?.seconds ?? 0;
      },
      get ticks() {
        return renderer.transportTime?.ticks ?? 0;
      },
      get beat() {
        return renderer.transportTime?.beat ?? 0;
      },
      get phase() {
        return renderer.transportTime?.phase ?? 0;
      },
      get bpm() {
        return renderer.transportTime?.bpm ?? 120;
      },
      // Scheduling methods
      onBeat: scheduler.onBeat.bind(scheduler),
      schedule: scheduler.schedule.bind(scheduler),
      every: scheduler.every.bind(scheduler),
      cancel: scheduler.cancel.bind(scheduler),
      cancelAll: scheduler.cancelAll.bind(scheduler),
    };
  }
}
```

Worker renderers (Hydra, Canvas, Three, Textmode) automatically get scheduling via `createWorkerClock()` passed in `extraContext`.

### Time Notation Parsing

```typescript
// Parse "bar:beat:sixteenth" to seconds
function parseBarBeatSixteenth(notation: string, bpm: number): number {
  const parts = notation.split(":").map(Number);
  const bars = parts[0] ?? 0;
  const beats = parts[1] ?? 0;
  const sixteenths = parts[2] ?? 0;

  const beatsPerSecond = bpm / 60;
  const totalBeats = bars * 4 + beats + sixteenths / 4;
  return totalBeats / beatsPerSecond;
}
```

## Precision

**Default (visual):** Callbacks fire **after** the event — ~25ms main thread, ~16ms workers. Imperceptible for visual sync.

**`{ audio: true }` (lookahead):** Main thread only. Callbacks fire **before** the event within a ~100ms lookahead window. The `time` argument contains the precise transport time for Web Audio API scheduling.

| Environment | Visual precision    | Audio lookahead   |
| ----------- | ------------------- | ----------------- |
| Main Thread | Poll-based (~25ms)  | ~100ms ahead      |
| Worker      | Frame-based (~16ms) | Not available     |

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

## Files Modified

| File                                   | Changes                                                  |
| -------------------------------------- | -------------------------------------------------------- |
| `src/lib/transport/ClockScheduler.ts`  | New file: scheduler interface and PollingClockScheduler  |
| `src/lib/js-runner/JSRunner.ts`        | Added per-node scheduler with requestAnimationFrame tick |
| `src/workers/rendering/fboRenderer.ts` | Added shared scheduler, tick() in render loop            |

Worker renderers (hydraRenderer, canvasRenderer, threeRenderer, textmodeRenderer) automatically get scheduling through `createWorkerClock()` - no changes needed.

## Future Enhancements

- **Quantized scheduling**: `clock.scheduleQuantized(callback, '1:0:0')` - schedule to next bar boundary
- **Swing/groove**: `clock.setSwing(0.3)` - add swing to beat timing
- **Named events**: `clock.on('drop', callback)` - subscribe to user-defined markers
