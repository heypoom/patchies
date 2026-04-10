import { defineDSP } from '../define-dsp';

defineDSP({
  name: 'tap~',
  audioInlets: 2,
  audioOutlets: 0,

  state: () => ({
    buffers: [new Float32Array(512), new Float32Array(512)],
    buffersY: [new Float32Array(512), new Float32Array(512)],
    activeBuffer: 0,
    writeIndex: 0,
    phase: 'waiting' as 'waiting' | 'filling',
    prevSample: 0,
    samplesSinceLastSend: 0,
    bufferSize: 512,
    maxWait: 4096,
    cooldownSamples: 0,
    mode: 'wave' as 'wave' | 'xy'
  }),

  recv(state, data, inlet) {
    // inlet 2 = bufferSize (number)
    if (inlet === 2 && typeof data === 'number') {
      const size = data;
      if (size >= 64 && size <= 2048) {
        state.bufferSize = size;
        state.buffers = [new Float32Array(size), new Float32Array(size)];
        state.buffersY = [new Float32Array(size), new Float32Array(size)];
        state.writeIndex = 0;
        state.phase = 'waiting';
      }
      return;
    }

    // inlet 3 = mode ('wave' | 'xy')
    if (inlet === 3 && (data === 'wave' || data === 'xy')) {
      state.mode = data;
      state.phase = 'waiting';
      state.writeIndex = 0;
      return;
    }

    // inlet 4 = fps (number)
    if (inlet === 4 && typeof data === 'number') {
      // sampleRate is a global in AudioWorkletGlobalScope
      state.cooldownSamples =
        data > 0
          ? Math.floor((globalThis as unknown as { sampleRate: number }).sampleRate / data)
          : 0;
      return;
    }
  },

  process(state, inputs, _outputs, send) {
    const inputX = inputs[0]?.[0];
    if (!inputX) return;

    const bufX = state.buffers[state.activeBuffer];
    const isXY = state.mode === 'xy';
    const inputY = isXY ? inputs[1]?.[0] : null;
    const bufY = state.buffersY[state.activeBuffer];

    for (let i = 0; i < inputX.length; i++) {
      const sample = inputX[i];
      state.samplesSinceLastSend++;

      if (state.phase === 'waiting') {
        if (state.cooldownSamples > 0 && state.samplesSinceLastSend < state.cooldownSamples) {
          state.prevSample = sample;
          continue;
        }

        if ((state.prevSample <= 0 && sample > 0) || state.samplesSinceLastSend >= state.maxWait) {
          state.phase = 'filling';
          state.writeIndex = 0;

          bufX[state.writeIndex] = sample;
          if (isXY) bufY[state.writeIndex] = inputY ? inputY[i] : 0;
          state.writeIndex++;
        }
      } else {
        bufX[state.writeIndex] = sample;
        if (isXY) bufY[state.writeIndex] = inputY ? inputY[i] : 0;
        state.writeIndex++;

        if (state.writeIndex >= state.bufferSize) {
          if (isXY) {
            send({ type: 'xy', x: bufX, y: bufY }, 0);
          } else {
            send(bufX, 0);
          }

          state.activeBuffer ^= 1;
          state.phase = 'waiting';
          state.samplesSinceLastSend = 0;
        }
      }

      state.prevSample = sample;
    }
  }
});
