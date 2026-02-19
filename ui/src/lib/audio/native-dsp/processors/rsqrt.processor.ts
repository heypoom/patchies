import { defineDSP } from '../define-dsp';

/**
 * rsqrt~ - Reciprocal square root (1/√x)
 * Returns 0 for non-positive inputs
 */
defineDSP({
  name: 'rsqrt~',
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
        out[ch][i] = val > 0 ? 1 / Math.sqrt(val) : 0;
      }
    }
  }
});
