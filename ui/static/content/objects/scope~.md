Oscilloscope waveform display for real-time audio signal
visualization.

Displays the time-domain audio waveform with automatic trigger
detection for a stable display. Connect any audio source to see
its waveform.

The display triggers on rising zero-crossings to keep periodic
waveforms (sine, saw, square, etc.) visually stable. If no
trigger is found within 2048 samples, it forces a capture to
prevent the display from freezing on noise or DC signals.

## Parameters

- **Samples** (64 - 2048): Number of audio samples captured per
  frame. Lower values show fewer waveform cycles (zoomed in),
  higher values show more cycles (zoomed out).
- **X Scale** (0.5x - 8x): Horizontal zoom. Higher values
  compress the waveform horizontally, showing fewer samples
  across the display width.
- **Y Scale** (0.1x - 10x): Vertical zoom. Amplifies the
  waveform amplitude for quiet signals, or reduces it for
  loud ones.
- **Refresh** (0 - 120 fps): Maximum refresh rate. 0 (max) means
  no limit (renders as fast as triggers arrive). Lower values
  reduce CPU usage by throttling how often the processor
  sends new buffers.

## Trigger Stability

The trigger locks to rising zero-crossings at sample-level
precision. For lower frequencies (e.g. 440 Hz ~ 100
samples/cycle), trigger jitter is a tiny fraction of a cycle
and the display appears rock-solid.

At higher frequencies (e.g. 4400 Hz ~ 10 samples/cycle), each
sample represents a larger phase offset, so the waveform may
visibly shift between frames.

## See Also

- [meter~](/docs/objects/meter~) - audio level metering
- [fft~](/docs/objects/fft~) - frequency analysis
- [snapshot~](/docs/objects/snapshot~) - sample signal values
