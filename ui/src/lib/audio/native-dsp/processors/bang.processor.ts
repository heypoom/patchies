import { defineDSP } from '../define-dsp';

defineDSP({
  name: 'bang~',
  audioInlets: 0,
  audioOutlets: 0,

  state: () => ({}),

  process(_state, _inputs, _outputs, send) {
    send({ type: 'bang' }, 0);
  }
});
