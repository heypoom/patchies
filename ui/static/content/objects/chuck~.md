[ChucK](https://chuck.cs.princeton.edu) is a programming language for
real-time sound synthesis and music creation.

![Patchies ChucK demo](/content/images/chuck-demo.webp)

> Try this patch [in the app](/?id=2nyuznzjgbp2j0a)!
> From @dtinth's [ChucK experiments](https://dt.in.th/ChucKSong4).

Great for algorithmic composition and sound design. Runs via
[WebChucK](https://chuck.cs.princeton.edu/webchuck/).

## Actions

- **Replace Shred** (`Ctrl/Cmd + Enter`): replaces the most recent shred
- **Add Shred** (`Ctrl/Cmd + \`): adds a new shred
- **Remove Shred** (`Ctrl/Cmd + Backspace`): removes the most recent shred
- **Gear button**: see running shreds, remove any with "x"

## Audio Input

ChucK accepts audio input for processing:

```chuck
adc => PitShift p => dac;
```

## FFT Analysis

![Patchies ChucK FFT demo](/content/images/chuck-fft.webp)

Use ChucK for audio analysis and applying filters - it receives audio inputs
and can emit events and global variables.

## Global Variables

The [demo patch](/?id=2nyuznzjgbp2j0a) shows how global
variables let you control ChucK programs with Patchies messages.

Declare variables with `global` (e.g. `global int bpm`) and re-compute
dependent variables in a loop.

## Console Output

ChucK's `<<<` print statements are emitted as raw strings from the message
outlet.

## See Also

- [strudel](/docs/objects/strudel) - Strudel music environment
- [tone~](/docs/objects/tone~) - Tone.js synthesis
