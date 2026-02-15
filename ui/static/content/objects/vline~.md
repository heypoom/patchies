Sample-accurate scheduled ramps. Like line~ but supports queued segments with delay offsets.

## Usage

Send a number to jump immediately:

```txt
1 → vline~ → 1 (instantly)
```

Send `[target, time]` to ramp:

```txt
[1, 500] → vline~ → ramps to 1 over 500ms
```

Send `[target, time, delay]` for delayed ramps:

```txt
[1, 100, 0] → vline~
[0, 200, 100] → vline~
```

This queues a ramp to 1 over 100ms starting immediately, then a ramp to 0 over 200ms starting 100ms later.

## See Also

- [line~](/docs/objects/line~) - simple signal ramp generator
- [adsr~](/docs/objects/adsr~) - ADSR envelope generator
