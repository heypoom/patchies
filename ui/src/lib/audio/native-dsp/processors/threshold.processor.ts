import { defineDSP } from '../define-dsp';

const BANG = { type: 'bang' };

defineDSP({
  name: 'threshold~',
  audioInlets: 1,
  audioOutlets: 0,

  state: () => ({
    // Thresholds
    triggerThreshold: 0,
    restThreshold: 0,

    // Debounce times in samples
    triggerDebounce: 0,
    restDebounce: 0,

    // Internal state: 'low' or 'high'
    isHigh: false,

    // Debounce counters (count down to 0)
    triggerWait: 0,
    restWait: 0
  }),

  recv(state, data, inlet) {
    if (inlet === 1) {
      // Message inlet: set parameters or state

      // List: [triggerThreshold, triggerDebounce, restThreshold, restDebounce]
      if (Array.isArray(data)) {
        if (data.length >= 1) state.triggerThreshold = parseFloat(data[0]);
        if (data.length >= 2)
          state.triggerDebounce = Math.max(0, (parseFloat(data[1]) / 1000) * sampleRate);
        if (data.length >= 3) state.restThreshold = parseFloat(data[2]);
        if (data.length >= 4)
          state.restDebounce = Math.max(0, (parseFloat(data[3]) / 1000) * sampleRate);
        return;
      }

      // Single number: set internal state (nonzero = high, 0 = low)
      const val = parseFloat(data as string);
      if (!isNaN(val)) {
        state.isHigh = val !== 0;
        state.triggerWait = 0;
        state.restWait = 0;
      }

      return;
    }

    // Left inlet (inlet 0): arguments as list [trigThresh, trigDebounce, restThresh, restDebounce]
    if (Array.isArray(data)) {
      if (data.length >= 1) state.triggerThreshold = parseFloat(data[0]);
      if (data.length >= 2)
        state.triggerDebounce = Math.max(0, (parseFloat(data[1]) / 1000) * sampleRate);
      if (data.length >= 3) state.restThreshold = parseFloat(data[2]);
      if (data.length >= 4)
        state.restDebounce = Math.max(0, (parseFloat(data[3]) / 1000) * sampleRate);
    }
  },

  process(state, inputs, _outputs, send) {
    const input = inputs[0]?.[0];
    if (!input) return;

    const len = input.length;

    for (let i = 0; i < len; i++) {
      const sample = input[i];

      // Count down debounce timers
      if (state.triggerWait > 0) state.triggerWait--;
      if (state.restWait > 0) state.restWait--;

      if (!state.isHigh) {
        // Currently low: check if signal exceeds trigger threshold
        if (sample >= state.triggerThreshold && state.triggerWait <= 0) {
          state.isHigh = true;
          state.restWait = state.restDebounce;
          send(BANG, 0); // Bang on outlet 0 (trigger)
        }
      } else {
        // Currently high: check if signal drops below rest threshold
        if (sample <= state.restThreshold && state.restWait <= 0) {
          state.isHigh = false;
          state.triggerWait = state.triggerDebounce;
          send(BANG, 1); // Bang on outlet 1 (rest)
        }
      }
    }
  }
});
