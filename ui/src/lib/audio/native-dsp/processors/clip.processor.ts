import { defineDSP } from '../define-dsp';

defineDSP({
  name: 'clip~',
  audioInlets: 1,
  audioOutlets: 1,
  state: () => ({ min: -1, max: 1 }),

  recv(state, data, inlet) {
    const val = parseFloat(data as string);
    if (isNaN(val)) return;
    if (inlet === 1) state.min = val;
    if (inlet === 2) state.max = val;
  },

  process(state, inputs, outputs) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;

    for (let i = 0; i < len; i++) {
      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = Math.max(state.min, Math.min(state.max, inputs[0][ch][i]));
      }
    }
  }
});
