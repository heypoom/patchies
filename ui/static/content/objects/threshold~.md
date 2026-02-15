Trigger bangs from audio signal level. Outputs a bang on the first outlet when the signal reaches or exceeds a trigger threshold, and a bang on the second outlet when it drops below a rest threshold. Debounce times prevent rapid re-triggering.

## Usage

Detect when a signal crosses a threshold:

```
osc~ → threshold~
```

Send a `set` message to configure thresholds and debounce:

```
msg {type: "set", triggerThreshold: 0.5, restThreshold: 0.3} → threshold~
```

With debounce times (in ms):

```
msg {type: "set", triggerThreshold: 0.5, triggerDebounce: 100, restThreshold: 0.3, restDebounce: 50} → threshold~
```

Use with an envelope follower for onset detection:

```
mic~ → env~ → threshold~
threshold~ (trigger outlet) → your-synth
```

## See Also

- [snapshot~](/docs/objects/snapshot~) - sample signal value on bang
- [bang~](/docs/objects/bang~) - emit bang on audio onset
- [env~](/docs/objects/env~) - signal envelope follower
