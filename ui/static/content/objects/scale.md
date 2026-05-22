Remap a number from one range to another.

## Usage

```
scale 0 127 0 1
scale -1 1 0 255
```

The first two arguments set the input range. The last two arguments set the output range.

Values outside the input range are extrapolated. Use `clip` after `scale` when you want to
constrain the output.

## See Also

- [clip](/docs/objects/clip) - clamp a number to a min/max range
- [expr](/docs/objects/expr) - mathematical expressions
