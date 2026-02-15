import { defineDSP } from '../define-dsp';

defineDSP({
  name: 'pink~',
  audioOutlets: 1,

  state: () => ({
    b0: 0,
    b1: 0,
    b2: 0,
    b3: 0,
    b4: 0,
    b5: 0,
    b6: 0
  }),

  process(state, _inputs, outputs) {
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;

    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;

      // Paul Kellet's refined method
      state.b0 = 0.99886 * state.b0 + white * 0.0555179;
      state.b1 = 0.99332 * state.b1 + white * 0.0750759;
      state.b2 = 0.969 * state.b2 + white * 0.153852;
      state.b3 = 0.8665 * state.b3 + white * 0.3104856;
      state.b4 = 0.55 * state.b4 + white * 0.5329522;
      state.b5 = -0.7616 * state.b5 - white * 0.016898;

      const pink =
        state.b0 + state.b1 + state.b2 + state.b3 + state.b4 + state.b5 + state.b6 + white * 0.5362;
      state.b6 = white * 0.115926;

      const sample = pink * 0.11; // normalize to ~[-1, 1]

      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = sample;
      }
    }
  }
});
