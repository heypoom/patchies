import { defineDSP } from '../define-dsp';

defineDSP({
  name: 'max~',
  audioInlets: 2,
  audioOutlets: 1,
  state: () => ({}),

  process(_state, inputs, outputs) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;

    for (let i = 0; i < len; i++) {
      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = Math.max(inputs[0][ch][i], inputs[1][ch][i]);
      }
    }
  }
});
