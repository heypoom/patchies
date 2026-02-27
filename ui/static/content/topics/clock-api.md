# Clock API

The `clock` object provides beat-synced timing and scheduling for JavaScript-based objects. It reads from the global [Transport](/docs/transport-control) and works identically across all environments (main thread and workers).

## Supported Objects

The `clock` object is available in: [js](/docs/objects/js), [worker](/docs/objects/worker), [p5](/docs/objects/p5), [canvas](/docs/objects/canvas), [three](/docs/objects/three), [textmode](/docs/objects/textmode), [hydra](/docs/objects/hydra), and DOM variants.

## Clock Properties

| Property | Type | Description |
|----------|------|-------------|
| `clock.time` | number | Current time in seconds |
| `clock.ticks` | number | Current time in ticks (192 PPQ) |
| `clock.beat` | number | Current beat in measure (0 to beatsPerBar-1) |
| `clock.phase` | number | Position within current beat (0.0 to 1.0) |
| `clock.bpm` | number | Current tempo in BPM |
| `clock.bar` | number | Current bar (0-indexed) |
| `clock.beatsPerBar` | number | Beats per bar (default: 4) |

## Basic Usage

```javascript
// Use clock.time for animations
const x = Math.sin(clock.time) * 100;
const y = Math.cos(clock.time * 0.5) * 50;
circle(width/2 + x, height/2 + y, 20);

// Use clock.phase for beat-synced pulsing
const pulse = 1 + clock.phase * 0.5;
circle(width/2, height/2, 50 * pulse);

// Use clock.beat to change on each beat
const colors = ['red', 'blue', 'green', 'yellow'];
fill(colors[clock.beat]);
```

## Control Methods

Control the transport directly from your code:

| Method | Description |
|--------|-------------|
| `clock.play()` | Start transport |
| `clock.pause()` | Pause transport |
| `clock.stop()` | Stop and reset to 0 |
| `clock.setBpm(bpm)` | Set tempo |
| `clock.setTimeSignature(beatsPerBar)` | Set beats per bar (e.g., 3 for 3/4) |
| `clock.seek(seconds)` | Seek to time in seconds |

### Transport Control Example

```javascript
// React to messages
recv((data) => {
  if (data === 'go') {
    clock.setBpm(140);
    clock.play();
  }
  if (data === 'drop') {
    clock.setBpm(70);  // half-time feel
  }
});

// Auto-start on load
clock.play();
```

### Time Signature Example

```javascript
// Set 3/4 time
clock.setTimeSignature(3);

// Now clock.beat cycles 0, 1, 2, 0, 1, 2...
clock.onBeat(0, () => kick());   // downbeat of each bar
clock.onBeat(2, () => snare());  // beat 3 of each bar
```

## Subdivision Methods

Subdivisions are computed **per-node** — different nodes can use different subdivisions simultaneously (e.g., one node with triplets, another with quintuplets).

| Method | Return | Description |
|--------|--------|-------------|
| `clock.subdiv(n)` | number | Current subdivision index (0 to n-1) within the beat |
| `clock.subdivPhase(n)` | number | Progress within current subdivision (0.0 to 1.0) |

### Quintuplets Example

```javascript
// Each node picks its own subdivision count — no global state
clock.subdiv(5);       // → 0, 1, 2, 3, 4 within each beat
clock.subdiv(3);       // → 0, 1, 2 (triplets, can run simultaneously)
clock.subdiv(4);       // → 0, 1, 2, 3 (sixteenths)
```

### Polyrhythmic Patterns

```javascript
// Node A uses triplets, Node B uses quintuplets — at the same time
const triAngle = clock.subdiv(3) / 3 * TAU;
const quintAngle = clock.subdiv(5) / 5 * TAU;
```

### Smooth Animation with subdivPhase

```javascript
// Pulse that breathes once per sixteenth note
const t = clock.subdivPhase(4);
const radius = 50 + 20 * Math.sin(t * Math.PI);
circle(width/2, height/2, radius);
```

### Rhythmic Color Changes

```javascript
const colors = ['red', 'orange', 'yellow', 'green', 'blue'];
fill(colors[clock.subdiv(5)]);
```

## Scheduling Methods

Instead of manually tracking beat changes, use these scheduling methods for cleaner code.

### `clock.onBeat(beat, callback)`

Subscribe to beat changes. Callback fires when the specified beat is reached.

```javascript
// Fire on specific beat (0 to beatsPerBar-1)
clock.onBeat(0, () => kick());      // downbeat
clock.onBeat(2, () => snare());     // beat 3

// Fire on multiple beats
clock.onBeat([0, 2], () => snare()); // beats 1 and 3

// Fire on every beat
clock.onBeat('*', () => hihat());
```

### `clock.schedule(time, callback)`

Schedule a one-shot callback at a specific time.

```javascript
// Absolute time in seconds
clock.schedule(clock.time + 2, () => drop());

// Bar:beat:sixteenth notation
clock.schedule('4:0:0', () => breakdown());  // bar 4, beat 0
clock.schedule('8:2:0', () => buildUp());    // bar 8, beat 2
```

### `clock.every(interval, callback)`

Schedule a repeating callback at a musical interval.

```javascript
// Bar:beat:sixteenth interval
clock.every('1:0:0', () => flash());    // every bar
clock.every('0:1:0', () => pulse());    // every beat
clock.every('0:0:1', () => tick());     // every sixteenth
```

### `clock.cancel(id)` / `clock.cancelAll()`

Cancel scheduled callbacks.

```javascript
// Cancel specific callback
const id = clock.onBeat(0, () => flash());
clock.cancel(id);

// Cancel all callbacks (automatic on code change)
clock.cancelAll();
```

## Examples

### Beat Visualization

```javascript
// Flash background on downbeat
clock.onBeat(0, () => {
  background(255);
  setTimeout(() => background(0), 100);
});

// Pulse circle on every beat
function draw() {
  const size = 100 + clock.phase * 50;
  circle(width/2, height/2, size);
}
```

### Scheduled Transitions

```javascript
// Build-up and drop
clock.schedule('4:0:0', () => setMode('intense'));
clock.schedule('8:0:0', () => setMode('drop'));
```

### Repeating Patterns

```javascript
// Color cycle every 4 bars
let colorIndex = 0;
const colors = ['red', 'blue', 'green', 'yellow'];

clock.every('4:0:0', () => {
  setColor(colors[colorIndex++ % colors.length]);
});
```

### Manual Beat Detection (Alternative)

If you prefer manual control over scheduling:

```javascript
let lastBeat = -1;

function draw() {
  if (clock.beat !== lastBeat) {
    // Beat changed!
    if (clock.beat === 0) flash();
    lastBeat = clock.beat;
  }
}
```

### Seek to Bar

```javascript
// Jump to bar 8
const secondsPerBar = (60 / clock.bpm) * clock.beatsPerBar;
clock.seek(8 * secondsPerBar);
```

## Precision

All scheduling uses frame-based polling (~16ms at 60fps). This is imperceptible for visual sync. For sample-accurate audio scheduling, use [tone~](/docs/objects/tone~) with Tone.js Transport.

## Hydra Note

In Hydra, you can use either `clock.time` or the bare `time` variable:

```javascript
// Both work in Hydra
osc(10, 0.1, () => clock.time)
osc(10, 0.1, () => time)  // shorthand
```

## See Also

- [Transport Control](/docs/transport-control) — Play/pause, BPM, time display
- [JavaScript Runner](/docs/javascript-runner) — Full JSRunner documentation
- [Audio Reactivity](/docs/audio-reactivity) — Using FFT data in visuals
