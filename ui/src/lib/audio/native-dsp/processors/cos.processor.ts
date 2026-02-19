import { defineDSP } from '../define-dsp';

/**
 * cos~ - Cosine waveshaper
 * Outputs cos(2π × input), converting phasor (0-1) to cosine wave (-1 to 1)
 */
defineDSP({
  name: 'cos~',
  audioInlets: 1,
  audioOutlets: 1,
  state: () => ({}),

  process(_state, inputs, outputs) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;
    const twoPi = 2 * Math.PI;

    for (let i = 0; i < len; i++) {
      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = Math.cos(twoPi * inputs[0][ch][i]);
      }
    }
  }
});
