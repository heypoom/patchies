import { defineDSP } from '../define-dsp';
import { SlopPortSchema } from '../schemas/slop.schema';

/**
 * slop~ - Slew-limiting low-pass filter
 *
 * Limits how fast the output can change per sample. Useful for:
 * - Smoothing control signals
 * - Creating portamento/glide effects
 * - Soft attack/release envelopes
 * - Preventing clicks from sudden value changes
 *
 * The limit parameter sets the maximum change per second.
 * At sampleRate 48000, a limit of 1 means max change of 1/48000 per sample.
 *
 * Inlet:
 *   0: Audio input signal
 *   1: Slew rate limit (units per second)
 *
 * Outlet:
 *   0: Slew-limited output
 */
defineDSP({
  name: 'slop~',
  audioInlets: 1,
  audioOutlets: 1,
  schema: SlopPortSchema,

  state: () => ({
    value: 0
  }),

  process(state, inputs, outputs, _send, parameters) {
    const input = inputs[0][0];
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;

    const limitParam = parameters.limit;
    const invSampleRate = 1 / sampleRate;

    for (let i = 0; i < len; i++) {
      const target = input[i];
      const limit = limitParam[i];

      // Max change per sample = limit / sampleRate
      const maxDelta = limit * invSampleRate;

      const diff = target - state.value;

      if (diff > maxDelta) {
        state.value += maxDelta;
      } else if (diff < -maxDelta) {
        state.value -= maxDelta;
      } else {
        state.value = target;
      }

      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = state.value;
      }
    }
  }
});
