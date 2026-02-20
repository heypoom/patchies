import { defineDSP, p } from '../define-dsp';
import { workletBufferRegistry } from '../../buffer-bridge/worklet-buffer-registry';
import { Tabosc4PortSchema } from '../schemas/tabosc4.schema';

/**
 * tabosc4~ - 4-point interpolating wavetable oscillator
 * Combines a phasor with tabread4~ for wavetable synthesis.
 */
defineDSP({
  name: 'tabosc4~',
  audioOutlets: 1,
  schema: Tabosc4PortSchema,

  state: () => ({
    phase: 0,
    tableName: ''
  }),

  recv(state, data, inlet) {
    // Table name (inlet 1)
    if (inlet === 1 && typeof data === 'string') {
      state.tableName = data;
    }
  },

  process(state, _inputs, outputs, _send, parameters) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;
    const freqParam = parameters.frequency;

    // Get buffer info
    const bufferLength = state.tableName
      ? (workletBufferRegistry.get(state.tableName)?.length ?? 0)
      : 0;

    if (!bufferLength) {
      for (let ch = 0; ch < channels; ch++) {
        out[ch].fill(0);
      }
      return;
    }

    for (let i = 0; i < len; i++) {
      const frequency = p(freqParam, i);
      const increment = frequency / sampleRate;

      // Convert phase (0-1) to table index
      const index = state.phase * bufferLength;

      // Read with 4-point interpolation (same value for all channels)
      const sample = workletBufferRegistry.readInterpolated(state.tableName, 0, index);

      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = sample;
      }

      // Advance phase
      state.phase += increment;

      // Wrap phase to [0, 1)
      if (state.phase >= 1) state.phase -= 1;
      else if (state.phase < 0) state.phase += 1;
    }
  }
});
