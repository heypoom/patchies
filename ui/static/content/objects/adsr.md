ADSR envelope generator for controlling audio parameters like gain.

![Patchies simple synth keyboard demo](/content/images/simple-synth-keyboard.webp)

> Try this patch [in the app](/?id=geb2h5sc6pf2uj2)!
> A sampler that changes playback speed based on MIDI notes.

## Inlets

1. **trigger**: `1` triggers attack→decay→sustain, `0` triggers release
2. **peak**: peak amplitude (default: 1)
3. **attack**: attack time in ms (default: 100)
4. **decay**: decay time in ms (default: 200)
5. **sustain**: sustain level (default: 0.5)
6. **release**: release time in ms (default: 300)

Connect the output to an audio parameter inlet (e.g., `gain~`'s gain inlet).

## Scheduled Parameter Messages

Under the hood, `adsr` sends **scheduled messages** that automate audio
parameters. Send these directly from `js` nodes:

```js
// Trigger envelope (attack → decay → sustain)
send({
  type: 'trigger',
  values: { start: 0, peak: 1, sustain: 0.7 },
  attack: { time: 0.02 },  // seconds
  decay: { time: 0.1 }
});

// Release envelope
send({ type: 'release', release: { time: 0.3 }, endValue: 0 });

// Set value immediately
send({ type: 'set', value: 0.5 });

// Set value at future time (relative)
send({ type: 'set', value: 0.5, time: 0.5 });

// Set value at absolute audio context time
send({ type: 'set', value: 0.5, time: 1.0, timeMode: 'absolute' });
```

### Curve Types

Each phase config can specify a `curve`:

- `'linear'` (default) — straight-line ramp
- `'exponential'` — exponential ramp (target must not be 0)
- `'targetAtTime'` — asymptotic approach, optional `timeConstant`
- `'valueCurve'` — custom curve from an array of absolute values

```js
// Custom attack curve using valueCurve
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

The `values` array defines the exact shape of the curve over the phase
duration. Values are absolute (not normalized) — the first element is
the start value and the last is the end value. Requires at least 2 values.

Try the `midi-adsr-gain.js` preset. See
[this patch](/?id=4ezt0ne0frsf694) for usage.

## See Also

- [gain~](/docs/objects/gain~) - audio amplification
- [sampler~](/docs/objects/sampler~) - sample playback
