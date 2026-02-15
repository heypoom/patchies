import { defineDSP } from '../define-dsp';
import { workletBufferRegistry } from '../../buffer-bridge/worklet-buffer-registry';

defineDSP({
  name: 'tabread4~',
  audioInlets: 1,
  audioOutlets: 1,

  state: () => ({
    bufferName: ''
  }),

  recv(state, data) {
    if (typeof data === 'string') {
      state.bufferName = data;
    }
  },

  process(state, inputs, outputs) {
    const out = outputs[0];
    const channels = out.length;
    const len = out[0].length;
    const indexSignal = inputs[0]?.[0];

    if (!state.bufferName || !workletBufferRegistry.has(state.bufferName) || !indexSignal) {
      for (let ch = 0; ch < channels; ch++) {
        out[ch].fill(0);
      }
      return;
    }

    for (let i = 0; i < len; i++) {
      const index = indexSignal[i];
      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = workletBufferRegistry.readInterpolated(state.bufferName, 0, index);
      }
    }
  }
});
