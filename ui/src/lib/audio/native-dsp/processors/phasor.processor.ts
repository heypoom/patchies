import { defineDSP } from '../define-dsp';

defineDSP({
  name: 'phasor~',
  audioOutlets: 1,

  state: () => ({
    phase: 0,
    frequency: 0
  }),

  recv(state, data, inlet) {
    if (inlet === 0) {
      const freq = parseFloat(data as string);

      if (!isNaN(freq)) state.frequency = freq;
    } else if (inlet === 1) {
      const phase = parseFloat(data as string);

      if (!isNaN(phase)) state.phase = phase % 1;
    }
  },

  process(state, _inputs, outputs) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;
    const increment = state.frequency / sampleRate;

    for (let i = 0; i < len; i++) {
      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = state.phase;
      }

      state.phase += increment;

      // Wrap phase to [0, 1)
      if (state.phase >= 1) state.phase -= 1;
      else if (state.phase < 0) state.phase += 1;
    }
  }
});
