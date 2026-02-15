import { defineDSP } from '../define-dsp';

defineDSP({
  name: 'vline~',
  audioOutlets: 1,

  state: () => ({
    value: 0,
    segments: [] as { target: number; time: number; delay: number }[],
    currentTarget: 0,
    stepSize: 0,
    samplesRemaining: 0,
    delaySamples: 0
  }),

  recv(state, data) {
    if (Array.isArray(data)) {
      const target = parseFloat(data[0]);
      const time = data.length > 1 ? parseFloat(data[1]) : 0;
      const delay = data.length > 2 ? parseFloat(data[2]) : 0;
      if (!isNaN(target)) {
        state.segments.push({
          target,
          time: Math.max(0, time),
          delay: Math.max(0, delay)
        });
      }
    } else {
      const target = parseFloat(data as string);
      if (!isNaN(target)) {
        state.value = target;
        state.samplesRemaining = 0;
        state.segments.length = 0;
      }
    }
  },

  process(state, _inputs, outputs) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;

    for (let i = 0; i < len; i++) {
      // Start queued segments whose delay has elapsed
      if (state.delaySamples > 0) {
        state.delaySamples--;
      } else if (state.samplesRemaining <= 0 && state.segments.length > 0) {
        const seg = state.segments.shift()!;
        const delaySamples = Math.round((seg.delay / 1000) * sampleRate);

        if (delaySamples > 0) {
          state.delaySamples = delaySamples;
        } else {
          state.currentTarget = seg.target;
          if (seg.time <= 0) {
            state.value = seg.target;
            state.samplesRemaining = 0;
          } else {
            const totalSamples = Math.max(1, Math.round((seg.time / 1000) * sampleRate));
            state.stepSize = (seg.target - state.value) / totalSamples;
            state.samplesRemaining = totalSamples;
          }
        }
      }

      if (state.samplesRemaining > 0) {
        state.value += state.stepSize;
        if (--state.samplesRemaining <= 0) {
          state.value = state.currentTarget;
        }
      }

      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = state.value;
      }
    }
  }
});
