import { defineDSP } from '../define-dsp';
import { VcfPortSchema } from '../schemas/vcf.schema';

/**
 * vcf~ - Voltage Controlled Filter
 *
 * A resonant bandpass/lowpass filter with signal-rate frequency modulation.
 * Implemented as a one-pole complex filter (like Pure Data's vcf~).
 *
 * Inlets:
 *   0: Audio input signal
 *   1: Center frequency (signal rate, Hz)
 *   2: Q (resonance) - AudioParam (a-rate)
 *
 * Outlets:
 *   0: Real output (bandpass filtered)
 *   1: Imaginary output (lowpass filtered)
 */
defineDSP({
  name: 'vcf~',
  audioInlets: 2,
  audioOutlets: 2,
  inletDefaults: { 1: 440 },
  schema: VcfPortSchema,

  state: () => ({
    reLast: 0,
    imLast: 0
  }),

  process(state, inputs, outputs, _send, parameters) {
    const input = inputs[0][0]; // mono input
    const freqInput = inputs[1][0]; // frequency signal
    const realOut = outputs[0];
    const imagOut = outputs[1];
    const len = realOut[0].length;
    const channels = realOut.length;

    const qParam = parameters.q;
    // Chromium returns single-element array when param is constant (k-rate),
    // Firefox always returns 128 samples. Handle both cases.
    const qIsKRate = qParam.length === 1;
    const twoPiOverSr = (2 * Math.PI) / sampleRate;

    for (let i = 0; i < len; i++) {
      const freq = freqInput[i];
      const q = qIsKRate ? qParam[0] : qParam[i];
      const omega = freq * twoPiOverSr;

      // Calculate radius from Q
      // r approaches 1 as Q increases (more resonance)
      // Using: r = 1 - (omega / (2 * Q))
      // Clamp to prevent instability
      const r = Math.max(0, Math.min(0.9999, 1 - omega / (2 * q)));

      // Complex coefficients
      const cosCoef = r * Math.cos(omega);
      const sinCoef = r * Math.sin(omega);

      // Complex one-pole filter
      // y[n] = x[n] + coef * y[n-1]
      // where coef is complex: cosCoef + i*sinCoef
      const inSample = input[i];
      const reOut = inSample + cosCoef * state.reLast - sinCoef * state.imLast;
      const imOut = sinCoef * state.reLast + cosCoef * state.imLast;

      state.reLast = reOut;
      state.imLast = imOut;

      // Write to all channels
      for (let ch = 0; ch < channels; ch++) {
        realOut[ch][i] = reOut; // bandpass
        imagOut[ch][i] = imOut; // lowpass
      }
    }
  }
});
