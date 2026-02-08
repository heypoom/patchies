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

Each phase config can specify `curve: 'linear' | 'exponential' | 'targetAtTime'`.

Try the `midi-adsr-gain.js` preset. See
[this patch](/?id=1pvwvmtoo5s3gdz) for usage.

## See Also

- [gain~](/docs/objects/gain~) - audio amplification
- [sampler~](/docs/objects/sampler~) - sample playback
