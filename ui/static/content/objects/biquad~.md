2nd order (2-pole / 2-zero) filter with direct coefficient control. Use this when you need precise control over filter characteristics or want to implement custom filter designs.

## Usage

The filter implements the difference equation:
```
y[n] = ff1*x[n] + ff2*x[n-1] + ff3*x[n-2] - fb1*y[n-1] - fb2*y[n-2]
```

## Parameters

- **ff1** (b0): Feedforward coefficient for current sample (default: 1)
- **ff2** (b1): Feedforward coefficient for x[n-1] (default: 0)
- **ff3** (b2): Feedforward coefficient for x[n-2] (default: 0)
- **fb1** (a1): Feedback coefficient for y[n-1] (default: 0)
- **fb2** (a2): Feedback coefficient for y[n-2] (default: 0)

With defaults (ff1=1, others=0), the filter passes audio unchanged.

## See Also

- [lowpass~](/docs/objects/lowpass~) - preset lowpass filter
- [bandpass~](/docs/objects/bandpass~) - preset bandpass filter
- [vcf~](/docs/objects/vcf~) - voltage-controlled filter
