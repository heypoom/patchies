import { defineDSP } from '../define-dsp';

defineDSP({
  name: 'noise~',
  audioOutlets: 1,

  state: () => ({}),

  process(_state, _inputs, outputs) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;

    for (let i = 0; i < len; i++) {
      const sample = Math.random() * 2 - 1;

      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = sample;
      }
    }
  }
});
