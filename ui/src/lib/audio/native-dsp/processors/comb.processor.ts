import { defineDSP } from '../define-dsp';
import { CombPortSchema } from '../schemas/comb.schema';

defineDSP({
  name: 'comb~',
  audioInlets: 1,
  audioOutlets: 1,
  schema: CombPortSchema,

  state: () => ({
    buffer: new Float32Array(48000), // 1 second at 48kHz
    writeIndex: 0
  }),

  process(state, inputs, outputs, _send, parameters) {
    const out = outputs[0];
    const input = inputs[0][0];
    const len = out[0].length;
    const channels = out.length;
    const bufLen = state.buffer.length;

    // delay is k-rate, so use first value of the block
    const delayMs = parameters.delay[0];
    const delaySamples = Math.round((delayMs / 1000) * sampleRate);
    const feedbackParam = parameters.feedback;

    // Chromium returns single-element array when param is constant (k-rate),
    // Firefox always returns 128 samples. Handle both cases.
    const fbIsKRate = feedbackParam.length === 1;

    for (let i = 0; i < len; i++) {
      const feedback = fbIsKRate ? feedbackParam[0] : feedbackParam[i];
      const readIndex = (state.writeIndex - delaySamples + bufLen) % bufLen;
      const delayed = state.buffer[readIndex];
      const inSample = input[i];
      const outSample = inSample + delayed * feedback;

      state.buffer[state.writeIndex] = outSample;
      state.writeIndex = (state.writeIndex + 1) % bufLen;

      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = outSample;
      }
    }
  }
});
