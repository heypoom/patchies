import { defineDSP } from '../define-dsp';
import { PhasorPortSchema } from '../schemas/phasor.schema';

defineDSP({
  name: 'phasor~',
  audioOutlets: 1,
  schema: PhasorPortSchema,

  state: () => ({
    phase: 0
  }),

  recv(state, data, inlet) {
    // Phase set (inlet 1) - frequency is handled via AudioParam
    if (inlet === 1) {
      const phase = parseFloat(data as string);

      if (!isNaN(phase)) state.phase = phase % 1;
    }
  },

  process(state, _inputs, outputs, _send, parameters) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;
    const freqParam = parameters.frequency;
    // Chromium returns single-element array when param is constant (k-rate),
    // Firefox always returns 128 samples. Handle both cases.
    const freqIsKRate = freqParam.length === 1;

    for (let i = 0; i < len; i++) {
      // Use per-sample frequency from AudioParam (enables a-rate modulation)
      const frequency = freqIsKRate ? freqParam[0] : freqParam[i];
      const increment = frequency / sampleRate;

      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = state.phase;
      }

      state.phase += increment;

      // Wrap phase to [0, 1)
      if (state.phase >= 1) state.phase -= 1;
      else if (state.phase < 0) state.phase += 1;
    }
  }
});
