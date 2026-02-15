import { defineDSP } from '../define-dsp';
import { isMessageType } from '../utils';

defineDSP({
  name: 'adsr~',
  audioOutlets: 1,

  state: () => ({
    phase: 'idle' as 'idle' | 'attack' | 'decay' | 'sustain' | 'release',
    value: 0,
    attack: 0.01, // seconds
    decay: 0.1, // seconds
    sustain: 0.5, // level 0-1
    release: 0.3, // seconds
    attackRate: 0,
    decayRate: 0,
    releaseRate: 0
  }),

  recv(state, data, inlet) {
    if (inlet === 0) {
      // Trigger inlet: 1/true = gate on, 0/false = gate off
      if (isMessageType(data, 'bang')) {
        // Bang triggers a quick attack+release (like a percussive hit)
        state.phase = 'attack';
        state.attackRate = (1 - state.value) / Math.max(1, state.attack * sampleRate);
        return;
      }

      const val = typeof data === 'boolean' ? (data ? 1 : 0) : parseFloat(data as string);
      if (isNaN(val)) return;

      if (val > 0) {
        state.phase = 'attack';
        state.attackRate = (1 - state.value) / Math.max(1, state.attack * sampleRate);
      } else {
        state.phase = 'release';
        state.releaseRate = state.value / Math.max(1, state.release * sampleRate);
      }
      return;
    }

    const val = parseFloat(data as string);
    if (isNaN(val)) return;

    // Inlets 1-4: attack, decay (ms), sustain (0-1), release (ms)
    if (inlet === 1) state.attack = Math.max(0.001, val / 1000);
    if (inlet === 2) state.decay = Math.max(0.001, val / 1000);
    if (inlet === 3) state.sustain = Math.max(0, Math.min(1, val));
    if (inlet === 4) state.release = Math.max(0.001, val / 1000);
  },

  process(state, _inputs, outputs) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;

    for (let i = 0; i < len; i++) {
      if (state.phase === 'attack') {
        state.value += state.attackRate;
        if (state.value >= 1) {
          state.value = 1;
          state.phase = 'decay';
          state.decayRate = (1 - state.sustain) / Math.max(1, state.decay * sampleRate);
        }
      } else if (state.phase === 'decay') {
        state.value -= state.decayRate;
        if (state.value <= state.sustain) {
          state.value = state.sustain;
          state.phase = 'sustain';
        }
      } else if (state.phase === 'release') {
        state.value -= state.releaseRate;
        if (state.value <= 0) {
          state.value = 0;
          state.phase = 'idle';
        }
      }

      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = state.value;
      }
    }
  }
});
