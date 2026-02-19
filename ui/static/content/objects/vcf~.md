Voltage-controlled resonant filter with signal-rate frequency modulation. Unlike bandpass~ and lowpass~, the center frequency can be modulated at audio rate for classic analog synth sweeps.

## Usage

```txt
osc~ 440 → vcf~ → gain~ → out~
           ↑
      phasor~ 1 → *~ 1000 → +~ 200
```

The frequency inlet accepts a signal, so you can sweep the filter with LFOs, envelopes, or other audio signals.

## Outlets

- **Outlet 1 (bandpass)**: Real output - resonant bandpass filtered signal
- **Outlet 2 (lowpass)**: Imaginary output - lowpass filtered signal

## Parameters

- **frequency**: Center frequency in Hz (signal rate input)
- **Q**: Resonance/quality factor (message rate, default: 1)

Higher Q values create a sharper, more resonant peak. Values above 10 produce strong resonance. The filter can self-oscillate at very high Q.

_Inspired by [Pure Data](https://pd.iem.sh/objects/vcf~)._

## See Also

- [bandpass~](/docs/objects/bandpass~) - message-rate bandpass filter
- [lowpass~](/docs/objects/lowpass~) - message-rate lowpass filter
- [comb~](/docs/objects/comb~) - comb filter
