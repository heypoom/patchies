import { defineDSP } from '../define-dsp';
import { BiquadPortSchema } from '../schemas/biquad.schema';

/**
 * biquad~ - Direct coefficient biquad filter
 *
 * A 2nd order (2-pole / 2-zero) filter with direct coefficient control.
 * Implements the difference equation:
 *   y[n] = ff1*x[n] + ff2*x[n-1] + ff3*x[n-2] - fb1*y[n-1] - fb2*y[n-2]
 *
 * Inlets:
 *   0: Audio input signal
 *   1-3: Feedforward coefficients (ff1, ff2, ff3 / b0, b1, b2)
 *   4-5: Feedback coefficients (fb1, fb2 / a1, a2)
 *
 * Outlet:
 *   0: Filtered signal
 */
defineDSP({
  name: 'biquad~',
  audioInlets: 1,
  audioOutlets: 1,
  schema: BiquadPortSchema,

  state: () => ({
    x1: 0, // x[n-1]
    x2: 0, // x[n-2]
    y1: 0, // y[n-1]
    y2: 0 // y[n-2]
  }),

  process(state, inputs, outputs, _send, parameters) {
    const input = inputs[0][0];
    const out = outputs[0];
    const len = out[0].length;
    const channels = out.length;

    const ff1Param = parameters.ff1;
    const ff2Param = parameters.ff2;
    const ff3Param = parameters.ff3;
    const fb1Param = parameters.fb1;
    const fb2Param = parameters.fb2;

    for (let i = 0; i < len; i++) {
      const x0 = input[i];
      const ff1 = ff1Param[i];
      const ff2 = ff2Param[i];
      const ff3 = ff3Param[i];
      const fb1 = fb1Param[i];
      const fb2 = fb2Param[i];

      // y[n] = ff1*x[n] + ff2*x[n-1] + ff3*x[n-2] - fb1*y[n-1] - fb2*y[n-2]
      const y0 = ff1 * x0 + ff2 * state.x1 + ff3 * state.x2 - fb1 * state.y1 - fb2 * state.y2;

      // Shift delay lines
      state.x2 = state.x1;
      state.x1 = x0;
      state.y2 = state.y1;
      state.y1 = y0;

      for (let ch = 0; ch < channels; ch++) {
        out[ch][i] = y0;
      }
    }
  }
});
