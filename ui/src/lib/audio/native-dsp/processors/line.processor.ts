import { defineDSP } from '../define-dsp';
import { isMessageType } from '../utils';

defineDSP({
  name: 'line~',
  audioOutlets: 1,

  state: () => ({
    currentValue: 0,
    targetValue: 0,
    stepSize: 0,
    samplesRemaining: 0,
    queuedRampTime: 0
  }),

  recv(state, data, inlet) {
    if (inlet === 1) {
      // Right inlet: set ramp time for the next target
      const time = parseFloat(data as string);
      if (!isNaN(time)) state.queuedRampTime = Math.max(0, time);

      return;
    }

    // Left inlet: set target and start ramp
    if (isMessageType(data, 'stop')) {
      state.samplesRemaining = 0;
      state.targetValue = state.currentValue;
      state.stepSize = 0;

      return;
    }

    let target = 0;
    let time = state.queuedRampTime;

    // Support [value, time] list format or single number
    if (Array.isArray(data)) {
      target = parseFloat(data[0]);

      if (data.length > 1) {
        const parsedTime = parseFloat(data[1]);

        if (!isNaN(parsedTime)) time = parsedTime;
      }
    } else {
      target = parseFloat(data as string);
    }

    if (isNaN(target)) return;

    state.targetValue = target;

    if (time <= 0) {
      // Immediate jump
      state.currentValue = state.targetValue;
      state.samplesRemaining = 0;
      state.stepSize = 0;
    } else {
      // Calculate ramp parameters
      const totalSamples = (time / 1000) * sampleRate;
      state.samplesRemaining = Math.max(1, Math.round(totalSamples));
      state.stepSize = (state.targetValue - state.currentValue) / state.samplesRemaining;
    }

    // Ramp time is consumed once a ramp starts (PureData behavior)
    state.queuedRampTime = 0;
  },

  process(state, _inputs, outputs) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;

    for (let i = 0; i < len; i++) {
      if (state.samplesRemaining > 0) {
        state.currentValue += state.stepSize;
        if (--state.samplesRemaining <= 0) {
          state.currentValue = state.targetValue;
          state.stepSize = 0;
        }
      }

      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = state.currentValue;
      }
    }
  }
});
