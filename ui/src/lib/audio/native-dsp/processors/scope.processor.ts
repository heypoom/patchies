import { defineDSP } from '../define-dsp';

defineDSP({
  name: 'scope~',
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
    cooldownSamples: 0, // 0 = no throttle
    mode: 'waveform' as 'waveform' | 'xy'
  }),

  recv(state, data) {
    if (typeof data !== 'object' || data === null) return;

    const msg = data as Record<string, unknown>;

    if ('bufferSize' in msg) {
      const size = msg.bufferSize;

      if (typeof size === 'number' && size >= 64 && size <= 2048) {
        state.bufferSize = size;
        state.buffers = [new Float32Array(size), new Float32Array(size)];
        state.buffersY = [new Float32Array(size), new Float32Array(size)];
        state.writeIndex = 0;
        state.phase = 'waiting';
      }
    }

    if ('fps' in msg) {
      const fps = msg.fps;

      // sampleRate is a global in AudioWorkletGlobalScope
      if (typeof fps === 'number') {
        state.cooldownSamples = fps > 0 ? Math.floor(sampleRate / fps) : 0;
      }
    }

    if ('mode' in msg) {
      const mode = msg.mode;
      if (mode === 'waveform' || mode === 'xy') {
        state.mode = mode;
        state.phase = 'waiting';
        state.writeIndex = 0;
      }
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
        // Respect cooldown before looking for next trigger
        if (state.cooldownSamples > 0 && state.samplesSinceLastSend < state.cooldownSamples) {
          state.prevSample = sample;
          continue;
        }

        // Look for rising zero-crossing or force after maxWait
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
            send({ x: bufX, y: bufY }, 0);
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
