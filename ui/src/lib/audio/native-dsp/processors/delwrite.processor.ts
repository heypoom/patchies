import { defineDSP } from '../define-dsp';
import { workletBufferRegistry } from '../../buffer-bridge/worklet-buffer-registry';
import { isMessageType } from '../utils';

/**
 * delwrite~ - Write to a delay line
 *
 * Creates a named delay line buffer and continuously writes audio to it.
 * Use with delread~ or delread4~ to tap the delay at various times.
 *
 * Arguments: name, size (ms)
 * Example: delwrite~ mydelay 1000  (1 second delay line)
 */
defineDSP({
  name: 'delwrite~',
  audioInlets: 1,
  audioOutlets: 0,

  state: () => ({
    name: 'delay',
    sizeMs: 1000,
    initialized: false
  }),

  recv(state, data, inlet) {
    // Inlet 1: control messages (clear)
    if (inlet === 1) {
      if (isMessageType(data, 'clear')) {
        const entry = workletBufferRegistry.get(state.name);
        if (entry) {
          entry.data.fill(0);
        }
      }
      return;
    }

    // Inlet 2: name (hidden argument)
    if (inlet === 2) {
      if (typeof data === 'string') {
        state.name = data;
        state.initialized = false;
      }
      return;
    }

    // Inlet 3: size in ms (hidden argument)
    if (inlet === 3) {
      const size = parseFloat(data as string);
      if (!isNaN(size) && size > 0) {
        state.sizeMs = size;
        state.initialized = false;
      }
    }
  },

  process(state, inputs) {
    if (!state.name) return;

    // Initialize buffer if needed
    if (!state.initialized) {
      const sizeSamples = Math.ceil((state.sizeMs / 1000) * sampleRate);

      // Delete old buffer if exists, create new one
      if (workletBufferRegistry.has(state.name)) {
        workletBufferRegistry.delete(state.name);
      }

      workletBufferRegistry.create(state.name, sizeSamples, 1);
      state.initialized = true;
    }

    const input = inputs[0]?.[0];
    if (!input) return;

    workletBufferRegistry.writeBlock(state.name, 0, input);
  }
});
