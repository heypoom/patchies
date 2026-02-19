import { defineDSP } from '../define-dsp';

/**
 * sqrt~ - Square root of signal
 * Returns 0 for negative inputs (real sqrt only)
 */
defineDSP({
  name: 'sqrt~',
  audioInlets: 1,
  audioOutlets: 1,
  state: () => ({}),

  process(_state, inputs, outputs) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;

    for (let i = 0; i < len; i++) {
      for (let ch = 0; ch < channels; ch++) {
        const val = inputs[0][ch][i];
        out[ch][i] = val >= 0 ? Math.sqrt(val) : 0;
      }
    }
  }
});
