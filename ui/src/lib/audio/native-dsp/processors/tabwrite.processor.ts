import { defineDSP } from '../define-dsp';
import { workletBufferRegistry } from '../../buffer-bridge/worklet-buffer-registry';
import { isMessageType } from '../utils';

defineDSP({
  name: 'tabwrite~',
  audioInlets: 1,
  audioOutlets: 0,

  state: () => ({
    bufferName: '',
    writing: true
  }),

  recv(state, data) {
    if (typeof data === 'string') {
      state.bufferName = data;
      return;
    }

    if (isMessageType(data, 'set')) {
      const name = (data as { type: string; name: string }).name;
      if (typeof name === 'string') state.bufferName = name;
      return;
    }

    if (isMessageType(data, 'bang')) {
      workletBufferRegistry.resetHead(state.bufferName);
      return;
    }

    if (isMessageType(data, 'stop')) {
      state.writing = false;
      return;
    }

    if (isMessageType(data, 'start')) {
      state.writing = true;
    }
  },

  process(state, inputs) {
    if (!state.writing || !state.bufferName) return;
    if (!workletBufferRegistry.has(state.bufferName)) return;

    const input = inputs[0]?.[0];
    if (!input) return;

    workletBufferRegistry.writeBlock(state.bufferName, 0, input);
  }
});
