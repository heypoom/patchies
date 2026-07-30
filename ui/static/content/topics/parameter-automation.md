# Parameter Automation

Use scheduled audio-parameter messages from any `js` node to automate audio parameters with sample-accurate timing.

These messages work with audio nodes that have an audio-parameter inlet, such as `gain~`, `osc~`, `pan~`, and `delay~`. Drag from an audio signal outlet to see eligible inlets turn blue.

## Message Types

### Set

Set a parameter value now or at a selected time.

```js
// Set immediately
send({ type: 'set', value: 0.5 });

// Set at a specific time (absolute by default)
send({ type: 'set', value: 0.5, time: 1.0 });

// Set at a relative time (n seconds from now)
send({ type: 'set', value: 0.5, time: 0.5, timeMode: 'relative' });
```

The `time` field uses absolute time unless you set `timeMode: 'relative'`. Use it with [clock scheduling](/docs/clock-api) for precise future changes. Pass `{ audio: true }` for lookahead scheduling. Then pass the callback `time` argument directly:

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

If you omit `values.start`, it defaults to `0`. The `attack` and `decay` fields accept a number or a config object. A number sets seconds with a linear curve. See the curve types section for custom curves.

### Release

Trigger a release phase that ramps down from the current value.

```js
// Release immediately
send({ type: 'release', release: 0.3, endValue: 0 });

// Release at a precise time
send({ type: 'release', release: 0.3, endValue: 0, time });
```

Like `attack` and `decay`, the `release` field accepts a duration or a config object.

### Trigger and Release Example

Trigger on `noteOn` and release on `noteOff`:

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

The [adsr](/docs/objects/adsr) object provides an inlet for each parameter in this pattern.

## Curve Types

When you pass a number for `attack`, `decay`, or `release`, Patchies uses a linear curve. For a custom curve, pass an object with `time` and `curve`:

| Curve | Description |
| ----- | ----------- |
| `'linear'` | Straight-line ramp. This is the default. |
| `'exponential'` | Exponential ramp. The target must not be `0`. |
| `'targetAtTime'` | Approaches the target without fully reaching it. |
| `'valueCurve'` | Uses an array of absolute values for a custom curve. |

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

The `values` array defines the curve shape over the phase duration. Its values are absolute, not normalized. The first element is the start value. The last element is the end value. The array must contain at least two values.

## Compatible Nodes

Any audio node with an AudioParam inlet accepts scheduled messages. Common targets include:

- [gain~](/docs/objects/gain~) — Automate volume.
- [osc~](/docs/objects/osc~) — Automate frequency and detune.
- [pan~](/docs/objects/pan~) — Automate stereo position.
- [delay~](/docs/objects/delay~) — Automate delay time.
- [lowpass~](/docs/objects/lowpass~) and [highpass~](/docs/objects/highpass~) — Automate filter cutoff and Q.
- [compressor~](/docs/objects/compressor~) — Automate threshold and ratio.

## See Also

- [Clock API](/docs/clock-api) — Schedule changes with `clock.schedule`.
- [adsr](/docs/objects/adsr) — Send envelope messages.
- [line~](/docs/objects/line~) — Generate signal-based control-value ramps.
