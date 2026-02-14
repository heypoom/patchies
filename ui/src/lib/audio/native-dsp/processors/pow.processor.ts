import { defineDSP } from '../define-dsp';

defineDSP({
  name: 'pow~',
  audioInlets: 1,
  audioOutlets: 1,
  state: () => ({ exponent: 2 }),

  recv(state, data, inlet) {
    if (inlet === 1) {
      const val = parseFloat(data as string);
      if (!isNaN(val)) state.exponent = val;
    }
  },

  process(state, inputs, outputs) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;

    for (let i = 0; i < len; i++) {
      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = Math.pow(inputs[0][ch][i], state.exponent);
      }
    }
  }
});
