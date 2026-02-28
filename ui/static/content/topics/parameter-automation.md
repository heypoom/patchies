# Parameter Automation

Automate audio parameters with sample-accurate timing from any `js` node with scheduled audio parameter messages.

They work with any audio node that has an audio parameter inlet (`gain~`, `osc~`, `pan~`, `delay~`, filters, etc.). When you drag from an audio signal outlet, the audio parameter inlets will turn blue to indicate that it can be automated.

## Message Types

### Set

Set a parameter value immediately, or at a specific time.

```js
// Set immediately
send({ type: 'set', value: 0.5 });

// Set at a specific time (absolute by default)
send({ type: 'set', value: 0.5, time: 1.0 });

// Set at a relative time (n seconds from now)
send({ type: 'set', value: 0.5, time: 0.5, timeMode: 'relative' });
```

The `time` field uses absolute time by default, which works naturally with [clock scheduling](/docs/clock-api) — pass `{ audio: true }` for lookahead scheduling, then pass the `time` argument from the callback directly:

```js
// Schedule a parameter change on beat 0 with audio-precise timing
clock.onBeat(0, (time) => {
  send({ type: 'set', value: 440, time });
}, { audio: true });

// Schedule at a specific bar position
clock.schedule('4:0:0', (time) => {
  send({ type: 'set', value: 880, time });
}, { audio: true });
```

### Trigger

Trigger an attack-decay-sustain envelope.

```js
// Trigger immediately
send({
  type: 'trigger',
  values: { peak: 1, sustain: 0.7 },
  attack: 0.02,  // seconds
  decay: 0.1
});

// Trigger at a precise time (for beat-synced envelopes)
send({
  type: 'trigger',
  values: { peak: 1, sustain: 0.7 },
  attack: 0.02,
  decay: 0.1,
  time
});
```

`values.start` defaults to `0`. The `attack` and `decay` fields accept a number (seconds with linear curve) or a full config object `{ time, curve, ... }` for custom curves. See the curve types section below.

### Release

Trigger a release phase (ramp down from current value).

```js
// Release immediately
send({ type: 'release', release: 0.3, endValue: 0 });

// Release at a precise time
send({ type: 'release', release: 0.3, endValue: 0, time });
```

Like `attack`/`decay`, the `release` field accepts a number (seconds) or a full config object.

### Trigger + Release Example

A common pattern — trigger on noteOn, release on noteOff:

```js
recv((m) => {
  if (m.type === 'noteOn') {
    send({
      type: 'trigger',
      values: { peak: 1, sustain: 0.7 },
      attack: 0.02,
      decay: 0.1
    });
  } else if (m.type === 'noteOff') {
    send({ type: 'release', release: 0.3, endValue: 0 });
  }
});
```

The [adsr](/docs/objects/adsr) object wraps this pattern with convenient inlets for each parameter.

## Curve Types

When you pass a number for `attack`, `decay`, or `release`, it uses a linear curve. For custom curves, pass an object with `time` and `curve`:

| Curve            | Description                                                       |
|------------------|-------------------------------------------------------------------|
| `'linear'`       | Straight-line ramp (default)                                      |
| `'exponential'`  | Exponential ramp (target must not be 0)                           |
| `'targetAtTime'` | Asymptotic approach — eases toward target, never fully reaches it |
| `'valueCurve'`   | Custom curve from an array of absolute values                     |

The full config object shape is `{ time, curve, timeConstant?, values? }`:

```js
// number shorthand — equivalent to { time: 0.02, curve: 'linear' }
attack: 0.02

// object form — specify a curve type
attack: { time: 0.1, curve: 'exponential' }

// targetAtTime — approaches the target asymptotically (never fully arrives)
// timeConstant controls speed: smaller = faster.
// Reaches ~63% of the way in one time constant.
// Defaults to time * 0.3 if omitted.
decay: { time: 0.3, curve: 'targetAtTime', timeConstant: 0.1 }

// valueCurve — custom shape from an array of values
attack: {
  time: 0.1,
  curve: 'valueCurve',
  values: [0, 0.05, 0.2, 0.5, 0.8, 0.95, 1.0]
}
```

```js
// Full example: exponential decay with custom attack curve
send({
  type: 'trigger',
  values: { peak: 1, sustain: 0.7 },
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
