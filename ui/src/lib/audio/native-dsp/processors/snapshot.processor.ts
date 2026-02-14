import { defineDSP } from '../define-dsp';
import { isMessageType } from '../utils';

defineDSP({
  name: 'snapshot~',
  audioInlets: 1,
  audioOutlets: 0,

  state: () => ({
    lastValue: 0,
    shouldSample: false
  }),

  recv(state, data) {
    // Any message (bang, number, etc.) triggers a snapshot
    if (isMessageType(data, 'bang')) {
      state.shouldSample = true;
    }
  },

  process(state, inputs, _outputs, send) {
    const input = inputs[0]?.[0];
    if (!input) return;

    // Capture the last sample of this block
    state.lastValue = input[input.length - 1];

    if (state.shouldSample) {
      send(state.lastValue, 0);
      state.shouldSample = false;
    }
  }
});
