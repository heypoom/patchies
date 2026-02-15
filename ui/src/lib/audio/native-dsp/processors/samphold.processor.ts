import { defineDSP } from '../define-dsp';
import { isMessageType } from '../utils';

defineDSP({
  name: 'samphold~',
  audioInlets: 2,
  audioOutlets: 1,

  state: () => ({
    heldValue: 0,
    lastControl: Infinity
  }),

  recv(state, data) {
    // "set <float>" — set the output value directly
    if (isMessageType(data, 'set')) {
      const val = (data as { type: string; value: number }).value;
      if (typeof val === 'number' && !isNaN(val)) {
        state.heldValue = val;
      }
      return;
    }

    // "reset" or "reset <float>" — set last control value (plain reset = infinity)
    if (isMessageType(data, 'reset')) {
      const val = (data as { type: string; value?: number }).value;
      state.lastControl = typeof val === 'number' && !isNaN(val) ? val : Infinity;
    }
  },

  process(state, inputs, outputs) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;
    const signal = inputs[0];
    const control = inputs[1];

    for (let i = 0; i < len; i++) {
      const controlVal = control[0][i];

      // Sample when control signal decreases (like phasor~ wrap-around)
      if (controlVal < state.lastControl) {
        state.heldValue = signal[0][i];
      }

      state.lastControl = controlVal;

      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = state.heldValue;
      }
    }
  }
});
