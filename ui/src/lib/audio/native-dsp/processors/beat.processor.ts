import { defineDSP, p } from '../define-dsp';
import { BeatPortSchema } from '../schemas/beat.schema';
import { DEFAULT_BPM, DEFAULT_PPQ, DEFAULT_TIME_SIGNATURE } from '$lib/transport/constants';

interface TransportSync {
  cmd: 'transport-sync';
  isPlaying: boolean;
  seconds: number;
  bpm: number;
  timeSignature: [number, number];
}

const isTransportSync = (message: unknown): message is TransportSync =>
  typeof message === 'object' &&
  message !== null &&
  (message as TransportSync).cmd === 'transport-sync';

defineDSP({
  name: 'beat~',
  audioOutlets: 1,
  schema: BeatPortSchema,

  state: () => ({
    isPlaying: false,
    bpm: DEFAULT_BPM,
    timeSignature: DEFAULT_TIME_SIGNATURE as [number, number],
    ppq: DEFAULT_PPQ,
    phase: 0
  }),

  recv(state, data, inlet) {
    if (inlet === 0 && isTransportSync(data)) {
      state.isPlaying = data.isPlaying;
      state.bpm = data.bpm;
      state.timeSignature = data.timeSignature;

      // Recompute phase from transport seconds to stay aligned
      const [, denominator] = state.timeSignature;
      const ticksPerBeat = state.ppq * (4 / denominator);
      const ticks = data.seconds * (state.bpm / 60) * state.ppq;

      state.phase = (ticks % ticksPerBeat) / ticksPerBeat;
    }
  },

  process(state, _inputs, outputs, _send, parameters) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;
    const multiplyParam = parameters.multiply;

    for (let i = 0; i < len; i++) {
      // Output current phase
      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = state.phase;
      }

      // Advance phase only when playing
      if (state.isPlaying) {
        const multiply = p(multiplyParam, i);
        const increment = ((state.bpm / 60) * multiply) / sampleRate;
        state.phase += increment;

        // Wrap phase to [0, 1)
        if (state.phase >= 1) state.phase -= Math.floor(state.phase);
        else if (state.phase < 0) state.phase += 1;
      }
    }
  }
});
