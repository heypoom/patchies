import { defineDSP } from '../define-dsp';

/**
 * ftom~ - Convert frequencies to MIDI note numbers (audio rate)
 * Formula: 69 + 12 * log2(freq / 440)
 */
defineDSP({
  name: 'ftom~',
  audioInlets: 1,
  audioOutlets: 1,
  state: () => ({}),

  process(_state, inputs, outputs) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;
    const log2 = Math.log(2);

    for (let i = 0; i < len; i++) {
      for (let ch = 0; ch < channels; ch++) {
        const freq = inputs[0][ch][i];
        // Avoid log of zero/negative
        if (freq > 0) {
          out[ch][i] = 69 + 12 * (Math.log(freq / 440) / log2);
        } else {
          out[ch][i] = 0;
        }
      }
    }
  }
});
