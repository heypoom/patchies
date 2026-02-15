import { defineDSP } from '../define-dsp';

defineDSP({
  name: 'scope~',
  audioInlets: 1,
  audioOutlets: 0,

  state: () => ({
    buffer: new Float32Array(512),
    writeIndex: 0,
    phase: 'waiting' as 'waiting' | 'filling',
    prevSample: 0,
    samplesSinceLastSend: 0,
    bufferSize: 512,
    maxWait: 4096,
    cooldownSamples: 0 // 0 = no throttle
  }),

  recv(state, data) {
    if (typeof data !== 'object' || data === null) return;

    const msg = data as Record<string, number>;

    if ('bufferSize' in msg) {
      const size = msg.bufferSize;
      if (typeof size === 'number' && size >= 64 && size <= 2048) {
        state.bufferSize = size;
        state.buffer = new Float32Array(size);
        state.writeIndex = 0;
        state.phase = 'waiting';
      }
    }

    if ('fps' in msg) {
      const fps = msg.fps;
      // sampleRate is a global in AudioWorkletGlobalScope
      state.cooldownSamples = fps > 0 ? Math.floor(sampleRate / fps) : 0;
    }
  },

  process(state, inputs, _outputs, send) {
    const input = inputs[0]?.[0];
    if (!input) return;

    for (let i = 0; i < input.length; i++) {
      const sample = input[i];
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
          state.buffer[state.writeIndex++] = sample;
        }
      } else {
        state.buffer[state.writeIndex++] = sample;

        if (state.writeIndex >= state.bufferSize) {
          send(state.buffer.slice(0, state.bufferSize), 0);
          state.phase = 'waiting';
          state.samplesSinceLastSend = 0;
        }
      }

      state.prevSample = sample;
    }
  }
});
