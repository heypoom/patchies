Read from a delay line with 4-point interpolation. Accepts signal-rate delay time for smooth variable delays.

## Usage

Create a flanger effect:

```txt
delwrite~ mydelay 50
           ↓
phasor~ 0.5 → *~ 10 → +~ 5 → delread4~ mydelay → *~ 0.5 → +~
                                                          ↑
                                               osc~ 440 ──┘
```

The delay time input is a signal, allowing smooth modulation for chorus, flanger, and pitch shifting effects.

## Parameters

- **name**: Delay line name to read from (set via message)
- **delay**: Delay time signal in milliseconds (inlet)

## See Also

- [delwrite~](/docs/objects/delwrite~) - create and write to delay line
- [delread~](/docs/objects/delread~) - read at fixed delay time
- [comb~](/docs/objects/comb~) - comb filter
