import { defineDSP } from '../define-dsp';

/**
 * mtof~ - Convert MIDI note numbers to frequencies (audio rate)
 * Formula: 440 * 2^((note - 69) / 12)
 */
defineDSP({
  name: 'mtof~',
  audioInlets: 1,
  audioOutlets: 1,
  state: () => ({}),

  process(_state, inputs, outputs) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;

    for (let i = 0; i < len; i++) {
      for (let ch = 0; ch < channels; ch++) {
        const note = inputs[0][ch][i];
        out[ch][i] = 440 * Math.pow(2, (note - 69) / 12);
      }
    }
  }
});
