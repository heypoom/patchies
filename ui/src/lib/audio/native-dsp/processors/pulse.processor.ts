import { defineDSP } from '../define-dsp';

defineDSP({
  name: 'pulse~',
  audioOutlets: 1,
  state: () => ({ phase: 0, frequency: 440, width: 0.5 }),

  recv(state, data, inlet) {
    const val = parseFloat(data as string);
    if (isNaN(val)) return;
    if (inlet === 0) state.frequency = val;
    if (inlet === 1) state.width = Math.max(0, Math.min(1, val));
  },

  process(state, _inputs, outputs) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;
    const increment = state.frequency / sampleRate;

    for (let i = 0; i < len; i++) {
      const sample = state.phase < state.width ? 1 : -1;
      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = sample;
      }
      state.phase += increment;
      if (state.phase >= 1) state.phase -= 1;
      else if (state.phase < 0) state.phase += 1;
    }
  }
});
