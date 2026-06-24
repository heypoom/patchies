[ChucK](https://chuck.cs.princeton.edu) is a programming language for
real-time sound synthesis and music creation. Great for algorithmic composition and sound design.
Runs via [WebChucK](https://chuck.cs.princeton.edu/webchuck).

![Patchies ChucK demo](/content/images/chuck-demo.webp)

> Try this patch [in the app](/?id=2nyuznzjgbp2j0a)!
> From @dtinth's [ChucK experiments](https://dt.in.th/ChucKSong4).

## Getting Started

Try this ChucK code for outputting oscillator with a low-pass filter.

```chuck
SinOsc osc => LPF filter => dac;

220 => osc.freq;
50 => filter.freq;
1.0 => filter.Q;

while (true) {
  1::second => now;
}
```

## Actions

- **Replace Shred** (`Ctrl/Cmd + Enter`): replaces the most recent shred
- **Add Shred** (`Ctrl/Cmd + \`): adds a new shred
- **Remove Shred** (`Ctrl/Cmd + Backspace`): removes the most recent shred
- **Expand Editor**: opens the ChucK code in the detached overlay editor
- **Gear button**: see running shreds, remove any with "x"

## Console Output

ChucK's `<<<` print statements are emitted as raw strings
from the message outlet.

## Presets

Enable the **ChucK Demos** preset pack to browse curated ChucK examples.
The pack includes playable starting points for FM tones, Shepard tones,
plucked strings, modal mallets, chorus pads, vocal synthesis, and noise
textures.

## Audio Input

ChucK accepts audio input for processing and analysis:

```chuck
adc => PitShift p => dac;
```

## Global Variables

The [demo patch](/?id=2nyuznzjgbp2j0a) shows how global
variables let you control ChucK programs with Patchies messages.

Declare variables with `global` (e.g. `global int bpm`) and re-compute
dependent variables in a loop.

## FFT Analysis

![Patchies ChucK FFT demo](/content/images/chuck-fft.webp)

Use ChucK for audio analysis and applying filters - it receives audio inputs
and can emit events and global variables.

## See Also

- [strudel](/docs/objects/strudel) - Strudel music environment
- [tone~](/docs/objects/tone~) - Tone.js synthesis
