import { defineDSP } from '../define-dsp';
import { workletBufferRegistry } from '../../buffer-bridge/worklet-buffer-registry';

/**
 * delread4~ - Read from a delay line with 4-point interpolation
 *
 * Reads from a named delay line with signal-rate delay time control
 * and 4-point Hermite interpolation for smooth variable delays.
 *
 * Use this for:
 * - Chorus/flanger effects (modulated delay times)
 * - Pitch shifting
 * - Any effect requiring smooth, variable delay
 *
 * Inlet 0: delay time signal (ms)
 * Inlet 1: name (hidden argument)
 */
defineDSP({
  name: 'delread4~',
  audioInlets: 1,
  audioOutlets: 1,
  inletDefaults: { 0: 0 },

  state: () => ({
    name: 'delay'
  }),

  recv(state, data, inlet) {
    // Inlet 1: name (hidden argument)
    if (inlet === 1 && typeof data === 'string') {
      state.name = data;
    }
  },

  process(state, inputs, outputs) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;
    const delaySignal = inputs[0]?.[0];

    if (!state.name || !workletBufferRegistry.has(state.name)) {
      for (let ch = 0; ch < channels; ch++) {
        out[ch].fill(0);
      }

      return;
    }

    const entry = workletBufferRegistry.get(state.name)!;
    const bufLen = entry.length;
    const msToSamples = sampleRate / 1000;

    // Minimum delay of 1 vector ensures we don't read unwritten samples
    const minDelay = len;

    for (let i = 0; i < len; i++) {
      // Get delay time from signal (in ms), convert to samples
      const delayMs = delaySignal ? delaySignal[i] : 0;
      const rawDelaySamples = delayMs * msToSamples;

      // Clip delay to [minDelay, bufferSize] per PD spec
      const delaySamples = Math.max(minDelay, Math.min(bufLen, rawDelaySamples));

      // Read relative to current write head with interpolation
      const readIdx = entry.writeHead - delaySamples - (len - i);
      const sample = workletBufferRegistry.readInterpolated(state.name, 0, readIdx);

      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = sample;
      }
    }
  }
});
