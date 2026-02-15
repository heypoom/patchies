import { defineDSP } from '../define-dsp';

defineDSP({
  name: 'comb~',
  audioInlets: 1,
  audioOutlets: 1,

  state: () => ({
    buffer: new Float32Array(48000), // 1 second at 48kHz
    writeIndex: 0,
    delayMs: 10,
    feedback: 0.7
  }),

  recv(state, data, inlet) {
    const val = parseFloat(data as string);
    if (isNaN(val)) return;
    if (inlet === 1) state.delayMs = Math.max(0.02, val);
    if (inlet === 2) state.feedback = Math.max(-0.999, Math.min(0.999, val));
  },

  process(state, inputs, outputs) {
    const out = outputs[0];
    const input = inputs[0][0];
    const len = out[0].length;
    const channels = out.length;
    const delaySamples = Math.round((state.delayMs / 1000) * sampleRate);
    const bufLen = state.buffer.length;

    for (let i = 0; i < len; i++) {
      const readIndex = (state.writeIndex - delaySamples + bufLen) % bufLen;
      const delayed = state.buffer[readIndex];
      const inSample = input[i];
      const outSample = inSample + delayed * state.feedback;

      state.buffer[state.writeIndex] = outSample;
      state.writeIndex = (state.writeIndex + 1) % bufLen;

      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = outSample;
      }
    }
  }
});
