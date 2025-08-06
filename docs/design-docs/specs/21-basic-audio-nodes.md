# 20. Web Audio Nodes

Let's add some basic Web Audio nodes to start building our node-based video engine.

We should have a way to mark nodes as audio nodes, so that we can easily transform them into audio graphs. Some of the advanced ones will require `AudioWorklet` to run custom audio processing code, in which we may even utilize WebAssembly for performance. For now, we will focus on basic nodes that can be used in an audio graph.

## Full list of nodes

We'll slowly work our way through the following list of nodes, implementing them **one by one**. You must not generate multiple nodes at once, as each node will require its own design, implementation and testing.

### Basic nodes

- `gain`: gain node, used to control volume.
- `midi2freq`: converts MIDI note numbers to frequency values.
- `metro`: metronome node, used to trigger events at a regular interval.
- `osc`: oscillator node, generates a sine wave at a specified frequency.
- `phasor`: sawtooth wave generator, ramps from 0 to 1 at a specified frequency.
- `noise`: basic noise generator, produces white noise.
- `+`: add two signals
- `-`: subtract two signals
- `*`: multiply two signals
- `/`: divide two signals
- `lpf`: low-pass filter, allows frequencies below a certain cutoff to pass through.
- `hpf`: high-pass filter, allows frequencies above a certain cutoff to pass through.
- `bpf`: band-pass filter, allows frequencies within a certain range to pass through.
- `clip`: clips the signal to a specified range.
- `scale`: scales the signal to a specified range.
- `map`: maps the signal from one range to another.

### II

- Delays
  - Convolution
  - Impulse response
- Reverb
