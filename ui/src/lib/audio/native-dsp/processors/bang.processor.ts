import { defineDSP } from '../define-dsp';

const BANG = { type: 'bang' };

defineDSP({
  name: 'bang~',
  audioInlets: 0,
  audioOutlets: 0,
  state: () => ({}),

  process(_state, _inputs, _outputs, send) {
    send(BANG, 0);
  }
});
