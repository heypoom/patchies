import { defineDSP } from '../define-dsp';
import { workletBufferRegistry } from '../../buffer-bridge/worklet-buffer-registry';

/**
 * delread~ - Read from a delay line
 *
 * Reads from a named delay line at a fixed delay time.
 * The delay line must be created by a delwrite~ object.
 *
 * Arguments: name, delay (ms)
 * Example: delread~ mydelay 100  (read 100ms delayed)
 */
defineDSP({
  name: 'delread~',
  audioInlets: 0,
  audioOutlets: 1,

  state: () => ({
    name: 'delay',
    delayMs: 0
  }),

  recv(state, data, inlet) {
    // Inlet 0: name (hidden argument)
    if (inlet === 0) {
      if (typeof data === 'string') {
        state.name = data;
      }
      return;
    }

    // Inlet 1: delay in ms
    if (inlet === 1) {
      const delay = parseFloat(data as string);
      if (!isNaN(delay)) {
        state.delayMs = Math.max(0, delay);
      }
    }
  },

  process(state, _inputs, outputs) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;

    if (!state.name || !workletBufferRegistry.has(state.name)) {
      for (let ch = 0; ch < channels; ch++) {
        out[ch].fill(0);
      }
      return;
    }

    const entry = workletBufferRegistry.get(state.name)!;
    const bufLen = entry.length;

    // Clip delay to [len, bufferSize] (minimum of one vector to avoid reading unwritten samples)
    const rawDelaySamples = (state.delayMs / 1000) * sampleRate;
    const delaySamples = Math.max(len, Math.min(bufLen, rawDelaySamples));

    for (let i = 0; i < len; i++) {
      // Read relative to current write head position
      // writeHead points to where the NEXT sample will be written
      // So we read (writeHead - delaySamples - (len - i)) to account for block offset
      const readIdx = entry.writeHead - delaySamples - (len - i);
      const sample = workletBufferRegistry.readSample(state.name, 0, readIdx);

      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = sample;
      }
    }
  }
});
