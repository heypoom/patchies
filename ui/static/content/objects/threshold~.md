Trigger bangs from audio signal level. Outputs a bang on the first outlet when the signal reaches or exceeds a trigger threshold, and a bang on the second outlet when it drops below a rest threshold. Debounce times prevent rapid re-triggering.

## Usage

Detect when a signal crosses a threshold:

```
osc~ → threshold~
```

Send a list to configure thresholds and debounce (in ms):

```
msg 0.5 0.3 → threshold~
msg 0.5 100 0.3 50 → threshold~
```

Use with an envelope follower for onset detection:

```
mic~ → env~ → threshold~
threshold~ (trigger outlet) → your-synth
```

_Inspired by [Pure Data](https://pd.iem.sh/objects/threshold~)._

## See Also

- [snapshot~](/docs/objects/snapshot~) - sample signal value on bang
- [bang~](/docs/objects/bang~) - emit bang on audio onset
- [env~](/docs/objects/env~) - signal envelope follower
