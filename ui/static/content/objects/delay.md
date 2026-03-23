Delay messages by a specified time. Multiple messages can be in-flight
simultaneously — each is scheduled independently when received.

## Arguments

- `delay <ms>` — set initial delay time (e.g. `delay 500`)

_Inspired by [Pure Data pipe](https://pd.iem.sh/objects/pipe)._

## See Also

- [metro](/docs/objects/metro) - periodic timing
- [queue](/docs/objects/queue) - FIFO message buffer
- [delay~](/docs/objects/delay~) - audio delay line
