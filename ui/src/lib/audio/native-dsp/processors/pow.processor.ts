import { defineDSP } from '../define-dsp';
import { PowPortSchema } from '../schemas/pow.schema';

defineDSP({
  name: 'pow~',
  audioInlets: 1,
  audioOutlets: 1,
  schema: PowPortSchema,

  state: () => ({}),

  process(_state, inputs, outputs, _send, parameters) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;
    const expParam = parameters.exponent;
    // Chromium returns single-element array when param is constant (k-rate),
    // Firefox always returns 128 samples. Handle both cases.
    const expIsKRate = expParam.length === 1;

    for (let i = 0; i < len; i++) {
      const exponent = expIsKRate ? expParam[0] : expParam[i];

      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = Math.pow(inputs[0][ch][i], exponent);
      }
    }
  }
});
