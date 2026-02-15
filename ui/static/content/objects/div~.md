Divide one audio signal by another sample-by-sample.

## Usage

```txt
osc~ 440 → /~ ← sig~ 2
```

Divides the left inlet signal by the right inlet signal.
Useful for scaling signals down or normalizing.

A constant divisor can be set via the creation argument or the hidden float inlet.

## See Also

- [*~](/docs/objects/*~) - multiply signals
- [+~](/docs/objects/+~) - add signals
- [-~](/docs/objects/-~) - subtract signals
