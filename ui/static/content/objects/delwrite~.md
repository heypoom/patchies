Write to a named delay line. Creates a circular buffer that can be read by delread~ or delread4~ objects.

## Usage

```txt
osc~ 440 → delwrite~ mydelay 1000
```

Multiple delread~ or delread4~ objects can tap the same delay line at different times.

## Parameters

- **name**: Delay line name (string)
- **size**: Buffer size in milliseconds (default: 1000)

_Inspired by [Pure Data](https://pd.iem.sh/objects/delwrite~)._

## See Also

- [delread~](/docs/objects/delread~) - read at fixed delay time
- [delread4~](/docs/objects/delread4~) - read with interpolation for variable delays
- [delay~](/docs/objects/delay~) - simple delay effect
