import { defineDSP } from '../define-dsp';
import { ClipPortSchema } from '../schemas/clip.schema';

defineDSP({
  name: 'clip~',
  audioInlets: 1,
  audioOutlets: 1,
  schema: ClipPortSchema,

  state: () => ({}),

  process(_state, inputs, outputs, _send, parameters) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;
    const minParam = parameters.min;
    const maxParam = parameters.max;
    // Chromium returns single-element array when param is constant (k-rate),
    // Firefox always returns 128 samples. Handle both cases.
    const minIsKRate = minParam.length === 1;
    const maxIsKRate = maxParam.length === 1;

    for (let i = 0; i < len; i++) {
      const min = minIsKRate ? minParam[0] : minParam[i];
      const max = maxIsKRate ? maxParam[0] : maxParam[i];

      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = Math.max(min, Math.min(max, inputs[0][ch][i]));
      }
    }
  }
});
