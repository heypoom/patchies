Outputs a bang message after each DSP block cycle.

Useful for sampling outputs of analysis algorithms at audio block rate.

## Usage

```txt
bang~ → snapshot~ → sample signal value every block
```

In the Web Audio API, each block is 128 samples. At 44100 Hz, this is about every 2.9 ms.

_Inspired by [Pure Data](https://pd.iem.sh/objects/bang~)._

## See Also

- [snapshot~](/docs/objects/snapshot~) - sample signal value on bang
- [meter~](/docs/objects/meter~) - visual signal level meter
