Amplify or attenuate audio signals.

## Parameters

- **gain**: Amplification factor (default: 1.0)
  - Values > 1 amplify the signal
  - Values < 1 attenuate the signal
  - Value of 0 silences the signal

## Automation

Connect envelope generators like [adsr](/docs/objects/adsr) to the gain inlet
for dynamic volume control.

## See Also

- [compressor~](/docs/objects/compressor~) - dynamic range compression
- [pan~](/docs/objects/pan~) - stereo positioning
