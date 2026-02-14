Signal ramp generator. Attempt to reach a target value over a specified time,
outputting a continuous audio-rate signal.

## Usage

Send a number to jump immediately:

```txt
60 → line~ → 60 (instantly)
```

Send `[value, time]` to ramp:

```txt
[1, 500] → line~ → ramps from current to 1 over 500ms
```

Or set ramp time via the right inlet, then send target:

```txt
500 → inlet 2 (sets time)
1   → inlet 1 (ramps to 1 over 500ms)
```

Send `stop` to freeze at the current value.

## See Also

- [adsr](/docs/objects/adsr) - ADSR envelope generator for audio param automation
- [sig~](/docs/objects/sig~) - constant signal
- [gain~](/docs/objects/gain~) - audio amplification
- [dsp~](/docs/objects/dsp~) - JS-based signal processor
- [expr~](/docs/objects/expr~) - expression-based signal processor
