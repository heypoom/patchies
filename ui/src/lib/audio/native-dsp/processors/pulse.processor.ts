import { defineDSP } from '../define-dsp';
import { PulsePortSchema } from '../schemas/pulse.schema';

defineDSP({
  name: 'pulse~',
  audioOutlets: 1,
  schema: PulsePortSchema,

  state: () => ({
    phase: 0
  }),

  process(state, _inputs, outputs, _send, parameters) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;
    const freqParam = parameters.frequency;
    const widthParam = parameters.width;

    for (let i = 0; i < len; i++) {
      const frequency = freqParam[i];
      const width = widthParam[i];
      const increment = frequency / sampleRate;

      const sample = state.phase < width ? 1 : -1;
      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = sample;
      }

      state.phase += increment;
      if (state.phase >= 1) state.phase -= 1;
      else if (state.phase < 0) state.phase += 1;
    }
  }
});
