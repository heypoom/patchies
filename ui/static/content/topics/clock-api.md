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
| `clock.timeSignature` | [number, number] | Time signature as [numerator, denominator] (e.g. [4, 4], [6, 8]) |

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
| `clock.setTimeSignature(numerator, denominator)` | Set time signature (e.g., `6, 8` for 6/8) |
| `clock.seek(seconds)` | Seek to time in seconds |

### Transport Control Example

```javascript
// React to messages
recv((m) => {
  if (m === 'go') {
    clock.setBpm(140);
    clock.play();
  }

  if (m === 'drop') {
    clock.setBpm(70); // half-time feel
  }
});

// Auto-start on load
clock.play();
```

### Time Signature Example

```javascript
// Set 3/4 time (3 quarter-note beats per bar)
clock.setTimeSignature(3, 4);

// Set 6/8 time (6 eighth-note beats per bar)
clock.setTimeSignature(6, 8);

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

Instead of manually tracking beat changes, use these scheduling methods for cleaner code. All scheduling callbacks receive a `time` argument — the precise transport time of the event.

By default, callbacks fire **after** the event — ideal for visuals. Pass `{ audio: true }` as the last argument for **lookahead scheduling**, where callbacks fire ~100ms early with the precise time for Web Audio API scheduling.

### onBeat

Subscribe to beat changes. Callback fires when the specified beat is reached.

```javascript
// Fire on specific beat (0 to beatsPerBar-1)
clock.onBeat(0, () => kick());      // downbeat
clock.onBeat(2, () => snare());     // beat 3

// Fire on multiple beats
clock.onBeat([0, 2], () => snare()); // beats 1 and 3

// Fire on every beat
clock.onBeat('*', () => hihat());

// Audio-precise scheduling — fires early with precise time
clock.onBeat(0, (time) => {
  oscillator.start(time);
}, { audio: true });
```

### schedule

Schedule a one-shot callback at a specific time.

The `bar:beat:sixteenth` notation is **zero-indexed** (like Tone.js) — `'0:0:0'` is the start, `'1:0:0'` is 1 bar from the start, and so on. This differs from DAWs like Ableton (which start at `1.1.1`).

```javascript
// Absolute time in seconds
clock.schedule(clock.time + 2, () => drop());

// Bar:beat:sixteenth notation (zero-indexed)
clock.schedule('4:0:0', () => breakdown());  // 4 bars from start
clock.schedule('8:2:0', () => buildUp());    // 8 bars + 2 beats from start

// Audio-precise — fires early with precise time
clock.schedule('4:0:0', (time) => {
  send({ type: 'set', value: 880, time });
}, { audio: true });
```

### every

Schedule a repeating callback at a musical interval.

```javascript
// Bar:beat:sixteenth interval
clock.every('1:0:0', () => flash());    // every bar
clock.every('0:1:0', () => pulse());    // every beat
clock.every('0:0:1', () => tick());     // every sixteenth

// Audio-precise repeating — fires early with grid-aligned time
clock.every('0:1:0', (time) => {
  send({
    type: 'trigger',
    values: { peak: 1, sustain: 0.7 },
    attack: 0.01,
    decay: 0.1,
    time
  });
}, { audio: true });
```

### cancel

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

## Audio-Rate Beat Sync (`beat~`)

For **continuous** beat-synced signals in the audio graph, use the [beat~](/docs/objects/beat~) object. Unlike `clock.schedule` which fires discrete callbacks, `beat~` outputs a sample-by-sample 0→1 sawtooth ramp synchronized to the transport BPM.

```text
beat~       → ramp 0→1 once per beat
beat~ 4     → ramp 0→1 four times per beat (16th notes)
beat~ 0.25  → ramp 0→1 once per bar (in 4/4)
```

The multiply parameter scales the beat frequency: `1` = per beat (default), `2` = 8th notes, `4` = 16ths, `0.25` = per bar. It's an AudioParam, so other signals can modulate it.

The output follows transport play/pause/stop — it freezes when paused and resets on stop.

## Tone.js Scheduling

If you're using [Tone.js](/docs/objects/tone~), you can also schedule events through the Tone.js Transport. This is useful when working with Tone.js synths and effects, since they integrate directly with `Tone.getTransport()`.

```javascript
// In a tone~ object — Tone.js Transport is synced to the global transport
const synth = new Tone.Synth().connect(outputNode);

Tone.getTransport().scheduleRepeat((time) => {
  synth.triggerAttackRelease('C4', '8n', time);
}, '4n');

Tone.getTransport().schedule((time) => {
  synth.triggerAttackRelease('E4', '2n', time);
}, '4:0:0');
```

Always use the `time` callback argument (not `Tone.now()`) for sample-accurate timing.

**When to use which:**

| Approach | Best for |
| -------- | -------- |
| `clock.onBeat` / `every` / `schedule` | Visual sync — fires after event (~25ms precision) |
| Any method + `{ audio: true }` | Audio scheduling — fires early with precise `time` arg |
| `beat~` | Continuous audio-rate modulation (tremolo, FM, waveshaping) |
| `tone~` + Tone.Transport | Scheduling with Tone.js synths/effects |

### Scheduling Audio Parameters

Pass `{ audio: true }` to use lookahead scheduling with [parameter automation messages](/docs/parameter-automation). Then, pass the `time` argument from the callback into the `set`, `trigger` and `release` messages — this is used as an absolute time by default.

This lets you automate audio parameters (`gain~`, `osc~`, filters, etc.) with beat-synced, sample-accurate timing:

```javascript
// Trigger an envelope on every downbeat
clock.onBeat(0, (time) => {
  send({
    type: 'trigger',
    values: { peak: 1, sustain: 0.7 },
    attack: 0.01,
    decay: 0.1,
    time
  });
}, { audio: true });

// Schedule a filter sweep at bar 4
clock.schedule('4:0:0', (time) => {
  send({ type: 'set', value: 2000, time });
}, { audio: true });

// Repeating audio-precise scheduling every beat
clock.every('0:1:0', (time) => {
  send({
    type: 'trigger',
    values: { peak: 1, sustain: 0.7 },
    attack: 0.01,
    decay: 0.1,
    time
  });
}, { audio: true });
```

## Precision

All scheduling methods (`onBeat`, `schedule`, `every`) poll every ~25ms.

**Default (visual):** Callbacks fire **after** the event has occurred — accurate to ~25ms, imperceptible for visual sync.

**`{ audio: true }`:** Callbacks fire **before** the event, within a ~100ms lookahead window. The `time` argument contains the precise transport time of the event.

In worker environments (worker, canvas), all scheduling uses frame-based polling (~16ms at 60fps).

For continuous audio-rate signals, use [beat~](/docs/objects/beat~).
For Tone.js integration, use [tone~](/docs/objects/tone~).

## Hydra

In Hydra, you can use either `clock.time` or the bare `time` variable:

```javascript
// Both work in Hydra
osc(10, 0.1, () => clock.time)
osc(10, 0.1, () => time)  // shorthand
```

## See Also

- [beat](/docs/objects/beat) — Outputs current beat as a message on each beat change
- [Parameter Automation](/docs/parameter-automation) — Automate audio parameters with sample-accurate timing
- [Transport Control](/docs/transport-control) — Play/pause, BPM, time display
- [JavaScript Runner](/docs/javascript-runner) — Full JSRunner documentation
- [Audio Reactivity](/docs/audio-reactivity) — Using FFT data in visuals
