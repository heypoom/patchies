# Parameter Automation

Automate audio parameters with sample-accurate timing from any `js` node with scheduled audio parameter messages.

They work with any audio node that has an audio parameter inlet (`gain~`, `osc~`, `pan~`, `delay~`, filters, etc.). When you drag from an audio signal outlet, the audio parameter inlets will turn blue to indicate that it can be automated.

## Message Types

### Set

Set a parameter value immediately, or at a specific time.

```js
// Set immediately
send({ type: 'set', value: 0.5 });

// Set at a relative time (seconds from now)
send({ type: 'set', value: 0.5, time: 0.5 });

// Set at an absolute audio context time
send({ type: 'set', value: 0.5, time: 1.0, timeMode: 'absolute' });
```

The `timeMode: 'absolute'` option is useful with [clock.schedule](/docs/clock-api) — pass the precise `time` argument from the callback directly:

```js
// Schedule a parameter change on beat 0 with audio-precise timing
clock.onBeat(0, (time) => {
  send({ type: 'set', value: 440, time, timeMode: 'absolute' });
});

// Schedule at a specific bar position
clock.schedule('4:0:0', (time) => {
  send({ type: 'set', value: 880, time, timeMode: 'absolute' });
});
```

### Trigger

Trigger an attack-decay-sustain envelope.

```js
send({
  type: 'trigger',
  values: { start: 0, peak: 1, sustain: 0.7 },
  attack: { time: 0.02 },  // seconds
  decay: { time: 0.1 }
});
```

### Release

Trigger a release phase (ramp down from current value).

```js
send({ type: 'release', release: { time: 0.3 }, endValue: 0 });
```

### Trigger + Release Example

A common pattern — trigger on note-on, release on note-off:

```js
recv((msg) => {
  if (msg.type === 'noteon') {
    send({
      type: 'trigger',
      values: { start: 0, peak: 1, sustain: 0.7 },
      attack: { time: 0.02 },
      decay: { time: 0.1 }
    });
  }

  if (msg.type === 'noteoff') {
    send({ type: 'release', release: { time: 0.3 }, endValue: 0 });
  }
});
```

The [adsr](/docs/objects/adsr) object wraps this pattern with convenient inlets for each parameter.

## Curve Types

Each phase (`attack`, `decay`, `release`) can specify a `curve`:

| Curve            | Description                                            |
|------------------|--------------------------------------------------------|
| `'linear'`       | Straight-line ramp (default)                           |
| `'exponential'`  | Exponential ramp (target must not be 0)                |
| `'targetAtTime'` | Asymptotic approach, optional `timeConstant`           |
| `'valueCurve'`   | Custom curve from an array of absolute values          |

```js
// Exponential decay with custom attack curve
send({
  type: 'trigger',
  values: { start: 0, peak: 1, sustain: 0.7 },
  attack: {
    time: 0.1,
    curve: 'valueCurve',
    values: [0, 0.05, 0.2, 0.5, 0.8, 0.95, 1.0]
  },
  decay: { time: 0.2, curve: 'exponential' }
});
```

The `values` array defines the exact shape of the curve over the phase duration. Values are absolute (not normalized) — the first element is the start value and the last is the end value. Requires at least 2 values.

## Compatible Nodes

Any audio node with an AudioParam inlet accepts scheduled messages. Common targets:

- [gain~](/docs/objects/gain~) — automate volume
- [osc~](/docs/objects/osc~) — automate frequency, detune
- [pan~](/docs/objects/pan~) — automate stereo position
- [delay~](/docs/objects/delay~) — automate delay time
- [lowpass~](/docs/objects/lowpass~), [highpass~](/docs/objects/highpass~), etc. — automate filter cutoff/Q
- [compressor~](/docs/objects/compressor~) — automate threshold, ratio, etc.

## See Also

- [Clock API](/docs/clock-api) — transport-synced scheduling with `clock.schedule`
- [adsr](/docs/objects/adsr) — envelope generator that sends scheduled messages
- [line~](/docs/objects/line~) — control-value ramp generator (signal-based alternative)
