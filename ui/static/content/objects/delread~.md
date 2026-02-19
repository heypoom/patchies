Read from a named delay line at a fixed delay time. The delay line must be created by a delwrite~ object.

## Usage

```txt
delwrite~ mydelay 1000
           ↓
delread~ mydelay 100 → gain~ → out~
```

## Parameters

- **name**: Delay line name to read from
- **delay**: Delay time in milliseconds

For variable delay times (chorus, flanger effects), use delread4~ instead.

## See Also

- [delwrite~](/docs/objects/delwrite~) - create and write to delay line
- [delread4~](/docs/objects/delread4~) - read with interpolation for variable delays
- [comb~](/docs/objects/comb~) - comb filter
