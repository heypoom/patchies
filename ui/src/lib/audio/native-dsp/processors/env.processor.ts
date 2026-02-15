import { defineDSP } from '../define-dsp';

defineDSP({
  name: 'env~',
  audioInlets: 1,
  audioOutlets: 0,

  state: () => ({
    windowSize: 1024,
    buffer: new Float32Array(1024),
    writeIndex: 0,
    sumOfSquares: 0,
    samplesUntilOutput: 1024
  }),

  recv(state, data, inlet) {
    if (inlet === 1) {
      const size = parseInt(data as string, 10);
      if (!isNaN(size) && size > 0) {
        state.windowSize = size;
        state.buffer = new Float32Array(size);
        state.writeIndex = 0;
        state.sumOfSquares = 0;
        state.samplesUntilOutput = size;
      }
    }
  },

  process(state, inputs, _outputs, send) {
    const input = inputs[0]?.[0];
    if (!input) return;

    for (let i = 0; i < input.length; i++) {
      const sample = input[i];
      const oldSample = state.buffer[state.writeIndex];

      state.sumOfSquares += sample * sample - oldSample * oldSample;
      state.buffer[state.writeIndex] = sample;
      state.writeIndex = (state.writeIndex + 1) % state.windowSize;

      if (--state.samplesUntilOutput <= 0) {
        const rms = Math.sqrt(Math.max(0, state.sumOfSquares) / state.windowSize);
        send(rms, 0);
        state.samplesUntilOutput = state.windowSize;
      }
    }
  }
});
