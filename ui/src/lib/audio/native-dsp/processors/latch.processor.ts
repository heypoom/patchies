import { defineDSP } from '../define-dsp';
import { isMessageType } from '../utils';

defineDSP({
  name: 'latch~',
  audioInlets: 1,
  audioOutlets: 1,
  state: () => ({ held: 0, shouldSample: false }),

  recv(state, data) {
    if (isMessageType(data, 'bang')) {
      state.shouldSample = true;
    }
  },

  process(state, inputs, outputs) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;
    const input = inputs[0]?.[0];

    if (state.shouldSample && input) {
      state.held = input[0];
      state.shouldSample = false;
    }

    for (let i = 0; i < len; i++) {
      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = state.held;
      }
    }
  }
});
