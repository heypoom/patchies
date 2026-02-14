import { defineDSP } from '../define-dsp';

defineDSP({
  name: 'bang~',
  audioInlets: 1,
  audioOutlets: 0,

  state: () => ({
    wasSilent: true
  }),

  process(state, inputs, _outputs, send) {
    const input = inputs[0]?.[0];
    if (!input) return;

    // Detect audio onset: transition from silence to non-silence
    let hasSignal = false;
    for (let i = 0; i < input.length; i++) {
      if (input[i] !== 0) {
        hasSignal = true;
        break;
      }
    }

    if (hasSignal && state.wasSilent) {
      send({ type: 'bang' }, 0);
    }

    state.wasSilent = !hasSignal;
  }
});
