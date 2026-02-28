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

Note that `adsr` emits control messages for Web Audio API, it does not emit audio
signals. For control value-based ADSR, use [line~](/docs/objects/line~) instead.

## Scheduled Messages

Under the hood, `adsr` sends [parameter automation messages](/docs/parameter-automation).
You can also send these directly from `js` nodes — see the full API
in the [Parameter Automation](/docs/parameter-automation) topic.

Try the `midi-adsr.js` preset. See [this patch](/?id=4ezt0ne0frsf694) for usage.

## See Also

- [gain~](/docs/objects/gain~) - audio amplification
- [sampler~](/docs/objects/sampler~) - sample playback
